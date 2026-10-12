-- Customer accounts, reservations and stored inquiries.
-- Customers are ordinary auth users WITHOUT a row in user_roles; staff keep using user_roles.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- Customer profiles. Phone numbers live in a separate table (customer_contacts) so that
-- staff can see who a customer is without being able to see how to reach them.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE public.customer_number_seq;

CREATE TABLE public.customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Human-friendly, auto-generated ID that staff and customers can quote to each other.
  customer_number text NOT NULL UNIQUE
    DEFAULT ('AHM-' || lpad(nextval('public.customer_number_seq')::text, 6, '0')),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 120),
  country text NOT NULL CHECK (length(btrim(country)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER SEQUENCE public.customer_number_seq OWNED BY public.customer_profiles.customer_number;
CREATE TRIGGER customer_profiles_touch BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Customers may edit their name and country only; the ID and key are fixed.
GRANT SELECT ON public.customer_profiles TO authenticated;
GRANT UPDATE (full_name, country) ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- A customer sees and edits only their own profile; every staff member can read all of them.
CREATE POLICY "Customers read own profile" ON public.customer_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all profiles" ON public.customer_profiles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Customers update own profile" ON public.customer_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Phone numbers: visible to the customer themselves and to Super Admins only.
CREATE TABLE public.customer_contacts (
  user_id uuid PRIMARY KEY REFERENCES public.customer_profiles(user_id) ON DELETE CASCADE,
  phone text NOT NULL CHECK (length(btrim(phone)) BETWEEN 6 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER customer_contacts_touch BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, UPDATE ON public.customer_contacts TO authenticated;
GRANT ALL ON public.customer_contacts TO service_role;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers read own phone" ON public.customer_contacts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Super admins read phones" ON public.customer_contacts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Customers update own phone" ON public.customer_contacts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Create the profile when someone signs up with full_name / phone / country in the signup metadata.
-- Accounts created without that metadata (e.g. staff created by a Super Admin) simply get no profile.
-- A missing or malformed profile never blocks signup; reserve_vehicle() refuses customers without one.
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text := btrim(coalesce(NEW.raw_user_meta_data ->> 'full_name', ''));
  p text := btrim(coalesce(NEW.raw_user_meta_data ->> 'phone', ''));
  c text := btrim(coalesce(NEW.raw_user_meta_data ->> 'country', ''));
BEGIN
  IF length(n) BETWEEN 1 AND 120 AND length(p) BETWEEN 6 AND 30 AND length(c) BETWEEN 1 AND 80 THEN
    INSERT INTO public.customer_profiles (user_id, full_name, country)
    VALUES (NEW.id, n, c)
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.customer_contacts (user_id, phone)
    VALUES (NEW.id, p)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_customer() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_customer AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  note text CHECK (note IS NULL OR length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservations_customer_idx ON public.reservations (customer_id, created_at DESC);
CREATE INDEX reservations_status_idx ON public.reservations (status, created_at DESC);
-- A vehicle can hold at most one live reservation at a time.
CREATE UNIQUE INDEX reservations_one_live_per_vehicle ON public.reservations (vehicle_id)
  WHERE status IN ('pending', 'confirmed');
CREATE TRIGGER reservations_touch BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, UPDATE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own reservations" ON public.reservations
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Admins read all reservations" ON public.reservations
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update reservations" ON public.reservations
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
-- No INSERT policy: customers reserve through reserve_vehicle() and cancel through cancel_reservation().

-- Keep vehicles.status in step with the reservation lifecycle.
CREATE OR REPLACE FUNCTION public.sync_vehicle_from_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('pending', 'confirmed') THEN
    UPDATE public.vehicles SET status = 'reserved' WHERE id = NEW.vehicle_id AND status = 'available';
  ELSIF NEW.status = 'completed' THEN
    UPDATE public.vehicles SET status = 'sold' WHERE id = NEW.vehicle_id;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.vehicles SET status = 'available' WHERE id = NEW.vehicle_id AND status = 'reserved';
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_vehicle_from_reservation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reservations_sync_vehicle AFTER INSERT OR UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_from_reservation();

-- Audit trail in the existing admin activity log (readable by Super Admins only).
CREATE OR REPLACE FUNCTION public.log_reservation_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.admin_activity (actor_id, actor_email, action, entity, entity_id, details)
  VALUES (
    auth.uid(), auth.jwt() ->> 'email',
    CASE WHEN TG_OP = 'INSERT' THEN 'reservation.created' ELSE 'reservation.' || NEW.status::text END,
    'reservation', NEW.id::text,
    jsonb_build_object('vehicle_id', NEW.vehicle_id, 'customer_id', NEW.customer_id, 'status', NEW.status)
  );
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_reservation_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reservations_log AFTER INSERT OR UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_change();

-- Customer actions -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_vehicle(_vehicle_id uuid, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  v public.vehicles%ROWTYPE;
  rid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in to reserve a vehicle.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_profiles WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Please complete your contact details before reserving.';
  END IF;
  IF (SELECT count(*) FROM public.reservations WHERE customer_id = uid AND status IN ('pending', 'confirmed')) >= 3 THEN
    RAISE EXCEPTION 'You already have 3 active reservations. Cancel one or contact us to add more.';
  END IF;

  SELECT * INTO v FROM public.vehicles WHERE id = _vehicle_id FOR UPDATE;
  IF NOT FOUND OR v.publish_state <> 'published' THEN
    RAISE EXCEPTION 'This vehicle is not available.';
  END IF;
  IF v.status <> 'available' THEN
    RAISE EXCEPTION 'Sorry, this vehicle has just been reserved or sold.';
  END IF;

  INSERT INTO public.reservations (vehicle_id, customer_id, note)
  VALUES (_vehicle_id, uid, nullif(btrim(_note), ''))
  RETURNING id INTO rid;
  RETURN rid;
END $$;
REVOKE EXECUTE ON FUNCTION public.reserve_vehicle(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_vehicle(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_reservation(_reservation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  r public.reservations%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in.';
  END IF;
  SELECT * INTO r FROM public.reservations WHERE id = _reservation_id FOR UPDATE;
  IF NOT FOUND OR (r.customer_id <> uid AND NOT public.is_admin(uid)) THEN
    RAISE EXCEPTION 'Reservation not found.';
  END IF;
  IF r.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'This reservation can no longer be cancelled.';
  END IF;
  UPDATE public.reservations SET status = 'cancelled' WHERE id = _reservation_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.cancel_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_reservation(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Inquiries (contact, vehicle inquiry, car request, dealer partner)
-- Written by the server with the service role only; read and worked by staff.
-- ---------------------------------------------------------------------------
CREATE TYPE public.inquiry_status AS ENUM ('new', 'contacted', 'closed');

CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('vehicle-inquiry', 'vehicle-request', 'dealer', 'contact')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  email text CHECK (email IS NULL OR length(email) <= 254),
  country text CHECK (country IS NULL OR length(country) <= 80),
  message text CHECK (message IS NULL OR length(message) <= 2000),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.inquiry_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inquiries_status_idx ON public.inquiries (status, created_at DESC);
CREATE INDEX inquiries_kind_idx ON public.inquiries (kind, created_at DESC);
CREATE TRIGGER inquiries_touch BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, UPDATE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read inquiries" ON public.inquiries
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update inquiries" ON public.inquiries
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- WhatsApp / phone numbers submitted through forms: Super Admins only, like customer phones.
-- (The server must also keep the number out of inquiries.payload.)
CREATE TABLE public.inquiry_contacts (
  inquiry_id uuid PRIMARY KEY REFERENCES public.inquiries(id) ON DELETE CASCADE,
  whatsapp text NOT NULL CHECK (length(whatsapp) <= 50)
);
GRANT SELECT ON public.inquiry_contacts TO authenticated;
GRANT ALL ON public.inquiry_contacts TO service_role;
ALTER TABLE public.inquiry_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read inquiry numbers" ON public.inquiry_contacts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
