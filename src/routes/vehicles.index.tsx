import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { site } from "@/config/site";
import { filterVehicles, getVehicles, type VehicleFilters } from "@/data/vehicles";
import { PageHero, btn } from "@/components/site/primitives";
import { FilterPanel, VehicleGrid, fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";

const num = (v: unknown) => (v === undefined || v === "" || isNaN(Number(v)) ? undefined : Number(v));
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/vehicles/")({
  validateSearch: (s: Partial<Record<keyof VehicleFilters, unknown>>): VehicleFilters => ({
    q: str(s.q), make: str(s.make), model: str(s.model), transmission: str(s.transmission), fuel: str(s.fuel), body: str(s.body),
    minYear: num(s.minYear), maxPrice: num(s.maxPrice), maxMileage: num(s.maxMileage),
    sort: (["newest", "price-asc", "price-desc", "mileage"] as const).find((x) => x === s.sort),
  }),
  head: () => ({
    meta: [
      { title: `Japanese Used Vehicles for Export — ${site.name}` },
      { name: "description", content: "Search and filter Japanese used cars, SUVs, vans and pickups available for international export." },
      { property: "og:title", content: `Vehicle Inventory — ${site.name}` },
      { property: "og:description", content: "Browse Japanese used vehicles available for worldwide export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/vehicles/" });
  const [open, setOpen] = useState(false);
  const set = (f: VehicleFilters) => navigate({ search: f, replace: true, resetScroll: false });
  const results = filterVehicles(getVehicles(), filters);
  const active = Object.entries(filters).filter(([k, v]) => v !== undefined && k !== "sort").length;

  return (
    <>
      <PageHero eyebrow="Inventory" title="Vehicle Inventory" subtitle="Japanese vehicles currently available for international export. Filter by make, budget and specification." />
      <section className="container-x py-12 md:py-16">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={filters.q ?? ""} onChange={(e) => set({ ...filters, q: e.target.value || undefined })} placeholder="Search make, model or Stock ID" className={cn(fieldCls, "pl-10")} aria-label="Search vehicles" />
          </div>
          <div className="flex gap-3">
            <select value={filters.sort ?? "newest"} onChange={(e) => set({ ...filters, sort: e.target.value as VehicleFilters["sort"] })} className={cn(fieldCls, "md:w-56")} aria-label="Sort">
              <option value="newest">Newest</option>
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
                {active > 0 && <button onClick={() => set({ sort: filters.sort })} className="text-sm text-crimson hover:underline">Clear all</button>}
                <button onClick={() => setOpen(false)} className="lg:hidden" aria-label="Close filters"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <FilterPanel filters={filters} onChange={set} />
            <button onClick={() => setOpen(false)} className={cn(btn({ variant: "primary" }), "mt-8 w-full lg:hidden")}>Show {results.length} vehicles</button>
          </aside>
          <div>
            <p className="mb-6 font-mono text-sm text-muted-foreground">{results.length} vehicle{results.length === 1 ? "" : "s"} found</p>
            <VehicleGrid vehicles={results} />
          </div>
        </div>
      </section>
    </>
  );
}
