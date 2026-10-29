-- Bookings now need staff approval.
--  * A customer's booking arrives as "pending" and holds the car for 24 hours.
--    While held, other customers see the car as "Under process" and cannot book it.
--  * An Admin / Super Admin approves it -> booking "confirmed", car "reserved".
--  * Not approved in time -> booking auto-cancelled ("expired"), car is free again.
--  * Staff can extend the 24-hour window.
--  * Other customers can ask to be notified; when a held car becomes free again they get
--    an on-site message. The booking customer also gets a message when approved / expired.
-- Safe to run more than once.

-- How long staff have to approve a booking. Change here only.
CREATE OR REPLACE FUNCTION public.booking_approval_window() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '24 hours' $$;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cancel_reason text;
DO $$ BEGIN
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_cancel_reason_check
    CHECK (cancel_reason IS NULL OR cancel_reason IN ('expired', 'customer', 'staff'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS bookings_pending_expiry_idx ON public.bookings (expires_at) WHERE status = 'pending';

-- Public "under process" marker on the car: end of the current approval window, or null.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS hold_until timestamptz;

-- Older pending requests get a fresh window.
UPDATE public.bookings SET expires_at = now() + public.booking_approval_window()
  WHERE status = 'pending' AND expires_at IS NULL;

-- Internal flag so automatic changes (expiry) are not treated as customer edits.
CREATE OR REPLACE FUNCTION public.booking_system_change() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('app.booking_system', true), '') = 'on' $$;

-- ---------------------------------------------------------------------------------------
-- Guard: new bookings wait for approval; only one customer can hold a car at a time.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bookings_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  car_status public.vehicle_status;
  is_staff boolean := auth.uid() IS NULL OR public.booking_system_change() OR public.has_perm(auth.uid(), 'bookings');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.bookings WHERE user_id = NEW.user_id AND status IN ('pending', 'confirmed')) >= 5 THEN
      RAISE EXCEPTION 'You already have 5 active bookings. Please cancel one first.';
    END IF;
    -- Lock the car so two customers can't book it at the same moment.
    SELECT status INTO car_status FROM public.vehicles WHERE id = NEW.vehicle_id FOR UPDATE;
    PERFORM public.expire_pending_bookings(NEW.vehicle_id); -- release an overdue hold first
    IF car_status IS DISTINCT FROM 'available'
       OR EXISTS (SELECT 1 FROM public.bookings WHERE vehicle_id = NEW.vehicle_id AND status = 'confirmed') THEN
      RAISE EXCEPTION 'This car has just been reserved by another customer.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.bookings WHERE vehicle_id = NEW.vehicle_id AND status = 'pending' AND expires_at > now()) THEN
      RAISE EXCEPTION 'This car is under process for another customer.';
    END IF;
    NEW.status := 'pending';
    NEW.expires_at := now() + public.booking_approval_window();
    NEW.staff_note := NULL; NEW.cancel_reason := NULL; NEW.approved_at := NULL; NEW.approved_by := NULL;
  ELSE
    -- What the customer wrote never changes.
    NEW.user_id := OLD.user_id; NEW.vehicle_id := OLD.vehicle_id; NEW.message := OLD.message; NEW.created_at := OLD.created_at;
    NEW.destination := OLD.destination; NEW.contact_method := OLD.contact_method;

    IF NOT is_staff THEN
      -- Customers can only cancel (enforced by the row policy) and touch nothing else.
      NEW.staff_note := OLD.staff_note; NEW.expires_at := OLD.expires_at;
      NEW.approved_at := OLD.approved_at; NEW.approved_by := OLD.approved_by;
      NEW.cancel_reason := CASE WHEN NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN 'customer' ELSE OLD.cancel_reason END;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status IN ('pending', 'confirmed') THEN
        SELECT status INTO car_status FROM public.vehicles WHERE id = NEW.vehicle_id FOR UPDATE;
        IF car_status = 'sold' THEN RAISE EXCEPTION 'This car is already sold.'; END IF;
        IF EXISTS (SELECT 1 FROM public.bookings WHERE vehicle_id = NEW.vehicle_id AND id <> NEW.id AND status = 'confirmed') THEN
          RAISE EXCEPTION 'Another customer already holds a confirmed reservation on this car.';
        END IF;
      END IF;
      IF NEW.status = 'confirmed' THEN
        IF OLD.status = 'pending' AND OLD.expires_at <= now() AND NOT public.booking_system_change() THEN
          RAISE EXCEPTION 'This booking expired before it was approved. Extend it first, or ask the customer to book again.';
        END IF;
        IF OLD.status <> 'pending' AND EXISTS (SELECT 1 FROM public.bookings WHERE vehicle_id = NEW.vehicle_id AND id <> NEW.id AND status = 'pending' AND expires_at > now()) THEN
          RAISE EXCEPTION 'Another customer''s booking for this car is waiting for approval.';
        END IF;
        NEW.approved_at := now(); NEW.approved_by := auth.uid(); NEW.cancel_reason := NULL;
      ELSIF NEW.status = 'pending' THEN
        IF EXISTS (SELECT 1 FROM public.bookings WHERE vehicle_id = NEW.vehicle_id AND id <> NEW.id AND status = 'pending' AND expires_at > now()) THEN
          RAISE EXCEPTION 'Another customer''s booking for this car is waiting for approval.';
        END IF;
        NEW.expires_at := now() + public.booking_approval_window(); NEW.cancel_reason := NULL;
      ELSIF NEW.status = 'cancelled' THEN
        NEW.cancel_reason := coalesce(NEW.cancel_reason, 'staff');
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_guard ON public.bookings;
CREATE TRIGGER bookings_guard BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_guard();

