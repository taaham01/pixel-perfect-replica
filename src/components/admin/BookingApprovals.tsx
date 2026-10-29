import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Car, Check, Clock, Hourglass, Loader2, Mail, MessageCircle, Phone, TimerReset, X } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { listCustomerApprovals } from "@/lib/admin.functions";
import { APPROVAL_HOURS, APPROVAL_MS, expireOverdueBookings, timeLeft, useNow } from "@/lib/bookings";
import { CONTACT_METHODS } from "@/components/site/BookVehicle";
import { btn } from "@/components/site/primitives";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/site/ConfirmDialog";

type BStatus = Database["public"]["Enums"]["booking_status"];
export const digits = (phone: string) => phone.replace(/\D/g, "");
export const money = (n: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

/** All bookings with their cars, customer contact details, and how many people follow each car (staff only). */
export function useAdminBookings() {
  const q = useQuery({
    queryKey: ["admin", "bookings"],
    refetchInterval: 60_000,
    queryFn: async () => {
      await expireOverdueBookings(); // release anything whose approval time ran out
      const { data, error } = await supabase.from("bookings").select("*, vehicles(id, stock_id, make, model, year, slug, status, price, currency)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  // Name, customer ID, email and phone for every customer (staff-only server call).
  const people = useQuery({ queryKey: ["admin", "customer-approvals"], queryFn: () => listCustomerApprovals(), staleTime: 30_000 });
  const byId = new Map((people.data ?? []).map((c) => [c.id, c]));
  // Customers who asked to be told if a car becomes available again.
  const watchers = useQuery({
    queryKey: ["admin", "vehicle-watchers"], refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_watchers").select("vehicle_id");
      if (error) return new Map<string, number>();
      const m = new Map<string, number>();
      for (const w of data) m.set(w.vehicle_id, (m.get(w.vehicle_id) ?? 0) + 1);
      return m;
    },
  });
  return { q, byId, watchers };
}

/** Approve / reject / extend actions shared by the booking pages. */
export function useBookingActions() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  async function refresh() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["vehicles"] })]);
  }

  async function update(id: string, patch: { status?: BStatus; staff_note?: string | null }, msg: string) {
    setBusy(id);
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); await refresh(); return; }
    toast.success(msg);
    await refresh();
  }

  async function extend(id: string) {
    setBusy(id);
    const { data, error } = await supabase.rpc("extend_booking", { _booking_id: id });
    setBusy(null);
    if (error) { toast.error(error.message); await refresh(); return; }
    toast.success(`Extended — now due ${new Date(data).toLocaleString()}.`);
    await refresh();
  }
  return { busy, update, extend };
}

