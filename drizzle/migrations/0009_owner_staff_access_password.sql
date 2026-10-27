-- Owner-only: change the staff sign-up access password from Settings.
-- The password is stored only as a bcrypt hash. Only taaham01@gmail.com (confirmed email,
-- Super Admin, re-entering their own account password) can change it. Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.app_secrets (
  name text PRIMARY KEY,
  secret_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- No policies: nobody can read or write this table through the API.
REVOKE ALL ON public.app_secrets FROM anon, authenticated;
GRANT ALL ON public.app_secrets TO service_role;

-- True only for the primary owner account (confirmed email, Super Admin).
CREATE OR REPLACE FUNCTION public.is_primary_owner(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id AND lower(u.email) = 'taaham01@gmail.com' AND u.email_confirmed_at IS NOT NULL
  ) AND public.has_role(_user_id, 'super_admin');
$$;
REVOKE ALL ON FUNCTION public.is_primary_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_primary_owner(uuid) TO authenticated, service_role;

-- Owner changes the staff access password. Their own account password is checked first.
CREATE OR REPLACE FUNCTION public.set_staff_access_password(_account_password text, _new_password text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid := auth.uid(); stored text; changed timestamptz;
BEGIN
  IF uid IS NULL OR NOT public.is_primary_owner(uid) THEN
    RAISE EXCEPTION 'Only the owner can change the staff access password.';
  END IF;
  SELECT encrypted_password INTO stored FROM auth.users WHERE id = uid;
  IF stored IS NULL OR extensions.crypt(coalesce(_account_password, ''), stored) <> stored THEN
    PERFORM pg_sleep(1);
    RAISE EXCEPTION 'Your account password is incorrect.';
  END IF;
  IF _new_password IS NULL OR length(_new_password) < 12 OR length(_new_password) > 72
     OR _new_password !~ '[a-z]' OR _new_password !~ '[A-Z]' OR _new_password !~ '[0-9]' OR _new_password !~ '[^A-Za-z0-9]' THEN
    RAISE EXCEPTION 'The new access password must be 12–72 characters with upper- and lower-case letters, a number and a symbol.';
  END IF;
  INSERT INTO public.app_secrets (name, secret_hash, updated_at, updated_by)
  VALUES ('staff_signup_password', extensions.crypt(_new_password, extensions.gen_salt('bf', 12)), now(), uid)
  ON CONFLICT (name) DO UPDATE SET secret_hash = EXCLUDED.secret_hash, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  RETURNING updated_at INTO changed;
  RETURN changed;
END $$;
REVOKE ALL ON FUNCTION public.set_staff_access_password(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_access_password(text, text) TO authenticated;

-- When the access password was last changed (owner only; never returns the password).
CREATE OR REPLACE FUNCTION public.staff_access_password_changed_at() RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_primary_owner(auth.uid()) THEN RETURN NULL; END IF;
  RETURN (SELECT updated_at FROM public.app_secrets WHERE name = 'staff_signup_password');
END $$;
REVOKE ALL ON FUNCTION public.staff_access_password_changed_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_access_password_changed_at() TO authenticated;

-- Server-only check used by staff sign-up. NULL means no password has been set here yet.
CREATE OR REPLACE FUNCTION public.verify_staff_access(_input text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE h text;
BEGIN
  SELECT secret_hash INTO h FROM public.app_secrets WHERE name = 'staff_signup_password';
  IF h IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.crypt(coalesce(_input, ''), h) = h;
END $$;
REVOKE ALL ON FUNCTION public.verify_staff_access(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_staff_access(text) TO service_role;
