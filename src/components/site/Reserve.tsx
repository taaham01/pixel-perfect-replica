import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkCheck, CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { fetchCustomerDetails } from "@/lib/customer-details";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";

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
      if (error) {
        if (error.message.includes("active reservations") || error.message.includes("reserved by another")) throw new Error(error.message);
        if (error.code === "23505") throw new Error("You've already reserved this car.");
        throw new Error("We couldn't reserve this car. It may have just been reserved by someone else.");
      }
    },
    onSuccess: async () => {
      toast.success("Car reserved for you. It's now in My bookings — our team will contact you shortly.");
      await qc.invalidateQueries();
      await router.invalidate(); // refresh car lists so the Reserved badge shows
    },
    onError: async (e: Error) => { toast.error(e.message); await qc.invalidateQueries(); },
  });

  const d = details.data;
  return {
    ready: ready && (!user || (!details.isLoading && !mine.isLoading)),
    signedIn: !!user,
    approved: !!d && !!d.phone && d.phoneVerified,
    mine: mine.data ?? new Map<string, { id: string; vehicle_id: string; status: string }>(),
    reserve,
  };
}

/** Small reserve control for listing cards: only for signed-in, approved customers. */
export function ReserveOnCard({ vehicleId, status, name }: { vehicleId: string; status: string; name: string }) {
  const r = useReservations();
  if (!r.ready || !r.signedIn || !r.approved) return null;

  if (r.mine.has(vehicleId)) {
    return (
      <Link to="/account" hash="bookings" className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-sm bg-emerald-600/12 px-3 py-2 text-xs font-bold uppercase tracking-wider text-emerald-800 hover:bg-emerald-600/20">
        <BookmarkCheck className="h-3.5 w-3.5" /> Reserved by you
      </Link>
    );
  }
  if (status !== "available") return null;

  const busy = r.reserve.isPending && r.reserve.variables?.vehicleId === vehicleId;
  return (
    <button
      type="button"
      disabled={r.reserve.isPending}
      onClick={() => { if (window.confirm(`Reserve the ${name}? It will be held for you and our team will contact you.`)) r.reserve.mutate({ vehicleId }); }}
      className={cn(btn({ variant: "primary", size: "sm" }), "mt-3 w-full")}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Reserve this car
    </button>
  );
}
