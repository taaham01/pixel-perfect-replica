import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { PAGE_SIZE, type Facets, type Vehicle, type VehicleFilters } from "@/data/vehicles";
import { btn } from "./primitives";
import { FilterPanel, Pager, VehicleGrid, fieldCls } from "./vehicles";
import { cn } from "@/lib/utils";

export interface InventoryResult { items: Vehicle[]; total: number; page: number; error: string | null }

/** Shared listing layout for Available and Sold inventory. */
export function InventoryView({ scope, filters, onChange, result, facets }: {
  scope: "available" | "sold"; filters: VehicleFilters; onChange: (f: VehicleFilters) => void; result: InventoryResult; facets: Facets;
}) {
  const [open, setOpen] = useState(false);
  const active = Object.entries(filters).filter(([k, v]) => v !== undefined && k !== "sort" && k !== "page").length;
  const noInventory = !result.error && result.total === 0 && active === 0;

  const empty = noInventory ? (
    <div className="rounded-sm border border-dashed border-border px-6 py-16 text-center">
      <p className="text-lg font-semibold">{scope === "sold" ? "No sold vehicles to show yet." : "New stock is being added."}</p>
      <p className="mt-2 text-muted-foreground">{scope === "sold" ? "Recently sold vehicles will appear here." : "Tell us what you are looking for and our team in Japan will source it for you."}</p>
      <Link to="/request-a-car" className={cn(btn({ variant: "primary" }), "mt-6")}>Request a Car</Link>
    </div>
  ) : undefined;

  return (
    <section className="container-x py-12 md:py-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input defaultValue={filters.q ?? ""} onKeyDown={(e) => { if (e.key === "Enter") onChange({ ...filters, q: e.currentTarget.value || undefined, page: undefined }); }}
            onBlur={(e) => { if ((e.target.value || undefined) !== filters.q) onChange({ ...filters, q: e.target.value || undefined, page: undefined }); }}
            placeholder="Search make, model or Stock ID — press Enter" className={cn(fieldCls, "pl-10")} aria-label="Search vehicles" />
        </div>
        <div className="flex gap-3">
          <select value={filters.sort ?? "newest"} onChange={(e) => onChange({ ...filters, sort: e.target.value as VehicleFilters["sort"], page: undefined })} className={cn(fieldCls, "md:w-56")} aria-label="Sort">
            <option value="newest">Recently added</option>
            <option value="year">Newest model year</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="mileage">Lowest Mileage</option>
          </select>
          <button onClick={() => setOpen(true)} className={cn(btn({ variant: "outline" }), "lg:hidden")}><SlidersHorizontal className="h-4 w-4" /> Filters{active ? ` (${active})` : ""}</button>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr]">
        <aside className={cn("lg:block", open ? "fixed inset-0 z-[60] overflow-y-auto bg-background p-6" : "hidden")}>
          <div className="mb-6 flex items-center justify-between">
            <p className="font-bold">Filters</p>
            <div className="flex items-center gap-4">
              {active > 0 && <button onClick={() => onChange({ sort: filters.sort })} className="text-sm text-crimson hover:underline">Clear all</button>}
              <button onClick={() => setOpen(false)} className="lg:hidden" aria-label="Close filters"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <FilterPanel filters={filters} onChange={onChange} facets={facets} />
          <button onClick={() => setOpen(false)} className={cn(btn({ variant: "primary" }), "mt-8 w-full lg:hidden")}>Show {result.total} vehicles</button>
        </aside>
        <div>
          {result.error ? <p className="mb-6 rounded-sm border border-crimson/30 bg-crimson/5 p-4 text-sm">{result.error}</p> :
            <p className="mb-6 font-mono text-sm text-muted-foreground">{result.total.toLocaleString()} vehicle{result.total === 1 ? "" : "s"} found</p>}
          <VehicleGrid vehicles={result.items} empty={empty} />
          <Pager page={result.page} total={result.total} pageSize={PAGE_SIZE} onPage={(p) => { onChange({ ...filters, page: p }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </div>
      </div>
    </section>
  );
}
