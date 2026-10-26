-- Bookings become reservations: customers add their destination and preferred contact,
-- can cancel their own booking, and the car's availability follows the booking status.
-- Safe to run more than once.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS destination text CHECK (destination IS NULL OR length(destination) <= 120);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_method text CHECK (contact_method IS NULL OR contact_method IN ('whatsapp', 'phone', 'email'));

-- One active booking per customer per car.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_active_per_car
  ON public.bookings (user_id, vehicle_id) WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS bookings_vehicle_idx ON public.bookings (vehicle_id);

-- Customers may cancel their own pending or confirmed booking (and nothing else).
DROP POLICY IF EXISTS "Customers cancel own bookings" ON public.bookings;
CREATE POLICY "Customers cancel own bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('pending', 'confirmed'))
  WITH CHECK (user_id = auth.uid() AND status = 'cancelled');

-- Guard: on insert cap active bookings per customer; on update keep what the customer wrote,
-- and only staff can change the team message.
CREATE OR REPLACE FUNCTION public.bookings_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.bookings WHERE user_id = NEW.user_id AND status IN ('pending', 'confirmed')) >= 5 THEN
      RAISE EXCEPTION 'You already have 5 active bookings. Please wait for our team or cancel one first.';
    END IF;
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

-- Keep the car's availability in step with its bookings:
-- confirmed -> reserved, completed -> sold, and back to available when no confirmed booking is left.
CREATE OR REPLACE FUNCTION public.bookings_sync_vehicle() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'confirmed' THEN
    UPDATE public.vehicles SET status = 'reserved' WHERE id = NEW.vehicle_id AND status = 'available';
  ELSIF NEW.status = 'completed' THEN
    UPDATE public.vehicles SET status = 'sold' WHERE id = NEW.vehicle_id AND status <> 'sold';
  ELSIF OLD.status = 'confirmed' THEN
    IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE vehicle_id = NEW.vehicle_id AND status = 'confirmed' AND id <> NEW.id) THEN
      UPDATE public.vehicles SET status = 'available' WHERE id = NEW.vehicle_id AND status = 'reserved';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_sync_vehicle ON public.bookings;
CREATE TRIGGER bookings_sync_vehicle AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_sync_vehicle();
