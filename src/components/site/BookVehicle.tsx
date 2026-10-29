import { useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Clock, Hourglass, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { fetchCustomerDetails } from "@/lib/customer-details";
import { APPROVAL_HOURS, bookingErrorMessage, isUnderProcess, timeLeft, useNow } from "@/lib/bookings";
import { cn } from "@/lib/utils";
import { ApprovalPending } from "./ApprovalStatus";
import { btn } from "./primitives";
import { fieldCls } from "./vehicles";
import { NotifyMeButton, UnderProcessTag } from "./WatchCar";
import { confirmDialog } from "./ConfirmDialog";

export const CONTACT_METHODS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "Phone call" },
  { id: "email", label: "Email" },
] as const;

/** Shared wording for each booking status, used here and on the account page. */
export const bookingStatusInfo: Record<string, { label: string; hint: string; tone: string }> = {
  pending: { label: "Pending approval", hint: `Your booking is waiting for our team's approval. The car is held for you meanwhile — if it isn't approved within ${APPROVAL_HOURS} hours, the booking is cancelled automatically.`, tone: "bg-champagne/25 text-foreground" },
  confirmed: { label: "Approved – reserved", hint: "Approved! This car is reserved for you. Our team will contact you about payment and shipping.", tone: "bg-emerald-600/15 text-emerald-800" },
  completed: { label: "Completed", hint: "This purchase is complete. Thank you for buying with us.", tone: "bg-secondary text-foreground" },
  cancelled: { label: "Cancelled", hint: "This booking was cancelled.", tone: "bg-crimson/10 text-crimson" },
};

/** Status wording for one booking, including why a cancelled booking ended. */
export function bookingStatusFor(b: { status: string; cancel_reason?: string | null }) {
  if (b.status === "cancelled" && b.cancel_reason === "expired") {
    return { label: "Expired", hint: "This booking wasn't approved in time and was cancelled automatically. If the car is still available you can book it again.", tone: "bg-crimson/10 text-crimson" };
  }
  if (b.status === "cancelled" && b.cancel_reason === "staff") return { ...bookingStatusInfo.cancelled!, hint: "This booking was cancelled by our team." };
  return bookingStatusInfo[b.status] ?? bookingStatusInfo.pending!;
}