-- New bookings no longer reserve the car straight away.
DROP TRIGGER IF EXISTS bookings_reserve_vehicle ON public.bookings;

-- Customers may book while the car is available (status stays "available" while under process).
DROP POLICY IF EXISTS "Verified customers book" ON public.bookings;
CREATE POLICY "Verified customers book" ON public.bookings FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND status IN ('pending', 'confirmed')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.phone_verified)
  AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.publish_state = 'published' AND v.status = 'available'));

-- ---------------------------------------------------------------------------------------
-- Keep the car's "under process" marker in step with its pending bookings.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bookings_sync_hold() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE vid uuid; h timestamptz;
BEGIN
  IF TG_OP = 'DELETE' THEN vid := OLD.vehicle_id; ELSE vid := NEW.vehicle_id; END IF;
  SELECT max(expires_at) INTO h FROM public.bookings WHERE vehicle_id = vid AND status = 'pending';
  UPDATE public.vehicles SET hold_until = h WHERE id = vid AND hold_until IS DISTINCT FROM h;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS bookings_sync_hold ON public.bookings;
CREATE TRIGGER bookings_sync_hold AFTER INSERT OR DELETE OR UPDATE OF status, expires_at ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_sync_hold();

-- Changes to the hold marker alone are not worth an activity-log entry.
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
       AND (NEW.primary_image_path IS DISTINCT FROM OLD.primary_image_path OR NEW.hold_until IS DISTINCT FROM OLD.hold_until) THEN
      RETURN NULL; -- cover sync / booking hold only, not worth logging
    END IF;
  END IF;
  INSERT INTO public.admin_activity (actor_id, actor_email, action, entity, entity_id, details)
  VALUES (auth.uid(), auth.jwt() ->> 'email', act, 'vehicle', coalesce(NEW.id, OLD.id)::text, d);
  RETURN NULL;
END $$;

