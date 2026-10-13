-- Builds on 0002 (profiles, bookings, staff_permissions):
--  1. every customer gets an auto-generated, unchangeable customer ID (AHM-000001 ...)
--  2. phone numbers become readable only by the customer themselves and Super Admins,
--     so staff who may view customers/bookings can still see who someone is, but not their number
--  3. signup details (phone, country) are copied into the profile by the signup trigger

-- 1. Customer IDs ------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.customer_number_seq;
ALTER TABLE public.profiles
  ADD COLUMN customer_number text DEFAULT ('AHM-' || lpad(nextval('public.customer_number_seq')::text, 6, '0'));
ALTER TABLE public.profiles ALTER COLUMN customer_number SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_customer_number_key UNIQUE (customer_number);
ALTER SEQUENCE public.customer_number_seq OWNED BY public.profiles.customer_number;

-- Extends the existing guard: customers can never choose or change their ID.
CREATE OR REPLACE FUNCTION public.profiles_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.phone_verified := false;
      NEW.customer_number := 'AHM-' || lpad(nextval('public.customer_number_seq')::text, 6, '0');
    ELSE
      IF NEW.phone IS DISTINCT FROM OLD.phone THEN NEW.phone_verified := false;
      ELSE NEW.phone_verified := OLD.phone_verified; END IF;
      NEW.customer_number := OLD.customer_number;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- 2. Phone privacy ------------------------------------------------------------
-- Column-level privileges: the phone column can no longer be selected through the API.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, phone_verified, country, customer_number, created_at, updated_at)
  ON public.profiles TO authenticated;

-- The only way to read phone numbers: your own, or any customer's if you are a Super Admin.
CREATE OR REPLACE FUNCTION public.get_customer_phones(_user_ids uuid[])
RETURNS TABLE (user_id uuid, phone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.phone FROM public.profiles p
  WHERE p.id = ANY(_user_ids)
    AND (p.id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'))
$$;
REVOKE EXECUTE ON FUNCTION public.get_customer_phones(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_phones(uuid[]) TO authenticated;

-- 3. Signup details -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text := nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'full_name', '')), '');
  c text := nullif(btrim(coalesce(NEW.raw_user_meta_data ->> 'country', '')), '');
  p text := btrim(coalesce(NEW.raw_user_meta_data ->> 'phone', ''));
BEGIN
  IF p !~ '^\+?[0-9 ().-]{6,30}$' THEN p := NULL; END IF;
  INSERT INTO public.profiles (id, full_name, country, phone)
  VALUES (NEW.id, left(n, 120), left(c, 80), p)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
