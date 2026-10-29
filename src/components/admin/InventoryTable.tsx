import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import { formatMileage, imageUrl, vehiclePrice, type PublishState, type VehicleStatus } from "@/data/vehicles";
import { useAdmin } from "@/hooks/use-admin";
import { btn } from "@/components/site/primitives";
import { Pager, fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { dbErrorMessage } from "./fields";
import { confirmDialog } from "@/components/site/ConfirmDialog";

export interface AdminFilters { q?: string; status?: string; state?: string; make?: string; model?: string; year?: number; page?: number }
const PER = 25;

export function InventoryTable({ filters, onChange, lockStatus }: { filters: AdminFilters; onChange: (f: AdminFilters) => void; lockStatus?: VehicleStatus }) {
  const admin = useAdmin();
  const qc = useQueryClient();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const page = filters.page ?? 1;
  const status = lockStatus ?? filters.status;

  const q = useQuery({
    queryKey: ["admin", "inventory", { ...filters, status }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let r = supabase.from("vehicles").select("id,slug,stock_id,make,model,variant,year,price,currency,mileage,mileage_unit,status,publish_state,primary_thumb_path,updated_at", { count: "exact" });
      const state = filters.state ?? "active";
      if (state === "active") r = r.neq("publish_state", "archived"); else if (state !== "all") r = r.eq("publish_state", state as PublishState);
      if (status) r = r.eq("status", status as VehicleStatus);
      const term = filters.q?.toLowerCase().replace(/[%_\\,()*]/g, " ").trim();
      if (term) r = r.ilike("search_text", `%${term}%`);
      if (filters.make) r = r.ilike("make", filters.make);
      if (filters.model) r = r.ilike("model", `%${filters.model}%`);
      if (filters.year) r = r.eq("year", filters.year);
      const from = (page - 1) * PER;
      const { data, count, error } = await r.order("updated_at", { ascending: false }).order("id").range(from, from + PER - 1);
      if (error) throw error;
      return { rows: data, total: count ?? 0 };
    },
  });

  const rows = q.data?.rows ?? [];
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function bulk(patch: { status?: VehicleStatus; publish_state?: PublishState }, label: string) {
    if (!sel.size) return;
    const danger = patch.publish_state === "archived" || patch.status === "sold";
    if (!(await confirmDialog({ title: `${label} ${sel.size} vehicle${sel.size === 1 ? "" : "s"}?`, description: "This change applies to every selected vehicle.", confirmLabel: label, tone: danger ? "danger" : "primary" }))) return;
    setBusy(true);
    const { error } = await supabase.from("vehicles").update(patch).in("id", [...sel]);
    setBusy(false);
    if (error) { toast.error(dbErrorMessage(error)); return; }
    toast.success(`${sel.size} vehicle(s) updated.`); setSel(new Set()); qc.invalidateQueries({ queryKey: ["admin"] });
  }

  const set = (k: keyof AdminFilters, v: string) => onChange({ ...filters, [k]: v ? (k === "year" ? Number(v) : v) : undefined, page: undefined });

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[1fr_repeat(4,minmax(0,160px))]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input defaultValue={filters.q ?? ""} placeholder="Search stock ID, make, model, chassis — Enter" className={cn(fieldCls, "pl-10")}
            onKeyDown={(e) => e.key === "Enter" && set("q", e.currentTarget.value)} />
        </div>
        {!lockStatus && (
          <select value={filters.status ?? ""} onChange={(e) => set("status", e.target.value)} className={fieldCls} aria-label="Status">
            <option value="">All availability</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option>
          </select>
        )}
        <select value={filters.state ?? "active"} onChange={(e) => set("state", e.target.value)} className={fieldCls} aria-label="Listing state">
          <option value="active">Not archived</option><option value="published">Published</option><option value="draft">Drafts</option><option value="archived">Archived</option><option value="all">Everything</option>
        </select>
        <input defaultValue={filters.make ?? ""} placeholder="Make" className={fieldCls} onKeyDown={(e) => e.key === "Enter" && set("make", e.currentTarget.value)} onBlur={(e) => e.target.value !== (filters.make ?? "") && set("make", e.target.value)} />
        <input defaultValue={filters.model ?? ""} placeholder="Model" className={fieldCls} onKeyDown={(e) => e.key === "Enter" && set("model", e.currentTarget.value)} onBlur={(e) => e.target.value !== (filters.model ?? "") && set("model", e.target.value)} />
        <input defaultValue={filters.year ?? ""} placeholder="Year" inputMode="numeric" className={cn(fieldCls, lockStatus && "md:col-start-5")} onKeyDown={(e) => e.key === "Enter" && set("year", e.currentTarget.value)} onBlur={(e) => e.target.value !== String(filters.year ?? "") && set("year", e.target.value)} />
      </div>

      {sel.size > 0 && (
        <div className="sticky top-14 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-sm border border-crimson/30 bg-card p-3 shadow-card lg:top-2">
          <span className="mr-2 text-sm font-semibold">{sel.size} selected</span>
          <button disabled={busy} onClick={() => bulk({ status: "available" }, "Mark available")} className={btn({ variant: "outline", size: "sm" })}>Available</button>
          <button disabled={busy} onClick={() => bulk({ status: "reserved" }, "Mark reserved")} className={btn({ variant: "outline", size: "sm" })}>Reserved</button>
          <button disabled={busy} onClick={() => bulk({ status: "sold" }, "Mark sold")} className={btn({ variant: "outline", size: "sm" })}>Sold</button>
          {admin.perms.publish && <><button disabled={busy} onClick={() => bulk({ publish_state: "published" }, "Publish")} className={btn({ variant: "outline", size: "sm" })}>Publish</button>
          <button disabled={busy} onClick={() => bulk({ publish_state: "draft" }, "Unpublish")} className={btn({ variant: "outline", size: "sm" })}>Unpublish</button></>}
          {admin.isSuper && <button disabled={busy} onClick={() => bulk({ publish_state: "archived" }, "Archive")} className={btn({ variant: "ink", size: "sm" })}>Archive</button>}
          <button onClick={() => setSel(new Set())} className="ml-auto text-sm text-muted-foreground hover:underline">Clear</button>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 p-3"><input type="checkbox" aria-label="Select all" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map((r) => r.id)))} className="accent-crimson" /></th>
              <th className="p-3">Vehicle</th><th className="p-3">Price</th><th className="p-3">Mileage</th><th className="p-3">Availability</th><th className="p-3">Listing</th><th className="p-3">Updated</th>
            </tr>
          </thead>
          <tbody className={cn(q.isFetching && "opacity-60")}>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="p-3"><input type="checkbox" aria-label={`Select ${r.stock_id}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="accent-crimson" /></td>
                <td className="p-3">
                  <Link to="/admin/vehicles/$id/edit" params={{ id: r.id }} className="flex items-center gap-3">
                    <div className="h-10 w-14 shrink-0 overflow-hidden rounded-sm bg-muted">{r.primary_thumb_path && <img src={imageUrl(r.primary_thumb_path)!} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                    <div><p className="font-semibold hover:text-crimson">{r.year} {r.make} {r.model} <span className="font-normal text-muted-foreground">{r.variant}</span></p><p className="font-mono text-xs text-muted-foreground">#{r.stock_id}</p></div>
                  </Link>
                </td>
                <td className="p-3 font-medium">{vehiclePrice({ price: Number(r.price), currency: r.currency })}</td>
                <td className="p-3">{formatMileage(r.mileage, r.mileage_unit)}</td>
                <td className="p-3"><span className={cn("rounded-sm px-2 py-0.5 text-xs font-semibold capitalize", r.status === "available" ? "bg-whatsapp/15" : r.status === "sold" ? "bg-crimson/15 text-crimson" : "bg-champagne/40")}>{r.status}</span></td>
                <td className="p-3 capitalize text-muted-foreground">{r.publish_state}</td>
                <td className="p-3 text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!q.isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No vehicles found. <Link to="/admin/vehicles/new" className="text-crimson hover:underline">Add one</Link> or <Link to="/admin/import" className="text-crimson hover:underline">import a CSV</Link>.</td></tr>
            )}
            {q.isLoading && <tr><td colSpan={7} className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {q.isError && <tr><td colSpan={7} className="p-6 text-center text-crimson">Could not load inventory.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-xs text-muted-foreground">{(q.data?.total ?? 0).toLocaleString()} vehicle(s)</p>
      <Pager page={page} total={q.data?.total ?? 0} pageSize={PER} onPage={(p) => onChange({ ...filters, page: p })} />
    </div>
  );
}

export function parseAdminFilters(s: Record<string, unknown>): AdminFilters {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const n = (v: unknown) => (v === undefined || v === "" || isNaN(Number(v)) ? undefined : Number(v));
  return { q: str(s.q), status: str(s.status), state: str(s.state), make: str(s.make), model: str(s.model), year: n(s.year), page: n(s.page) };
}