-- ---------------------------------------------------------------------------------------
-- Expiry: cancel bookings nobody approved in time. Runs every 5 minutes (pg_cron) and
-- whenever the website loads booking information, so it works even without pg_cron.
-- ---------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_pending_bookings(_vehicle_id uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; was text := coalesce(current_setting('app.booking_system', true), '');
BEGIN
  PERFORM set_config('app.booking_system', 'on', true);
  UPDATE public.bookings SET status = 'cancelled', cancel_reason = 'expired'
   WHERE status = 'pending' AND expires_at <= now() AND (_vehicle_id IS NULL OR vehicle_id = _vehicle_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('app.booking_system', was, true);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.expire_pending_bookings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_pending_bookings(uuid) TO anon, authenticated, service_role;

-- Staff: give a pending booking another full approval window.
CREATE OR REPLACE FUNCTION public.extend_booking(_booking_id uuid) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t timestamptz;
BEGIN
  IF NOT public.has_perm(auth.uid(), 'bookings') THEN
    RAISE EXCEPTION 'You do not have permission to manage bookings.';
  END IF;
  UPDATE public.bookings SET expires_at = greatest(expires_at, now()) + public.booking_approval_window()
   WHERE id = _booking_id AND status = 'pending'
   RETURNING expires_at INTO t;
  IF t IS NULL THEN RAISE EXCEPTION 'Only bookings waiting for approval can be extended.'; END IF;
  RETURN t;
END $$;
REVOKE ALL ON FUNCTION public.extend_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extend_booking(uuid) TO authenticated, service_role;

-- (The pg_cron block from the source file is scheduled separately with the scheduler tool,
--  because reading cron.job from migration SQL is not permitted.)

-- ---------------------------------------------------------------------------------------
-- "Notify me" list and on-site messages.
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_watchers (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vehicle_id)
);
CREATE INDEX IF NOT EXISTS vehicle_watchers_vehicle_idx ON public.vehicle_watchers (vehicle_id);
ALTER TABLE public.vehicle_watchers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vehicle_watchers FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.vehicle_watchers TO authenticated;
GRANT ALL ON public.vehicle_watchers TO service_role;
DROP POLICY IF EXISTS "Watchers read" ON public.vehicle_watchers;
CREATE POLICY "Watchers read" ON public.vehicle_watchers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_perm(auth.uid(), 'bookings'));
DROP POLICY IF EXISTS "Watchers add own" ON public.vehicle_watchers;
CREATE POLICY "Watchers add own" ON public.vehicle_watchers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (SELECT count(*) FROM public.vehicle_watchers w WHERE w.user_id = auth.uid()) < 30);
DROP POLICY IF EXISTS "Watchers remove own" ON public.vehicle_watchers;
CREATE POLICY "Watchers remove own" ON public.vehicle_watchers FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
DROP POLICY IF EXISTS "Own notifications read" ON public.notifications;
CREATE POLICY "Own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Own notifications mark read" ON public.notifications;
CREATE POLICY "Own notifications mark read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Messages when a booking changes. Named so it runs after bookings_sync_vehicle
-- (triggers fire in name order), so the car's status is already up to date.
CREATE OR REPLACE FUNCTION public.bookings_z_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE car record; label text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  SELECT id, year, make, model, stock_id, status INTO car FROM public.vehicles WHERE id = NEW.vehicle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  label := concat_ws(' ', car.year, car.make, car.model) || ' (Stock ' || car.stock_id || ')';

  -- Tell the booking customer what happened.
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, vehicle_id) VALUES (NEW.user_id, 'booking_approved',
      'Booking approved', 'Your booking for the ' || label || ' has been approved. The car is now reserved in your name and our team will contact you.', NEW.vehicle_id);
  ELSIF NEW.status = 'cancelled' AND NEW.cancel_reason = 'expired' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, vehicle_id) VALUES (NEW.user_id, 'booking_expired',
      'Booking request expired', 'Your booking request for the ' || label || ' was not approved in time and has been cancelled. If the car is still available you can book it again.', NEW.vehicle_id);
  ELSIF NEW.status = 'cancelled' AND NEW.cancel_reason = 'staff' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, vehicle_id) VALUES (NEW.user_id, 'booking_cancelled',
      'Booking cancelled', 'Your booking for the ' || label || ' was cancelled by our team.' || coalesce(' Message: ' || NEW.staff_note, ''), NEW.vehicle_id);
  END IF;

  -- The car is free again: tell everyone who asked to be notified.
  IF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'confirmed') AND car.status = 'available'
     AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.vehicle_id = NEW.vehicle_id AND b.id <> NEW.id
                     AND (b.status = 'confirmed' OR (b.status = 'pending' AND b.expires_at > now()))) THEN
    INSERT INTO public.notifications (user_id, kind, title, body, vehicle_id)
      SELECT w.user_id, 'car_available', 'Car available again',
             'Good news — the ' || label || ' is available again. Book it now before someone else does.', NEW.vehicle_id
        FROM public.vehicle_watchers w WHERE w.vehicle_id = NEW.vehicle_id AND w.user_id <> NEW.user_id;
    DELETE FROM public.vehicle_watchers WHERE vehicle_id = NEW.vehicle_id;
  ELSIF NEW.status = 'completed' THEN
    INSERT INTO public.notifications (user_id, kind, title, body, vehicle_id)
      SELECT w.user_id, 'car_sold', 'Car sold', 'The ' || label || ' you were following has been sold. Ask us and we''ll find you a similar one.', NEW.vehicle_id
        FROM public.vehicle_watchers w WHERE w.vehicle_id = NEW.vehicle_id AND w.user_id <> NEW.user_id;
    DELETE FROM public.vehicle_watchers WHERE vehicle_id = NEW.vehicle_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS bookings_z_notify ON public.bookings;
CREATE TRIGGER bookings_z_notify AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_z_notify();

-- Bring the hold marker up to date for bookings that already exist.
UPDATE public.vehicles v SET hold_until = h.until
  FROM (SELECT vehicle_id, max(expires_at) AS until FROM public.bookings WHERE status = 'pending' GROUP BY vehicle_id) h
 WHERE v.id = h.vehicle_id AND v.hold_until IS DISTINCT FROM h.until;