import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, CalendarCheck, Car, Check, Clock, Hourglass, Loader2, Mail, MessageCircle, Phone, Search, TimerReset, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { listCustomerApprovals } from "@/lib/admin.functions";
import { APPROVAL_HOURS, APPROVAL_MS, expireOverdueBookings, timeLeft, useNow } from "@/lib/bookings";
import { CONTACT_METHODS } from "@/components/site/BookVehicle";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";

type BStatus = Database["public"]["Enums"]["booking_status"];
const STATUS_OPTIONS: { id: BStatus; label: string }[] = [
  { id: "pending", label: "Pending approval" },
  { id: "confirmed", label: "Approved – reserved" },
  { id: "completed", label: "Completed – car sold" },
  { id: "cancelled", label: "Cancelled" },
];
const FILTERS: { id: BStatus | "active" | "all"; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending approval" },
  { id: "confirmed", label: "Reserved" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];
const tone: Record<BStatus, string> = {
  pending: "bg-champagne/25 text-foreground",
  confirmed: "bg-emerald-600/15 text-emerald-800",
  completed: "bg-secondary text-foreground",
  cancelled: "bg-crimson/10 text-crimson",
};
const cancelReason: Record<string, string> = { expired: "not approved in time", customer: "by the customer", staff: "by staff" };
const digits = (phone: string) => phone.replace(/\D/g, "");
const money = (n: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  beforeLoad: ({ context }) => { if (!context.admin.perms.bookings) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Bookings — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Bookings,
});

function Bookings() {
  const qc = useQueryClient();
  const now = useNow(15_000);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

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

  const all = q.data ?? [];
  const awaiting = all.filter((b) => b.status === "pending").sort((a, b) => (a.expires_at ?? "").localeCompare(b.expires_at ?? ""));

  const counts: Record<string, number> = { all: all.length, active: 0 };
  for (const b of all) { counts[b.status] = (counts[b.status] ?? 0) + 1; if (b.status === "pending" || b.status === "confirmed") counts.active!++; }

  const term = search.trim().toLowerCase();
  const rows = all.filter((b) => {
    if (filter === "active" ? !(b.status === "pending" || b.status === "confirmed") : filter !== "all" && b.status !== filter) return false;
    if (!term) return true;
    const c = byId.get(b.user_id);
    return [c?.name, c?.email, c?.phone, c?.customerNumber, b.vehicles?.stock_id, b.vehicles?.make, b.vehicles?.model, b.destination].some((v) => (v ?? "").toLowerCase().includes(term));
  });

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

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow text-crimson">Customers</p>
        <h1 className="mt-1 text-3xl font-bold">Bookings &amp; approvals</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          When a customer books a car it shows <strong>Under process</strong> to everyone else. Approve it within {APPROVAL_HOURS} hours to reserve the car in their name — otherwise the booking is cancelled automatically and the car is free to book again. Customers who asked to be notified get a message on the website when that happens.
        </p>
      </div>

      {/* ---------- Waiting for approval ---------- */}
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
                  <button disabled={isBusy || !left} onClick={() => { if (window.confirm(`Approve this booking? The ${v ? `${v.make} ${v.model}` : "car"} will be marked Reserved for ${c?.name || "this customer"}.`)) void update(b.id, { status: "confirmed" }, "Approved — the car is now reserved for this customer."); }}
                    className={cn(btn({ variant: "primary", size: "sm" }), "disabled:opacity-50")}>
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve &amp; reserve
                  </button>
                  <button disabled={isBusy} onClick={() => void extend(b.id)} className={btn({ variant: "outline", size: "sm" })}>
                    <TimerReset className="h-4 w-4" /> Extend +{APPROVAL_HOURS}h
                  </button>
                  <button disabled={isBusy} onClick={() => { if (window.confirm("Reject this booking? The car becomes available to other customers.")) void update(b.id, { status: "cancelled" }, "Booking rejected — the car is available again."); }}
                    className={btn({ variant: "link", size: "sm" })}>
                    <X className="h-4 w-4" /> Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------- All bookings ---------- */}
      <section aria-labelledby="all-bookings" className="space-y-4">
        <h2 id="all-bookings" className="text-xl font-bold">All bookings</h2>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(({ id, label }) => (
            <button key={id} onClick={() => setFilter(id)}
              className={cn("rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors", filter === id ? "border-crimson bg-crimson text-primary-foreground" : "border-border hover:bg-secondary")}>
              {label} <span className={cn("ml-1 text-xs", filter === id ? "opacity-90" : "text-muted-foreground")}>{counts[id] ?? 0}</span>
            </button>
          ))}
          <label className="relative ml-auto w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, car, stock ID" className={cn(fieldCls, "h-10 pl-9")} />
          </label>
        </div>

        {q.error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson">{(q.error as Error).message}</p>}
        {q.data && rows.length === 0 && (
          <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground"><CalendarCheck className="mx-auto mb-2 h-6 w-6" />No bookings here.</div>
        )}

        <div className="grid gap-3">
          {rows.map((b) => {
            const c = byId.get(b.user_id);
            const v = b.vehicles;
            const note = notes[b.id] ?? b.staff_note ?? "";
            const left = b.status === "pending" ? timeLeft(b.expires_at, now) : null;
            return (
              <article key={b.id} className={cn("rounded-sm border bg-card p-4", b.status === "pending" ? "border-crimson/40" : "border-border")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {v ? (
                      <Link to="/vehicles/$slug" params={{ slug: v.slug ?? "" }} target="_blank" className="inline-flex items-center gap-1.5 text-base font-bold hover:text-crimson">
                        <Car className="h-4 w-4" />{v.year} {v.make} {v.model}
                      </Link>
                    ) : <span className="font-bold">Vehicle removed</span>}
                    {v && <p className="text-xs text-muted-foreground"><span className="font-mono">{v.stock_id}</span> · car is now <strong className="capitalize">{v.status}</strong> · {money(Number(v.price), v.currency)}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {b.status === "pending" && <span className="inline-flex items-center gap-1 text-xs font-semibold text-crimson"><Clock className="h-3.5 w-3.5" />{left ? `${left.label} left` : "Expired"}</span>}
                    <span className={cn("rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", tone[b.status])}>{STATUS_OPTIONS.find((s) => s.id === b.status)?.label}</span>
                    <select value={b.status} disabled={busy === b.id}
                      onChange={(e) => {
                        const next = e.target.value as BStatus;
                        if (next === "completed" && !window.confirm("Mark this sale as completed? The car will be marked Sold.")) return;
                        void update(b.id, { status: next }, next === "confirmed" ? "Approved — the car is now reserved." : next === "completed" ? "Completed — the car is now sold." : next === "cancelled" ? "Booking cancelled." : `Back to pending — ${APPROVAL_HOURS}h approval window restarted.`);
                      }}
                      className="rounded-sm border border-border bg-background px-2 py-1 text-sm">
                      {STATUS_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                {b.status === "cancelled" && b.cancel_reason && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />Cancelled {cancelReason[b.cancel_reason] ?? ""}.</p>
                )}
                {b.status === "confirmed" && b.approved_at && <p className="mt-2 text-xs text-muted-foreground">Approved {new Date(b.approved_at).toLocaleString()}</p>}

                <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-semibold">{c?.name || "—"}</p><p className="font-mono text-xs text-muted-foreground">{c?.customerNumber}</p></div>
                  <div><p className="text-xs text-muted-foreground">Phone / WhatsApp</p>
                    {c?.phone ? (
                      <p className="flex items-center gap-2 font-semibold">
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-crimson"><Phone className="h-3.5 w-3.5" />{c.phone}</a>
                        <a href={`https://wa.me/${digits(c.phone)}`} target="_blank" rel="noreferrer" aria-label="Message on WhatsApp" className="text-emerald-700"><MessageCircle className="h-4 w-4" /></a>
                      </p>
                    ) : <p>—</p>}
                  </div>
                  <div className="min-w-0"><p className="text-xs text-muted-foreground">Email</p>{c?.email ? <a href={`mailto:${c.email}`} className="inline-flex max-w-full items-center gap-1 truncate hover:text-crimson"><Mail className="h-3.5 w-3.5 shrink-0" />{c.email}</a> : <p>—</p>}</div>
                  <div><p className="text-xs text-muted-foreground">Booked</p><p>{new Date(b.created_at).toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Destination</p><p>{b.destination || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Prefers contact by</p><p>{CONTACT_METHODS.find((m) => m.id === b.contact_method)?.label ?? "—"}</p></div>
                </div>
                {b.message && <p className="mt-3 whitespace-pre-line rounded-sm bg-secondary/50 p-3 text-sm"><span className="font-semibold">Customer's message:</span> {b.message}</p>}

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-xs text-muted-foreground">Message to the customer (shown on their booking)</span>
                    <input value={note} onChange={(e) => setNotes((n) => ({ ...n, [b.id]: e.target.value }))} maxLength={500} placeholder="e.g. Reserved until 15 Nov — we'll send the invoice on WhatsApp" className={cn(fieldCls, "h-9")} />
                  </label>
                  {note !== (b.staff_note ?? "") && (
                    <button disabled={busy === b.id} onClick={() => update(b.id, { staff_note: note.trim() || null }, "Message saved")} className={btn({ variant: "outline", size: "sm" })}>Save message</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