/** Book-and-reserve box on the vehicle page. Customers must be signed in and approved by our team. */
export function BookVehicle({ vehicleId, vehicleName, vehicleStatus, holdUntil }: { vehicleId: string; vehicleName: string; vehicleStatus: string; holdUntil?: string | null }) {
  const { user, ready } = useCustomer();
  const qc = useQueryClient();
  const router = useRouter();
  const here = useRouterState({ select: (s) => s.location.href });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [destination, setDestination] = useState("");
  const [contact, setContact] = useState<string>("whatsapp");
  const now = useNow(30_000);
  const underProcess = isUnderProcess({ status: vehicleStatus, holdUntil }, now);

  const details = useQuery({
    queryKey: ["customer-details", user?.id],
    enabled: !!user,
    queryFn: () => fetchCustomerDetails(user!.id),
  });

  const existing = useQuery({
    queryKey: ["my-booking", user?.id, vehicleId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("id, status, staff_note, expires_at").eq("user_id", user!.id).eq("vehicle_id", vehicleId).in("status", ["pending", "confirmed"]).limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["my-booking", user?.id, vehicleId] }),
    qc.invalidateQueries({ queryKey: ["my-bookings"] }),
    qc.invalidateQueries({ queryKey: ["my-active-bookings"] }),
    qc.invalidateQueries({ queryKey: ["vehicle"] }),
    qc.invalidateQueries({ queryKey: ["vehicles"] }),
    router.invalidate(), // reload the car so its Reserved/Available status updates
  ]);

  const book = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first.");
      const { error } = await supabase.from("bookings").insert({
        user_id: user.id, vehicle_id: vehicleId, message: message.trim() || null,
        destination: destination.trim() || null, contact_method: contact,
      });
      if (error) throw new Error(bookingErrorMessage(error));
    },
    onSuccess: async () => {
      setOpen(false); setMessage(""); setDestination("");
      toast.success(`Booking sent — pending approval. Our team has ${APPROVAL_HOURS} hours to approve it.`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw new Error("We couldn't cancel this booking. Please contact us.");
    },
    onSuccess: async () => { toast.success("Booking cancelled."); await refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ready) return null;
  const shell = "mt-8 rounded-sm border border-border bg-card p-5";

  const underProcessBox = (
    <div className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow text-crimson">Booking</p>
        <UnderProcessTag />
      </div>
      <p className="mt-3 flex items-start gap-2 text-sm"><Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-crimson" /> Another customer has booked this car and it's waiting for our team's approval. If the booking isn't confirmed, the car becomes available again.</p>
      <NotifyMeButton vehicleId={vehicleId} className="mt-4 w-full" />
    </div>
  );

  if (!user) {
    if (underProcess) return underProcessBox;
    if (vehicleStatus !== "available") return null;
    return (
      <div className={shell}>
        <p className="eyebrow text-crimson">Book this car</p>
        <p className="mt-2 text-sm text-muted-foreground">Sign in or create an account to book {vehicleName}. New accounts are approved by our team first.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/login" search={{ redirect: here }} className={btn({ variant: "primary", size: "sm" })}>Sign in</Link>
          <Link to="/signup" search={{ redirect: here }} className={btn({ variant: "outline", size: "sm" })}>Create account</Link>
        </div>
      </div>
    );
  }

  if (details.isLoading || existing.isLoading) return <div className={cn(shell, "text-sm text-muted-foreground")}>Checking your account…</div>;

  // The signed-in customer already has an active booking on this car.
  if (existing.data) {
    const info = bookingStatusFor(existing.data);
    const Icon = existing.data.status === "confirmed" ? CheckCircle2 : Clock;
    const left = existing.data.status === "pending" ? timeLeft(existing.data.expires_at, now) : null;
    return (
      <div className={shell}>
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-crimson">Your booking</p>
          <span className={cn("rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", info.tone)}>{info.label}</span>
        </div>
        <p className="mt-3 flex items-start gap-2 text-sm"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-crimson" /> {info.hint}</p>
        {existing.data.status === "pending" && (
          <p className="mt-3 rounded-sm bg-champagne/15 p-2 text-sm"><span className="font-semibold">Waiting for approval</span> · {left ? `${left.label} left` : "time is up — it will be cancelled shortly"}</p>
        )}
        {existing.data.staff_note && <p className="mt-3 rounded-sm bg-secondary/60 p-3 text-sm"><span className="font-semibold">Message from our team:</span> {existing.data.staff_note}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/account" className={btn({ variant: "outline", size: "sm" })}>My bookings</Link>
          <button onClick={async () => { if (await confirmDialog({ title: "Cancel your booking?", description: `${vehicleName} will become available to other customers.`, confirmLabel: "Cancel booking", cancelLabel: "Keep booking", tone: "danger" })) cancel.mutate(existing.data!.id); }} disabled={cancel.isPending} className={btn({ variant: "link", size: "sm" })}>
            {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Cancel booking
          </button>
        </div>
      </div>
    );
  }

  if (vehicleStatus !== "available") {
    return (
      <div className={shell}>
        <p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-crimson" /> This car is {vehicleStatus === "sold" ? "sold" : "reserved by another customer"}</p>
        <p className="mt-2 text-sm text-muted-foreground">Browse similar cars below, or ask us to find you one like it.</p>
        <Link to="/request-a-car" className={cn(btn({ variant: "outline", size: "sm" }), "mt-4")}>Request a similar car</Link>
      </div>
    );
  }

  if (underProcess) return underProcessBox;

  const d = details.data;
  // Customers can book once our team has approved their account (approval is stored as phone_verified).
  if (!d || !d.phoneVerified) return <ApprovalPending phone={d?.phone} className="mt-8" />;

  return (
    <div className={shell}>
      <p className="eyebrow text-crimson">Book this car</p>
      {!open ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">Your account is approved. Book {vehicleName} now — it's held for you while our team approves the booking (within {APPROVAL_HOURS} hours).</p>
          <button onClick={() => setOpen(true)} className={cn(btn({ variant: "primary", size: "lg" }), "mt-4 w-full")}><CalendarCheck className="h-4 w-4" /> Book this car</button>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); book.mutate(); }} className="mt-3 grid gap-3">
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Destination country / port</span>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={120} placeholder="e.g. Mombasa, Kenya" className={fieldCls} />
          </label>
          <fieldset>
            <legend className="eyebrow mb-2 text-muted-foreground">How should we contact you?</legend>
            <div className="flex flex-wrap gap-2">
              {CONTACT_METHODS.map((m) => (
                <label key={m.id} className={cn("cursor-pointer rounded-sm border px-3 py-1.5 text-sm", contact === m.id ? "border-crimson bg-crimson/5 font-semibold" : "border-border hover:bg-secondary")}>
                  <input type="radio" name="contact" value={m.id} checked={contact === m.id} onChange={() => setContact(m.id)} className="sr-only" />{m.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Message (optional)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} placeholder="Questions, preferred shipping, timeline…" className={cn(fieldCls, "h-auto py-3")} />
          </label>
          <p className="text-xs text-muted-foreground">Booking is free. It shows as <strong>Pending approval</strong> until our team approves it; if it isn't approved within {APPROVAL_HOURS} hours it's cancelled automatically. You can cancel from My bookings.</p>
          <div className="flex gap-3">
            <button disabled={book.isPending} className={btn({ variant: "primary" })}>{book.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Send booking</button>
            <button type="button" onClick={() => setOpen(false)} className={btn({ variant: "outline" })}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
