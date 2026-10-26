-- Inquiries: record who closed each one and when, let staff reply, and let signed-in
-- customers ask questions from their account and read the team's replies.
-- Safe to run more than once.

ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS closed_by uuid;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS closed_by_email text;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS reply text CHECK (reply IS NULL OR length(reply) <= 4000);
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS replied_at timestamptz;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS replied_by_email text;

-- New form kind: questions customers send from their account.
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_kind_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_kind_check
  CHECK (kind IN ('vehicle-inquiry', 'vehicle-request', 'dealer', 'contact', 'question'));

-- Visitors can't fill in staff-only fields.
DROP POLICY IF EXISTS "Anyone can send an inquiry" ON public.inquiries;
CREATE POLICY "Anyone can send an inquiry" ON public.inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new' AND staff_note IS NULL AND reply IS NULL AND closed_by IS NULL
    AND (user_id IS NULL OR user_id = auth.uid())
    AND (kind <> 'question' OR user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.inquiries_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.email := lower(btrim(NEW.email));
    IF (SELECT count(*) FROM public.inquiries WHERE email = NEW.email AND created_at > now() - interval '10 minutes') >= 5 THEN
      RAISE EXCEPTION 'Too many messages. Please wait a few minutes and try again.';
    END IF;
    NEW.closed_at := NULL; NEW.closed_by := NULL; NEW.closed_by_email := NULL;
    NEW.reply := NULL; NEW.replied_at := NULL; NEW.replied_by_email := NULL;
  ELSE
    -- What the visitor wrote never changes.
    NEW.kind := OLD.kind; NEW.name := OLD.name; NEW.email := OLD.email; NEW.phone := OLD.phone;
    NEW.country := OLD.country; NEW.subject := OLD.subject; NEW.message := OLD.message; NEW.details := OLD.details;
    NEW.vehicle_id := OLD.vehicle_id; NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at;
    SELECT email INTO actor_email FROM auth.users WHERE id = auth.uid();
    -- Record who closed it and when; clear it if reopened.
    IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
      NEW.closed_at := now(); NEW.closed_by := auth.uid(); NEW.closed_by_email := actor_email;
    ELSIF NEW.status <> 'closed' THEN
      NEW.closed_at := NULL; NEW.closed_by := NULL; NEW.closed_by_email := NULL;
    ELSE
      NEW.closed_at := OLD.closed_at; NEW.closed_by := OLD.closed_by; NEW.closed_by_email := OLD.closed_by_email;
    END IF;
    -- Record who replied and when.
    IF NEW.reply IS DISTINCT FROM OLD.reply THEN
      NEW.replied_at := CASE WHEN NEW.reply IS NULL THEN NULL ELSE now() END;
      NEW.replied_by_email := CASE WHEN NEW.reply IS NULL THEN NULL ELSE actor_email END;
    ELSE
      NEW.replied_at := OLD.replied_at; NEW.replied_by_email := OLD.replied_by_email;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.admin_activity (actor_id, actor_email, action, entity, entity_id, details)
      VALUES (auth.uid(), actor_email, 'inquiry.' || NEW.status, 'inquiry', NEW.id::text,
              jsonb_build_object('from', OLD.status, 'name', NEW.name, 'email', NEW.email));
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS inquiries_guard ON public.inquiries;
CREATE TRIGGER inquiries_guard BEFORE INSERT OR UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.inquiries_guard();

-- Customers read their own questions and the team's replies (never staff notes or who handled it).
CREATE OR REPLACE FUNCTION public.my_inquiries()
RETURNS TABLE (id uuid, kind text, subject text, message text, status public.inquiry_status,
               reply text, replied_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.kind, i.subject, i.message, i.status, i.reply, i.replied_at, i.created_at
  FROM public.inquiries i WHERE i.user_id = auth.uid() ORDER BY i.created_at DESC LIMIT 100
$$;
REVOKE EXECUTE ON FUNCTION public.my_inquiries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_inquiries() TO authenticated;
