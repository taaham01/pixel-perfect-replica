-- Website form submissions (Contact, Request a Car, For Dealers, vehicle inquiries).
-- Anyone can submit; only staff can read and update. Safe to run more than once.

DO $$ BEGIN
  CREATE TYPE public.inquiry_status AS ENUM ('new', 'contacted', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('vehicle-inquiry', 'vehicle-request', 'dealer', 'contact')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254 AND email LIKE '%@%'),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  country text CHECK (country IS NULL OR length(country) <= 80),
  subject text CHECK (subject IS NULL OR length(subject) <= 200),
  message text CHECK (message IS NULL OR length(message) <= 4000),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object' AND pg_column_size(details) <= 8000),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  user_id uuid,
  status public.inquiry_status NOT NULL DEFAULT 'new',
  staff_note text CHECK (staff_note IS NULL OR length(staff_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_created_idx ON public.inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON public.inquiries (status);

GRANT INSERT ON public.inquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can send an inquiry" ON public.inquiries;
CREATE POLICY "Anyone can send an inquiry" ON public.inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new' AND staff_note IS NULL AND (user_id IS NULL OR user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff read inquiries" ON public.inquiries;
CREATE POLICY "Staff read inquiries" ON public.inquiries
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Staff update inquiries" ON public.inquiries;
CREATE POLICY "Staff update inquiries" ON public.inquiries
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- On insert: limit floods (max 5 per email per 10 minutes). On update: staff may only change status and note.
CREATE OR REPLACE FUNCTION public.inquiries_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.email := lower(btrim(NEW.email));
    IF (SELECT count(*) FROM public.inquiries WHERE email = NEW.email AND created_at > now() - interval '10 minutes') >= 5 THEN
      RAISE EXCEPTION 'Too many messages. Please wait a few minutes and try again.';
    END IF;
  ELSE
    NEW.kind := OLD.kind; NEW.name := OLD.name; NEW.email := OLD.email; NEW.phone := OLD.phone;
    NEW.country := OLD.country; NEW.subject := OLD.subject; NEW.message := OLD.message; NEW.details := OLD.details;
    NEW.vehicle_id := OLD.vehicle_id; NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS inquiries_guard ON public.inquiries;
CREATE TRIGGER inquiries_guard BEFORE INSERT OR UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.inquiries_guard();
