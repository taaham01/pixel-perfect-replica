import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Mail, MessageCircle, Phone, RotateCcw, Search, UserCheck, X } from "lucide-react";
import { toast } from "@/lib/notify";
import { decideCustomer, listCustomerApprovals } from "@/lib/admin.functions";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/components/site/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  head: () => ({ meta: [{ title: "Customer approvals — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Approvals,
});

type Filter = "pending" | "approved" | "declined" | "all";
type Customer = Awaited<ReturnType<typeof listCustomerApprovals>>[number];
const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "declined", label: "Declined" },
  { id: "all", label: "All customers" },
];

const stateOf = (c: Customer): Exclude<Filter, "all"> => (c.suspended ? "declined" : c.approved ? "approved" : "pending");
const digits = (phone: string) => phone.replace(/\D/g, "");

function usePendingApprovals() {
  return useQuery({ queryKey: ["admin", "customer-approvals"], queryFn: () => listCustomerApprovals(), staleTime: 30_000 });
}

function Approvals() {
  const qc = useQueryClient();
  const q = usePendingApprovals();
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const counts = { pending: 0, approved: 0, declined: 0, all: q.data?.length ?? 0 };
  for (const c of q.data ?? []) counts[stateOf(c)]++;
  const term = search.trim().toLowerCase();
  const rows = (q.data ?? []).filter((c) => (filter === "all" || stateOf(c) === filter)
    && (!term || [c.name, c.email, c.phone, c.customerNumber, c.country].some((v) => v.toLowerCase().includes(term))));

  async function act(c: Customer, action: "approve" | "revoke" | "decline") {
    if (action === "decline" && !(await confirmDialog({ title: "Decline this customer?", description: "Their account will be suspended and they won't be able to sign in.", details: [["Customer", c.name || "—"], ["Email", c.email]], confirmLabel: "Decline", tone: "danger" }))) return;
    if (action === "revoke" && !(await confirmDialog({ title: "Take back approval?", description: "They won't be able to book cars until they're approved again.", details: [["Customer", c.name || "—"], ["Email", c.email]], confirmLabel: "Take back approval", tone: "danger" }))) return;
    setBusy(c.id);
    try {
      await decideCustomer({ data: { userId: c.id, action } });
      toast.success(action === "approve" ? `${c.name || c.email} approved — they can book now.` : action === "decline" ? "Customer declined." : "Approval taken back.");
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow text-crimson">Customers</p>
        <h1 className="mt-1 text-3xl font-bold">Customer approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every new customer appears here. Check their details, then approve them so they can book vehicles.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ id, label }) => (
            <button key={id} onClick={() => setFilter(id)}
              className={cn("rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors", filter === id ? "border-crimson bg-crimson text-primary-foreground" : "border-border hover:bg-secondary")}>
              {label} <span className={cn("ml-1 text-xs", filter === id ? "opacity-90" : "text-muted-foreground")}>{counts[id]}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, ID" className={cn(fieldCls, "h-10 pl-9")} />
        </label>
      </div>

      {q.isLoading && <div className="grid h-40 place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {q.error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson">{(q.error as Error).message}</p>}
      {q.data && rows.length === 0 && (
        <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <UserCheck className="mx-auto mb-2 h-6 w-6" />
          {filter === "pending" && !term ? "No one is waiting for approval." : "No customers match."}
        </div>
      )}

      <div className="grid gap-3">
        {rows.map((c) => {
          const state = stateOf(c);
          return (
            <article key={c.id} className="grid gap-4 rounded-sm border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold">{c.name || <span className="text-muted-foreground">No name given</span>}</h2>
                  <span className="font-mono text-xs text-muted-foreground">{c.customerNumber}</span>
                  <span className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    state === "approved" ? "bg-emerald-600/10 text-emerald-700" : state === "declined" ? "bg-crimson/10 text-crimson" : "bg-champagne/25 text-foreground")}>
                    {state === "pending" ? "Waiting" : state}
                  </span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="min-w-0"><dt className="text-xs text-muted-foreground">Phone / WhatsApp</dt>
                    <dd className="font-semibold">{c.phone ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-crimson"><Phone className="h-3.5 w-3.5" />{c.phone}</a>
                        <a href={`https://wa.me/${digits(c.phone)}`} target="_blank" rel="noreferrer" aria-label="Message on WhatsApp" className="text-emerald-700 hover:text-emerald-600"><MessageCircle className="h-4 w-4" /></a>
                      </span>
                    ) : <span className="font-normal text-crimson">Not given yet</span>}</dd>
                  </div>
                  <div className="min-w-0"><dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="truncate"><a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-crimson"><Mail className="h-3.5 w-3.5 shrink-0" />{c.email}</a>
                      {!c.emailConfirmed && <span className="block text-xs text-muted-foreground">Email not confirmed</span>}</dd>
                  </div>
                  <div><dt className="text-xs text-muted-foreground">Country</dt><dd>{c.country || "—"}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Signed up</dt><dd>{new Date(c.createdAt).toLocaleString()}</dd></div>
                </dl>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {busy === c.id ? <Loader2 className="m-2 h-5 w-5 animate-spin text-muted-foreground" /> : (
                  <>
                    {state !== "approved" && <button onClick={() => act(c, "approve")} className={btn({ variant: "primary", size: "sm" })}><Check className="h-4 w-4" /> Approve</button>}
                    {state === "approved" && <button onClick={() => act(c, "revoke")} className={btn({ variant: "outline", size: "sm" })}><RotateCcw className="h-4 w-4" /> Take back approval</button>}
                    {state !== "declined" && <button onClick={() => act(c, "decline")} className={btn({ variant: "outline", size: "sm" })}><X className="h-4 w-4" /> Decline</button>}
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
