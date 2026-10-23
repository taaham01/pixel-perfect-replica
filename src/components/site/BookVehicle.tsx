import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { fetchCustomerDetails } from "@/lib/customer-details";
import { cn } from "@/lib/utils";
import { PhoneVerification } from "./PhoneVerification";
import { btn } from "./primitives";
import { fieldCls } from "./vehicles";

/** Book-this-car box on the vehicle page. Customers must be signed in with a verified phone number. */
export function BookVehicle({ vehicleId, vehicleName }: { vehicleId: string; vehicleName: string }) {
  const { user, ready } = useCustomer();
  const qc = useQueryClient();
  const here = useRouterState({ select: (s) => s.location.href });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const details = useQuery({
    queryKey: ["customer-details", user?.id],
    enabled: !!user,
    queryFn: () => fetchCustomerDetails(user!.id),
  });

  const existing = useQuery({
    queryKey: ["my-booking", user?.id, vehicleId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id, status").eq("user_id", user!.id).eq("vehicle_id", vehicleId).in("status", ["pending", "confirmed"]).limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first.");
      const { error } = await supabase.from("bookings").insert({ user_id: user.id, vehicle_id: vehicleId, message: message.trim() || null });
      if (error) throw new Error("We couldn't create your booking. The vehicle may no longer be available, or your phone isn't verified yet.");
    },
    onSuccess: async () => {
      setOpen(false);
      setMessage("");
      toast.success("Booking requested. Our team will confirm it with you.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-booking", user?.id, vehicleId] }),
        qc.invalidateQueries({ queryKey: ["my-bookings"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ready) return null;

  const shell = "mt-8 rounded-sm border border-border bg-card p-5";

  if (!user) {
    return (
      <div className={shell}>
        <p className="eyebrow text-crimson">Book this car</p>
        <p className="mt-2 text-sm text-muted-foreground">Sign in or create an account to book {vehicleName}.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/login" search={{ redirect: here }} className={btn({ variant: "primary", size: "sm" })}>Sign in</Link>
          <Link to="/signup" search={{ redirect: here }} className={btn({ variant: "outline", size: "sm" })}>Create account</Link>
        </div>
      </div>
    );
  }

  if (details.isLoading || existing.isLoading) return <div className={cn(shell, "text-sm text-muted-foreground")}>Checking your account…</div>;

  if (existing.data) {
    return (
      <div className={shell}>
        <p className="eyebrow text-crimson">Booking</p>
        <p className="mt-2 flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-crimson" /> You've requested this vehicle ({existing.data.status}).</p>
        <p className="mt-1 text-sm text-muted-foreground">Our team will be in touch to confirm it.</p>
      </div>
    );
  }

  const d = details.data;
  if (!d || !d.phone) {
    return (
      <div className={shell}>
        <p className="eyebrow text-crimson">Book this car</p>
        <p className="mt-2 text-sm text-muted-foreground">Add your phone number to your account so we can verify you.</p>
        <Link to="/account" className={cn(btn({ variant: "primary", size: "sm" }), "mt-4")}>Complete my details</Link>
      </div>
    );
  }

  if (!d.phoneVerified) return <div className="mt-8"><PhoneVerification phone={d.phone} userId={user.id} /></div>;

  return (
    <div className={shell}>
      <p className="eyebrow text-crimson">Book this car</p>
      {!open ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Your phone is verified. Reserve {vehicleName} and our team will confirm it.</p>
          <button onClick={() => setOpen(true)} className={cn(btn({ variant: "primary", size: "lg" }), "mt-4 w-full")}><CalendarCheck className="h-4 w-4" /> Book this vehicle</button>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); book.mutate(); }} className="mt-3 grid gap-3">
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Message (optional)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} placeholder="Destination port, questions…" className={cn(fieldCls, "h-auto py-3")} />
          </label>
          <div className="flex gap-3">
            <button disabled={book.isPending} className={btn({ variant: "primary" })}>{book.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm booking</button>
            <button type="button" onClick={() => setOpen(false)} className={btn({ variant: "outline" })}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
