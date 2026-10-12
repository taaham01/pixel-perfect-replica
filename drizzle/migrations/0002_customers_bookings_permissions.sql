CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  phone_verified boolean NOT NULL DEFAULT false,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.staff_permissions (
  user_id uuid PRIMARY KEY,
  can_publish boolean NOT NULL DEFAULT false,
  can_manage_bookings boolean NOT NULL DEFAULT false,
  can_view_customers boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_permissions TO authenticated;
GRANT ALL ON public.staff_permissions TO service_role;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','cancelled','completed');
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  message text,
  status public.booking_status NOT NULL DEFAULT 'pending',
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_user_idx ON public.bookings(user_id);
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.phone_otps (
  user_id uuid PRIMARY KEY,
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.phone_otps TO service_role;
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_perm(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'super_admin') OR (public.has_role(_user_id, 'inventory_manager') AND EXISTS (
    SELECT 1 FROM public.staff_permissions p WHERE p.user_id = _user_id AND CASE _perm
      WHEN 'publish' THEN p.can_publish WHEN 'bookings' THEN p.can_manage_bookings WHEN 'customers' THEN p.can_view_customers ELSE false END))
$$;

CREATE POLICY "Own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_perm(auth.uid(),'customers') OR public.has_perm(auth.uid(),'bookings'));
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND phone_verified = false);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Own perms read" ON public.staff_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Own bookings read" ON public.bookings FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_perm(auth.uid(),'bookings'));
CREATE POLICY "Verified customers book" ON public.bookings FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND status = 'pending'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.phone_verified)
  AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.publish_state = 'published' AND v.status = 'available'));
CREATE POLICY "Staff update bookings" ON public.bookings FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(),'bookings')) WITH CHECK (public.has_perm(auth.uid(),'bookings'));

-- Users cannot self-verify phone; changing phone resets verification.
CREATE OR REPLACE FUNCTION public.profiles_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN NEW.phone_verified := false;
    ELSE
      IF NEW.phone IS DISTINCT FROM OLD.phone THEN NEW.phone_verified := false;
      ELSE NEW.phone_verified := OLD.phone_verified; END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_guard BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Staff may only change booking status/notes.
CREATE OR REPLACE FUNCTION public.bookings_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id; NEW.vehicle_id := OLD.vehicle_id; NEW.message := OLD.message; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_guard BEFORE INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.bookings_guard();

-- Publishing requires permission for inventory managers.
CREATE OR REPLACE FUNCTION public.vehicles_before_write()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    IF NEW.publish_state = 'archived' AND (TG_OP = 'INSERT' OR OLD.publish_state <> 'archived') THEN
      RAISE EXCEPTION 'Only a Super Admin can archive vehicles';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.publish_state = 'archived' AND NEW.publish_state <> 'archived' THEN
      RAISE EXCEPTION 'Only a Super Admin can restore archived vehicles';
    END IF;
    IF ((TG_OP = 'INSERT' AND NEW.publish_state = 'published')
        OR (TG_OP = 'UPDATE' AND (NEW.publish_state = 'published') IS DISTINCT FROM (OLD.publish_state = 'published')))
       AND NOT public.has_perm(auth.uid(), 'publish') THEN
      RAISE EXCEPTION 'You do not have permission to publish or unpublish vehicles';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := coalesce(NEW.created_by, auth.uid()); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $function$;