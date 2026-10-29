import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AlertTriangle, CalendarCheck, Car, Clock, Mail, MessageCircle, Phone, Search } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { APPROVAL_HOURS, timeLeft, useNow } from "@/lib/bookings";
import { CONTACT_METHODS } from "@/components/site/BookVehicle";
import { AwaitingApprovals, digits, money, useAdminBookings, useBookingActions } from "@/components/admin/BookingApprovals";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/site/ConfirmDialog";

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

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  beforeLoad: ({ context }) => { if (!context.admin.perms.bookings) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Bookings — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Bookings,
});

function Bookings() {
  const now = useNow(15_000);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { q, byId } = useAdminBookings();
  const { busy, update } = useBookingActions();

  const all = q.data ?? [];

  const counts: Record<string, number> = { all: all.length, active: 0 };
  for (const b of all) { counts[b.status] = (counts[b.status] ?? 0) + 1; if (b.status === "pending" || b.status === "confirmed") counts.active!++; }

  const term = search.trim().toLowerCase();
  const rows = all.filter((b) => {
    if (filter === "active" ? !(b.status === "pending" || b.status === "confirmed") : filter !== "all" && b.status !== filter) return false;
    if (!term) return true;
    const c = byId.get(b.user_id);
    return [c?.name, c?.email, c?.phone, c?.customerNumber, b.vehicles?.stock_id, b.vehicles?.make, b.vehicles?.model, b.destination].some((v) => (v ?? "").toLowerCase().includes(term));
  });

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
      <AwaitingApprovals />

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
                      onChange={async (e) => {
                        const next = e.target.value as BStatus;
                        const car = v ? `${v.year} ${v.make} ${v.model}` : "—";
                        if (next === "completed" && !(await confirmDialog({ title: "Mark this sale as completed?", description: "The car will be marked Sold and removed from the available inventory.", details: [["Car", car], ["Customer", c?.name || c?.email || "—"]], confirmLabel: "Mark as sold", tone: "success" }))) return;
                        if (next === "cancelled" && !(await confirmDialog({ title: "Cancel this booking?", description: "The car becomes available to other customers and the customer gets a message.", details: [["Car", car], ["Customer", c?.name || c?.email || "—"]], confirmLabel: "Cancel booking", cancelLabel: "Keep booking", tone: "danger" }))) return;
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