/** Bookings waiting for approval, most urgent first, with a live countdown and Approve / Extend / Reject. */
export function AwaitingApprovals() {
  const now = useNow(15_000);
  const { q, byId, watchers } = useAdminBookings();
  const { busy, update, extend } = useBookingActions();
  const awaiting = (q.data ?? []).filter((b) => b.status === "pending").sort((a, b) => (a.expires_at ?? "").localeCompare(b.expires_at ?? ""));
  return (
      <section aria-labelledby="awaiting">
        <div className="flex items-center gap-2">
          <Hourglass className="h-5 w-5 text-crimson" />
          <h2 id="awaiting" className="text-xl font-bold">Waiting for approval</h2>
          <span className="rounded-full bg-crimson px-2 py-0.5 text-xs font-bold text-primary-foreground">{awaiting.length}</span>
        </div>
        {q.isLoading && <div className="mt-3 grid h-24 place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {q.data && awaiting.length === 0 && (
          <p className="mt-3 rounded-sm border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No bookings are waiting for approval.</p>
        )}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {awaiting.map((b) => {
            const c = byId.get(b.user_id);
            const v = b.vehicles;
            const left = timeLeft(b.expires_at, now);
            const spent = b.expires_at ? Math.min(1, Math.max(0, 1 - (new Date(b.expires_at).getTime() - now) / APPROVAL_MS)) : 1;
            const waiting = watchers.data?.get(b.vehicle_id) ?? 0;
            const isBusy = busy === b.id;
            return (
              <article key={b.id} className={cn("flex flex-col rounded-sm border bg-card p-4", left?.urgent || !left ? "border-crimson" : "border-champagne")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {v ? (
                      <Link to="/vehicles/$slug" params={{ slug: v.slug ?? "" }} target="_blank" className="inline-flex items-center gap-1.5 font-bold hover:text-crimson"><Car className="h-4 w-4 shrink-0" />{v.year} {v.make} {v.model}</Link>
                    ) : <span className="font-bold">Vehicle removed</span>}
                    {v && <p className="text-xs text-muted-foreground"><span className="font-mono">{v.stock_id}</span> · {money(Number(v.price), v.currency)}</p>}
                  </div>
                  <div className={cn("shrink-0 rounded-sm px-2.5 py-1.5 text-right", left?.urgent || !left ? "bg-crimson/10 text-crimson" : "bg-champagne/25")}>
                    <p className="text-[10px] font-bold uppercase tracking-wider">Time left to approve</p>
                    <p className="flex items-center justify-end gap-1 text-lg font-bold tabular-nums"><Clock className="h-4 w-4" />{left ? left.label : "Expired"}</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                  <div className={cn("h-full rounded-full", left?.urgent || !left ? "bg-crimson" : "bg-champagne")} style={{ width: `${Math.round(spent * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Booked {new Date(b.created_at).toLocaleString()} · auto-cancels {b.expires_at ? new Date(b.expires_at).toLocaleString() : "now"}</p>

                <div className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <p><span className="font-semibold">{c?.name || "—"}</span> <span className="font-mono text-xs text-muted-foreground">{c?.customerNumber}</span></p>
                  <p className="flex items-center gap-2">
                    {c?.phone ? <>
                      <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-crimson"><Phone className="h-3.5 w-3.5" />{c.phone}</a>
                      <a href={`https://wa.me/${digits(c.phone)}`} target="_blank" rel="noreferrer" aria-label="Message on WhatsApp" className="text-emerald-700"><MessageCircle className="h-4 w-4" /></a>
                    </> : <span className="text-muted-foreground">No phone</span>}
                  </p>
                  {c?.email && <a href={`mailto:${c.email}`} className="inline-flex min-w-0 items-center gap-1 truncate hover:text-crimson"><Mail className="h-3.5 w-3.5 shrink-0" />{c.email}</a>}
                  <p className="text-muted-foreground">{b.destination ? `To ${b.destination}` : "No destination"} · {CONTACT_METHODS.find((m) => m.id === b.contact_method)?.label ?? "—"}</p>
                </div>
                {b.message && <p className="mt-2 whitespace-pre-line rounded-sm bg-secondary/50 p-2 text-sm"><span className="font-semibold">Message:</span> {b.message}</p>}
                {waiting > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><BellRing className="h-3.5 w-3.5 text-crimson" />{waiting} other customer{waiting === 1 ? " is" : "s are"} waiting to hear if this car becomes available.</p>}

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button disabled={isBusy || !left} onClick={async () => {
                    const ok = await confirmDialog({
                      title: "Approve & reserve this car?", tone: "success", confirmLabel: "Approve & reserve",
                      description: "The car will be marked Reserved in this customer's name and they'll get a message that their booking is approved.",
                      details: [["Car", v ? `${v.year} ${v.make} ${v.model}` : "—"], ["Stock ID", v?.stock_id ?? "—"], ["Customer", c?.name || c?.email || "—"], ["Time left", left ? left.label : "Expired"]],
                    });
                    if (ok) void update(b.id, { status: "confirmed" }, "Approved — the car is now reserved for this customer.");
                  }}
                    className={cn(btn({ variant: "primary", size: "sm" }), "disabled:opacity-50")}>
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve &amp; reserve
                  </button>
                  <button disabled={isBusy} onClick={() => void extend(b.id)} className={btn({ variant: "outline", size: "sm" })}>
                    <TimerReset className="h-4 w-4" /> Extend +{APPROVAL_HOURS}h
                  </button>
                  <button disabled={isBusy} onClick={async () => {
                    const ok = await confirmDialog({
                      title: "Reject this booking?", tone: "danger", confirmLabel: "Reject booking",
                      description: "The booking is cancelled and the car becomes available to other customers. Anyone waiting for this car gets a message.",
                      details: [["Car", v ? `${v.year} ${v.make} ${v.model}` : "—"], ["Customer", c?.name || c?.email || "—"]],
                    });
                    if (ok) void update(b.id, { status: "cancelled" }, "Booking rejected — the car is available again.");
                  }}
                    className={btn({ variant: "link", size: "sm" })}>
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
  );
}
