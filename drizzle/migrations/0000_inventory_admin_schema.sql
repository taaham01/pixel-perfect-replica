CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TYPE public.app_role AS ENUM ('super_admin', 'inventory_manager');
CREATE TYPE public.vehicle_status AS ENUM ('available', 'reserved', 'sold');
CREATE TYPE public.publish_state AS ENUM ('draft', 'published', 'archived');

-- Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;

CREATE POLICY "Users read own roles, super admins read all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));

-- Vehicles
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id text NOT NULL UNIQUE CHECK (length(stock_id) BETWEEN 1 AND 40),
  make text NOT NULL CHECK (length(make) BETWEEN 1 AND 60),
  model text NOT NULL CHECK (length(model) BETWEEN 1 AND 80),
  variant text,
  year integer NOT NULL CHECK (year BETWEEN 1950 AND 2100),
  mileage integer NOT NULL CHECK (mileage >= 0),
  mileage_unit text NOT NULL DEFAULT 'km' CHECK (mileage_unit IN ('km', 'mi')),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  engine_cc integer CHECK (engine_cc IS NULL OR engine_cc BETWEEN 50 AND 20000),
  transmission text,
  fuel text,
  body_type text,
  drivetrain text,
  exterior_color text,
  interior_color text,
  chassis_number text,
  auction_grade text,
  description text,
  location text,
  shipping_info text,
  status public.vehicle_status NOT NULL DEFAULT 'available',
  publish_state public.publish_state NOT NULL DEFAULT 'draft',
  featured boolean NOT NULL DEFAULT false,
  primary_image_path text,
  primary_thumb_path text,
  slug text GENERATED ALWAYS AS (
    lower(regexp_replace(make || '-' || model || '-' || year::text || '-stock-' || stock_id, '[^a-zA-Z0-9]+', '-', 'g'))
  ) STORED,
  search_text text GENERATED ALWAYS AS (
    lower(stock_id || ' ' || make || ' ' || model || ' ' || coalesce(variant, '') || ' ' || coalesce(chassis_number, ''))
  ) STORED,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vehicles_slug_idx ON public.vehicles (slug);
CREATE INDEX vehicles_listing_idx ON public.vehicles (publish_state, status, created_at DESC);
CREATE INDEX vehicles_make_model_idx ON public.vehicles (make, model);
CREATE INDEX vehicles_year_idx ON public.vehicles (year);
CREATE INDEX vehicles_price_idx ON public.vehicles (price);
CREATE INDEX vehicles_mileage_idx ON public.vehicles (mileage);
CREATE INDEX vehicles_search_trgm_idx ON public.vehicles USING gin (search_text extensions.gin_trgm_ops);

GRANT SELECT ON public.vehicles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published vehicles" ON public.vehicles
  FOR SELECT TO anon, authenticated USING (publish_state = 'published');
CREATE POLICY "Admins read all vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert vehicles" ON public.vehicles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update vehicles" ON public.vehicles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Super admins delete vehicles" ON public.vehicles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Only super admins may archive / unarchive
CREATE OR REPLACE FUNCTION public.vehicles_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NEW.publish_state = 'archived' AND (TG_OP = 'INSERT' OR OLD.publish_state <> 'archived') THEN
      RAISE EXCEPTION 'Only a Super Admin can archive vehicles';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.publish_state = 'archived' AND NEW.publish_state <> 'archived' THEN
      RAISE EXCEPTION 'Only a Super Admin can restore archived vehicles';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(NEW.created_by, auth.uid());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER vehicles_before_write BEFORE INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.vehicles_before_write();

-- Vehicle images
CREATE TABLE public.vehicle_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  thumb_path text,
  position integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  width integer,
  height integer,
  size_bytes integer,
  original_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicle_images_vehicle_idx ON public.vehicle_images (vehicle_id, position);
CREATE UNIQUE INDEX vehicle_images_one_primary ON public.vehicle_images (vehicle_id) WHERE is_primary;

