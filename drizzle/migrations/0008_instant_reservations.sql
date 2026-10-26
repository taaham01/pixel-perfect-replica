-- Approved customers reserve a car instantly: a new booking is created as a confirmed
-- reservation and the car becomes "reserved" at once. Only one customer can hold a car.
-- Safe to run more than once.

-- A new booking arrives as 'pending' from the website and is turned into a reservation by the
-- trigger below, so the insert rule must accept the final 'confirmed' status too.
DROP POLICY IF EXISTS "Verified customers book" ON public.bookings;
CREATE POLICY "Verified customers book" ON public.bookings FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND status IN ('pending', 'confirmed')
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.phone_verified)
  AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.publish_state = 'published' AND v.status = 'available'));

CREATE OR REPLACE FUNCTION public.bookings_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE car_status public.vehicle_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.bookings WHERE user_id = NEW.user_id AND status IN ('pending', 'confirmed')) >= 5 THEN
      RAISE EXCEPTION 'You already have 5 active reservations. Please cancel one first.';
    END IF;
    -- Lock the car so two customers can't reserve it at the same moment.
    SELECT status INTO car_status FROM public.vehicles WHERE id = NEW.vehicle_id FOR UPDATE;
    IF car_status IS DISTINCT FROM 'available'
       OR EXISTS (SELECT 1 FROM public.bookings WHERE vehicle_id = NEW.vehicle_id AND status = 'confirmed') THEN
      RAISE EXCEPTION 'This car has just been reserved by another customer.';
    END IF;
    NEW.status := 'confirmed';
    NEW.staff_note := NULL;
  ELSE
    NEW.user_id := OLD.user_id; NEW.vehicle_id := OLD.vehicle_id; NEW.message := OLD.message; NEW.created_at := OLD.created_at;
    NEW.destination := OLD.destination; NEW.contact_method := OLD.contact_method;
    IF auth.uid() IS NOT NULL AND NOT public.has_perm(auth.uid(), 'bookings') THEN
      NEW.staff_note := OLD.staff_note;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_guard ON public.bookings;
CREATE TRIGGER bookings_guard BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_guard();

-- Mark the car reserved as soon as the reservation is created.
CREATE OR REPLACE FUNCTION public.bookings_reserve_vehicle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    UPDATE public.vehicles SET status = 'reserved' WHERE id = NEW.vehicle_id AND status = 'available';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_reserve_vehicle ON public.bookings;
CREATE TRIGGER bookings_reserve_vehicle AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_reserve_vehicle();
