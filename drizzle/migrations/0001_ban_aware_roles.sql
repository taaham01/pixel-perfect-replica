CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN auth.users u ON u.id = r.user_id
    WHERE r.user_id = _user_id AND r.role = _role
      AND (u.banned_until IS NULL OR u.banned_until < now())
  )
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    JOIN auth.users u ON u.id = r.user_id
    WHERE r.user_id = _user_id AND (u.banned_until IS NULL OR u.banned_until < now())
  )
$$;