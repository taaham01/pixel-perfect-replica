import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, CheckCircle2, Inbox, Loader2, Lock, Mail, MessageCircle, Phone, PhoneCall, RotateCcw, Search, Send } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formKindLabel, type FormKind } from "@/lib/inquiries";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/_authenticated/admin/inquiries")({
  head: () => ({ meta: [{ title: "Inquiries — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Inquiries,
});

type Status = Database["public"]["Enums"]["inquiry_status"];
const STATUSES: { id: Status | "all"; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];
const KINDS: (FormKind | "all")[] = ["all", "question", "vehicle-inquiry", "vehicle-request", "dealer", "contact"];

// Friendly labels for the extra fields each form collects.
const detailLabel: Record<string, string> = {
  company: "Company", volume: "Monthly volume", stockId: "Vehicle", make: "Make", model: "Model", minYear: "Min. year",
  budget: "Budget (USD)", maxMileage: "Max. mileage (km)", transmission: "Transmission", fuel: "Fuel", color: "Colour",
  quantity: "Quantity", body: "Body type",
};

const digits = (phone: string) => phone.replace(/\D/g, "");

function useInquiries() {
  return useQuery({
    queryKey: ["admin", "inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inquiries").select("*, vehicles(stock_id, make, model, year, slug)").order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

function Inquiries() {
  const qc = useQueryClient();
  const q = useInquiries();
  const [status, setStatus] = useState<Status | "all">("new");
  const [kind, setKind] = useState<FormKind | "all">("all");
  const [search, setSearch] = useState("");
  const me = useAdmin();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const counts: Record<string, number> = { all: q.data?.length ?? 0 };
  for (const i of q.data ?? []) counts[i.status] = (counts[i.status] ?? 0) + 1;
  const term = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter((i) => (status === "all" || i.status === status) && (kind === "all" || i.kind === kind)
    && (!term || [i.name, i.email, i.phone, i.country, i.subject, i.message].some((v) => (v ?? "").toLowerCase().includes(term))));

  async function update(id: string, patch: { status?: Status; staff_note?: string | null; reply?: string | null }, msg: string) {
    setBusy(id);
    const { error } = await supabase.from("inquiries").update(patch).eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    await qc.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-crimson">Customers</p>
        <h1 className="mt-1 text-3xl font-bold">Inquiries</h1>
        <p className="mt-1 text-sm text-muted-foreground">Messages from the website's forms and questions customers ask from their account.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map(({ id, label }) => (
          <button key={id} onClick={() => setStatus(id)}
            className={cn("rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors", status === id ? "border-crimson bg-crimson text-primary-foreground" : "border-border hover:bg-secondary")}>
            {label} <span className={cn("ml-1 text-xs", status === id ? "opacity-90" : "text-muted-foreground")}>{counts[id] ?? 0}</span>
          </button>
        ))}
        <select value={kind} onChange={(e) => setKind(e.target.value as FormKind | "all")} className={cn(fieldCls, "h-9 w-auto")}>
          {KINDS.map((k) => <option key={k} value={k}>{k === "all" ? "All forms" : formKindLabel[k]}</option>)}
        </select>
        <label className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, message" className={cn(fieldCls, "h-10 pl-9")} />
        </label>
      </div>

      {q.isLoading && <div className="grid h-40 place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {q.error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson">{(q.error as Error).message}</p>}
      {q.data && rows.length === 0 && (
        <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 h-6 w-6" />{status === "new" && !term && kind === "all" ? "No new messages." : "No messages match."}
        </div>
      )}

      <div className="grid gap-3">
        {rows.map((i) => {
          const details = Object.entries((i.details ?? {}) as Record<string, string>);
          const note = notes[i.id] ?? i.staff_note ?? "";
          const reply = replies[i.id] ?? i.reply ?? "";
          return (
            <article key={i.id} className={cn("rounded-sm border bg-card p-4", i.status === "new" ? "border-crimson/40" : "border-border")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold">{i.name}</h2>
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{formKindLabel[i.kind as FormKind] ?? i.kind}</span>
                    {i.status === "new" && <span className="rounded-sm bg-crimson px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">New</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}{i.country ? ` · ${i.country}` : ""}{i.user_id ? " · signed-in customer" : ""}</p>
                </div>
                <select value={i.status} disabled={busy === i.id} onChange={(e) => update(i.id, { status: e.target.value as Status }, "Status updated")}
                  className="rounded-sm border border-border bg-background px-2 py-1 text-sm capitalize">
                  {(["new", "contacted", "closed"] as Status[]).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1 hover:text-crimson"><Mail className="h-3.5 w-3.5" />{i.email}</a>
                {i.phone && (
                  <span className="inline-flex items-center gap-2">
                    <a href={`tel:${i.phone}`} className="inline-flex items-center gap-1 font-semibold hover:text-crimson"><Phone className="h-3.5 w-3.5" />{i.phone}</a>
                    <a href={`https://wa.me/${digits(i.phone)}`} target="_blank" rel="noreferrer" aria-label="Message on WhatsApp" className="text-emerald-700 hover:text-emerald-600"><MessageCircle className="h-4 w-4" /></a>
                  </span>
                )}
                {i.vehicles && (
                  <Link to="/vehicles/$slug" params={{ slug: i.vehicles.slug ?? "" }} target="_blank" className="inline-flex items-center gap-1 hover:text-crimson">
                    <Car className="h-3.5 w-3.5" />{i.vehicles.year} {i.vehicles.make} {i.vehicles.model} <span className="font-mono text-xs text-muted-foreground">{i.vehicles.stock_id}</span>
                  </Link>
                )}
              </div>

              {i.subject && <p className="mt-3 text-sm font-semibold">{i.subject}</p>}
              {i.message && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{i.message}</p>}
              {i.status === "closed" && i.closed_at && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded-sm bg-secondary/60 p-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Closed {new Date(i.closed_at).toLocaleString()}
                  {me.isSuper && <> by <strong className="text-foreground">{i.closed_by_email ?? "unknown"}</strong></>}
                </p>
              )}
              {details.length > 0 && (
                <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-sm bg-secondary/50 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {details.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-muted-foreground">{detailLabel[k] ?? k}:</dt><dd className="font-medium">{v}</dd></div>)}
                </dl>
              )}

              {i.user_id && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-xs text-muted-foreground">Reply to the customer (they see it in their account){i.replied_at && <> · last sent {new Date(i.replied_at).toLocaleString()}{me.isSuper && i.replied_by_email ? ` by ${i.replied_by_email}` : ""}</>}</span>
                    <textarea value={reply} onChange={(e) => setReplies((r) => ({ ...r, [i.id]: e.target.value }))} maxLength={4000} rows={2} placeholder="Write your answer…" className={cn(fieldCls, "h-auto py-2")} />
                  </label>
                  {reply.trim() !== (i.reply ?? "") && (
                    <button disabled={busy === i.id || !reply.trim()} onClick={() => update(i.id, { reply: reply.trim(), ...(i.status === "new" ? { status: "contacted" as Status } : {}) }, "Reply sent to the customer's account")} className={btn({ variant: "primary", size: "sm" })}><Send className="h-4 w-4" /> Send reply</button>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs text-muted-foreground">Team note (only staff see this)</span>
                  <input value={note} onChange={(e) => setNotes((n) => ({ ...n, [i.id]: e.target.value }))} maxLength={2000} placeholder="e.g. Called on WhatsApp, sent quote" className={cn(fieldCls, "h-9")} />
                </label>
                {note !== (i.staff_note ?? "") && (
                  <button disabled={busy === i.id} onClick={() => update(i.id, { staff_note: note.trim() || null }, "Note saved")} className={btn({ variant: "outline", size: "sm" })}>Save note</button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                {busy === i.id ? <Loader2 className="m-2 h-4 w-4 animate-spin text-muted-foreground" /> : i.status === "closed" ? (
                  <button onClick={() => update(i.id, { status: "new" }, "Inquiry reopened")} className={btn({ variant: "outline", size: "sm" })}><RotateCcw className="h-4 w-4" /> Reopen</button>
                ) : (
                  <>
                    {i.status === "new" && <button onClick={() => update(i.id, { status: "contacted" }, "Marked as contacted")} className={btn({ variant: "outline", size: "sm" })}><PhoneCall className="h-4 w-4" /> Mark as contacted</button>}
                    <button onClick={() => update(i.id, { status: "closed" }, "Inquiry closed")} className={btn({ variant: "primary", size: "sm" })}><CheckCircle2 className="h-4 w-4" /> Close inquiry</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
