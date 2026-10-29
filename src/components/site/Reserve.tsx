import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkCheck, CalendarCheck, Clock, Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { fetchCustomerDetails } from "@/lib/customer-details";
import { cn } from "@/lib/utils";
import { APPROVAL_HOURS, bookingErrorMessage, isUnderProcess, useNow } from "@/lib/bookings";
import { NotifyMeButton, UnderProcessTag } from "./WatchCar";
import { btn } from "./primitives";
import { confirmDialog } from "./ConfirmDialog";

/**
 * Who can reserve, and which cars this customer already holds.
 * A customer can reserve once signed in AND approved by an admin (approval = profiles.phone_verified).
 */
export function useReservations() {
  const { user, ready } = useCustomer();
  const qc = useQueryClient();
  const router = useRouter();

  const details = useQuery({
    queryKey: ["customer-details", user?.id],
    enabled: !!user,
    queryFn: () => fetchCustomerDetails(user!.id),
  });

  const mine = useQuery({
    queryKey: ["my-active-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id, vehicle_id, status").eq("user_id", user!.id).in("status", ["pending", "confirmed"]);
      if (error) throw error;
      return new Map(data.map((b) => [b.vehicle_id, b]));
    },
  });

  const reserve = useMutation({
    mutationFn: async (input: { vehicleId: string; destination?: string; contactMethod?: string; message?: string }) => {
      if (!user) throw new Error("Please sign in first.");
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id, vehicle_id: input.vehicleId,
        destination: input.destination?.trim() || null, contact_method: input.contactMethod ?? "whatsapp", message: input.message?.trim() || null,
      });
      if (error) throw new Error(bookingErrorMessage(error));
    },
    onSuccess: async () => {
      toast.success(`Booking sent — pending approval. Our team has ${APPROVAL_HOURS} hours to approve it.`);
      await qc.invalidateQueries();
      await router.invalidate(); // refresh car lists so the Under process tag shows
    },
    onError: async (e: Error) => { toast.error(e.message); await qc.invalidateQueries(); },
  });

  const d = details.data;
  return {
    ready: ready && (!user || (!details.isLoading && !mine.isLoading)),
    signedIn: !!user,
    approved: !!d && d.phoneVerified, // approval by an admin is all that is needed (same rule as the database)
    mine: mine.data ?? new Map<string, { id: string; vehicle_id: string; status: string }>(),
    reserve,
  };
}

/** Booking control for listing cards. Under-process cars offer "Notify me" to everyone else. */
export function ReserveOnCard({ vehicleId, status, holdUntil, name }: { vehicleId: string; status: string; holdUntil?: string | null; name: string }) {
  const r = useReservations();
  const now = useNow(60_000);
  if (!r.ready) return null;

  const mine = r.mine.get(vehicleId);
  if (mine) {
    const pending = mine.status === "pending";
    return (
      <Link to="/account" hash="bookings" className={cn("mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-sm px-3 py-2 text-xs font-bold uppercase tracking-wider",
        pending ? "bg-champagne/30 text-foreground hover:bg-champagne/45" : "bg-emerald-600/12 text-emerald-800 hover:bg-emerald-600/20")}>
        {pending ? <><Clock className="h-3.5 w-3.5" /> Pending approval</> : <><BookmarkCheck className="h-3.5 w-3.5" /> Reserved for you</>}
      </Link>
    );
  }
  if (isUnderProcess({ status, holdUntil }, now)) return <NotifyMeButton vehicleId={vehicleId} compact className="mt-3 w-full" />;
  if (status !== "available" || !r.signedIn || !r.approved) return null;

  const busy = r.reserve.isPending && r.reserve.variables?.vehicleId === vehicleId;
  return (
    <button
      type="button"
      disabled={r.reserve.isPending}
      onClick={async () => {
        const ok = await confirmDialog({
          title: `Book the ${name}?`, confirmLabel: "Book this car",
          description: `The car is held for you while our team approves your booking. If it isn't approved within ${APPROVAL_HOURS} hours, it's cancelled automatically. Booking is free and you can cancel any time.`,
        });
        if (ok) r.reserve.mutate({ vehicleId });
      }}
      className={cn(btn({ variant: "primary", size: "sm" }), "mt-3 w-full")}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Book this car
    </button>
  );
}

/** Image tag for a car on hold: "Pending approval" for the customer who booked it, "Under process" for everyone else. */
export function HoldTag({ vehicleId, className }: { vehicleId: string; className?: string }) {
  const r = useReservations();
  if (r.mine.get(vehicleId)?.status === "pending") {
    return <span className={cn("inline-flex items-center gap-1 rounded-sm bg-champagne px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-ink", className)}><Clock className="h-3 w-3" /> Pending approval</span>;
  }
  return <UnderProcessTag className={className} />;
}
