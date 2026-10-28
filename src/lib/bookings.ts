import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Staff have this long to approve a booking before it is cancelled automatically (set in the database: booking_approval_window). */
export const APPROVAL_HOURS = 24;
export const APPROVAL_MS = APPROVAL_HOURS * 60 * 60 * 1000;

/** A car is "under process" while a customer's booking is waiting for staff approval. */
export function isUnderProcess(v: { status: string; holdUntil?: string | null }, now = Date.now()) {
  return v.status === "available" && !!v.holdUntil && new Date(v.holdUntil).getTime() > now;
}

/** Re-renders every `ms` so countdowns stay current. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** "5h 12m", "42m", "under a minute" — time left until `until`, or null when it has passed. */
export function timeLeft(until: string | null | undefined, now = Date.now()) {
  if (!until) return null;
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return null;
  const mins = Math.floor(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const label = mins < 1 ? "under a minute" : h ? `${h}h ${m}m` : `${m}m`;
  return { ms, label, urgent: ms < 2 * 60 * 60 * 1000 };
}

/** Cancel bookings nobody approved in time (the database also does this every few minutes). */
export async function expireOverdueBookings(vehicleId?: string) {
  const { error } = await supabase.rpc("expire_pending_bookings", vehicleId ? { _vehicle_id: vehicleId } : {});
  if (error) console.warn("expire_pending_bookings", error.message);
}

/** Friendly message for a failed booking insert. */
export function bookingErrorMessage(error: { message: string; code?: string }) {
  const m = error.message;
  if (m.includes("active bookings") || m.includes("reserved by another") || m.includes("under process")) return m;
  if (error.code === "23505") return "You've already booked this car.";
  return "We couldn't book this car. It may have just been booked by someone else, or your account isn't approved yet.";
}