GRANT SELECT ON public.vehicle_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_images TO authenticated;
GRANT ALL ON public.vehicle_images TO service_role;
ALTER TABLE public.vehicle_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads images of published vehicles" ON public.vehicle_images
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.publish_state = 'published'));
CREATE POLICY "Admins read all images" ON public.vehicle_images
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert images" ON public.vehicle_images
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update images" ON public.vehicle_images
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete images" ON public.vehicle_images
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Keep the vehicle's cover image in sync
CREATE OR REPLACE FUNCTION public.sync_vehicle_cover()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vid uuid := coalesce(NEW.vehicle_id, OLD.vehicle_id);
BEGIN
  UPDATE public.vehicles v SET
    primary_image_path = c.storage_path,
    primary_thumb_path = coalesce(c.thumb_path, c.storage_path)
  FROM (SELECT NULL::text AS x) dummy
  LEFT JOIN LATERAL (
    SELECT storage_path, thumb_path FROM public.vehicle_images
    WHERE vehicle_id = vid ORDER BY is_primary DESC, position ASC, created_at ASC LIMIT 1
  ) c ON true
  WHERE v.id = vid;
  RETURN NULL;
END $$;
CREATE TRIGGER vehicle_images_sync_cover AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_images
  FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_cover();

-- Activity log
CREATE TABLE public.admin_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_activity_created_idx ON public.admin_activity (created_at DESC);
GRANT SELECT ON public.admin_activity TO authenticated;
GRANT ALL ON public.admin_activity TO service_role;
ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read activity" ON public.admin_activity
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.log_vehicle_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d jsonb := '{}'::jsonb; act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    act := 'vehicle.created';
    d := jsonb_build_object('stock_id', NEW.stock_id, 'status', NEW.status, 'publish_state', NEW.publish_state);
  ELSIF TG_OP = 'DELETE' THEN
    act := 'vehicle.deleted';
    d := jsonb_build_object('stock_id', OLD.stock_id);
  ELSE
    act := 'vehicle.updated';
    d := jsonb_build_object('stock_id', NEW.stock_id);
    IF NEW.price IS DISTINCT FROM OLD.price THEN d := d || jsonb_build_object('price', jsonb_build_array(OLD.price, NEW.price)); END IF;
    IF NEW.mileage IS DISTINCT FROM OLD.mileage THEN d := d || jsonb_build_object('mileage', jsonb_build_array(OLD.mileage, NEW.mileage)); END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN d := d || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status)); END IF;
    IF NEW.publish_state IS DISTINCT FROM OLD.publish_state THEN d := d || jsonb_build_object('publish_state', jsonb_build_array(OLD.publish_state, NEW.publish_state)); END IF;
    IF d = jsonb_build_object('stock_id', NEW.stock_id)
       AND NEW.primary_image_path IS DISTINCT FROM OLD.primary_image_path THEN
      RETURN NULL; -- cover sync only, not worth logging
    END IF;
  END IF;
  INSERT INTO public.admin_activity (actor_id, actor_email, action, entity, entity_id, details)
  VALUES (auth.uid(), auth.jwt() ->> 'email', act, 'vehicle', coalesce(NEW.id, OLD.id)::text, d);
  RETURN NULL;
END $$;
CREATE TRIGGER vehicles_log AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.log_vehicle_change();

-- Distinct makes/models for public filters
CREATE OR REPLACE FUNCTION public.vehicle_facets()
RETURNS TABLE (make text, model text) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT DISTINCT make, model FROM public.vehicles WHERE publish_state = 'published' ORDER BY make, model
$$;
GRANT EXECUTE ON FUNCTION public.vehicle_facets() TO anon, authenticated;

-- Storage policies for vehicle-images bucket
CREATE POLICY "Public read vehicle images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'vehicle-images');
CREATE POLICY "Admins upload vehicle images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vehicle-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update vehicle images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'vehicle-images' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete vehicle images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'vehicle-images' AND public.is_admin(auth.uid()));