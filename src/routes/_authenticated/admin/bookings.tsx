import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarCheck, Car, Loader2, Mail, MessageCircle, Phone, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { listCustomerApprovals } from "@/lib/admin.functions";
import { CONTACT_METHODS } from "@/components/site/BookVehicle";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";

type BStatus = Database["public"]["Enums"]["booking_status"];
const STATUS_OPTIONS: { id: BStatus; label: string; hint: string }[] = [
  { id: "pending", label: "Requested", hint: "Waiting for the team" },
  { id: "confirmed", label: "Confirmed – car reserved", hint: "Car is marked Reserved" },
  { id: "completed", label: "Completed – car sold", hint: "Car is marked Sold" },
  { id: "cancelled", label: "Cancelled", hint: "Car is released" },
];
const FILTERS: { id: BStatus | "active" | "all"; label: string }[] = [
  { id: "pending", label: "Requested" },
  { id: "confirmed", label: "Reserved" },
  { id: "active", label: "All active" },
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
const digits = (phone: string) => phone.replace(/\D/g, "");

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  beforeLoad: ({ context }) => { if (!context.admin.perms.bookings) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Bookings — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Bookings,
});

function Bookings() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("pending");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin", "bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*, vehicles(id, stock_id, make, model, year, slug, status, price, currency)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  // Name, customer ID, email and phone for every customer (staff-only server call).
  const people = useQuery({ queryKey: ["admin", "customer-approvals"], queryFn: () => listCustomerApprovals(), staleTime: 30_000 });
  const byId = new Map((people.data ?? []).map((c) => [c.id, c]));

  // Cars with more than one active booking, so staff can see competing requests.
  const activePerCar = new Map<string, number>();
  for (const b of q.data ?? []) if (b.status === "pending" || b.status === "confirmed") activePerCar.set(b.vehicle_id, (activePerCar.get(b.vehicle_id) ?? 0) + 1);

  const counts: Record<string, number> = { all: q.data?.length ?? 0, active: 0 };
  for (const b of q.data ?? []) { counts[b.status] = (counts[b.status] ?? 0) + 1; if (b.status === "pending" || b.status === "confirmed") counts.active!++; }

  const term = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter((b) => {
    if (filter === "active" ? !(b.status === "pending" || b.status === "confirmed") : filter !== "all" && b.status !== filter) return false;
    if (!term) return true;
    const c = byId.get(b.user_id);
    return [c?.name, c?.email, c?.phone, c?.customerNumber, b.vehicles?.stock_id, b.vehicles?.make, b.vehicles?.model, b.destination].some((v) => (v ?? "").toLowerCase().includes(term));
  });

  async function update(id: string, patch: { status?: BStatus; staff_note?: string | null }, msg: string) {
    setBusy(id);
    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    await qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-crimson">Customers</p>
        <h1 className="mt-1 text-3xl font-bold">Bookings &amp; reservations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirming a booking marks the car <strong>Reserved</strong>; completing it marks the car <strong>Sold</strong>; cancelling releases it.</p>
      </div>

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

      {q.isLoading && <div className="grid h-40 place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {q.error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson">{(q.error as Error).message}</p>}
      {q.data && rows.length === 0 && (
        <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground"><CalendarCheck className="mx-auto mb-2 h-6 w-6" />No bookings here.</div>
      )}

      <div className="grid gap-3">
        {rows.map((b) => {
          const c = byId.get(b.user_id);
          const v = b.vehicles;
          const note = notes[b.id] ?? b.staff_note ?? "";
          const others = (activePerCar.get(b.vehicle_id) ?? 0) - (b.status === "pending" || b.status === "confirmed" ? 1 : 0);
          return (
            <article key={b.id} className={cn("rounded-sm border bg-card p-4", b.status === "pending" ? "border-crimson/40" : "border-border")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  {v ? (
                    <Link to="/vehicles/$slug" params={{ slug: v.slug ?? "" }} target="_blank" className="inline-flex items-center gap-1.5 text-base font-bold hover:text-crimson">
                      <Car className="h-4 w-4" />{v.year} {v.make} {v.model}
                    </Link>
                  ) : <span className="font-bold">Vehicle removed</span>}
                  {v && <p className="text-xs text-muted-foreground"><span className="font-mono">{v.stock_id}</span> · car is now <strong className="capitalize">{v.status}</strong> · {new Intl.NumberFormat("en-US", { style: "currency", currency: v.currency, maximumFractionDigits: 0 }).format(Number(v.price))}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", tone[b.status])}>{STATUS_OPTIONS.find((s) => s.id === b.status)?.label}</span>
                  <select value={b.status} disabled={busy === b.id}
                    onChange={(e) => {
                      const next = e.target.value as BStatus;
                      if (next === "completed" && !window.confirm("Mark this sale as completed? The car will be marked Sold.")) return;
                      void update(b.id, { status: next }, next === "confirmed" ? "Confirmed — the car is now reserved." : next === "completed" ? "Completed — the car is now sold." : next === "cancelled" ? "Booking cancelled." : "Booking updated.");
                    }}
                    className="rounded-sm border border-border bg-background px-2 py-1 text-sm">
                    {STATUS_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {others > 0 && (b.status === "pending" || b.status === "confirmed") && (
                <p className="mt-3 flex items-center gap-2 rounded-sm bg-champagne/15 p-2 text-sm"><AlertTriangle className="h-4 w-4 text-crimson" /> {others} other customer{others === 1 ? " has" : "s have"} an active booking on this car.</p>
              )}

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
    </div>
  );
}
