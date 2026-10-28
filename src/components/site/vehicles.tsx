import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Camera, ChevronLeft, ChevronRight, Gauge, Fuel as FuelIcon, MapPin, Search, Settings2 } from "lucide-react";
import { formatPrice } from "@/config/site";
import {
  bodyTypes, fuels, transmissions, formatMileage, vehiclePrice,
  type Facets, type Vehicle, type VehicleFilters, type VehicleImage,
} from "@/data/vehicles";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";
import { HoldTag, ReserveOnCard } from "./Reserve";
import { isUnderProcess } from "@/lib/bookings";

const statusLabel = { available: "Available", reserved: "Reserved", sold: "Sold" } as const;

export function StatusBadge({ status, className }: { status: Vehicle["status"]; className?: string }) {
  if (status === "available") return null;
  return (
    <span className={cn("rounded-sm px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wider", status === "sold" ? "bg-crimson text-ink-foreground" : "bg-champagne text-ink", className)}>
      {statusLabel[status]}
    </span>
  );
}

export function NoPhoto({ className }: { className?: string }) {
  return <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground", className)}><Camera className="h-6 w-6" /><span className="text-xs">Photos coming soon</span></div>;
}

export function VehicleCard({ vehicle: v }: { vehicle: Vehicle }) {
  const slug = v.slug;
  const sold = v.status === "sold";
  return (
    <article className="group flex flex-col overflow-hidden rounded-sm border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link to="/vehicles/$slug" params={{ slug }} className="relative block aspect-[3/2] overflow-hidden bg-muted">
        {v.thumbUrl ? (
          <img src={v.thumbUrl} alt={`${v.year} ${v.make} ${v.model} ${v.variant}`} loading="lazy" width={640} height={427}
            className={cn("h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]", sold && "grayscale-[60%]")} />
        ) : <NoPhoto />}
        <span className="absolute left-3 top-3 rounded-sm bg-ink/85 px-2 py-1 font-mono text-[0.68rem] tracking-wider text-ink-foreground backdrop-blur">#{v.stockId}</span>
        {isUnderProcess(v) ? <HoldTag vehicleId={v.id} className="absolute right-3 top-3" /> : <StatusBadge status={v.status} className="absolute right-3 top-3" />}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{v.year} · {v.make}</p>
          <h3 className="mt-1 text-lg font-bold leading-tight">{v.model} <span className="font-medium text-muted-foreground">{v.variant}</span></h3>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-4 text-sm">
          <Spec icon={Gauge} label={formatMileage(v.mileage, v.mileageUnit)} />
          <Spec icon={Settings2} label={v.transmission ?? "—"} />
          <Spec icon={FuelIcon} label={`${v.fuel ?? "—"}${v.engineCc ? ` · ${(v.engineCc / 1000).toFixed(1)}L` : ""}`} />
          <Spec icon={MapPin} label={v.location?.split(",")[0] ?? "Japan"} />
        </dl>
        <div className="mt-auto pt-6">
          <p className="eyebrow text-muted-foreground">{sold ? "Sold for" : "FOB Price"}</p>
          <p className={cn("text-2xl font-bold tracking-tight", sold && "text-muted-foreground line-through decoration-1")}>{vehiclePrice(v)}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/vehicles/$slug" params={{ slug }} className={cn(btn({ variant: "outline", size: "sm" }), sold && "col-span-2")}>View Details</Link>
          {!sold && <Link to="/vehicles/$slug" params={{ slug }} hash="inquiry" className={btn({ variant: "ink", size: "sm" })}>Get Quote</Link>}
        </div>
        {!sold && <ReserveOnCard vehicleId={v.id} status={v.status} holdUntil={v.holdUntil} name={`${v.year} ${v.make} ${v.model}`} />}
      </div>
    </article>
  );
}

function Spec({ icon: Icon, label }: { icon: typeof Gauge; label: string }) {
  return <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0 text-crimson" /><span className="truncate text-foreground/80">{label}</span></div>;
}

export function VehicleGrid({ vehicles, empty }: { vehicles: Vehicle[]; empty?: React.ReactNode }) {
  if (!vehicles.length) {
    return empty ?? (
      <div className="rounded-sm border border-dashed border-border px-6 py-16 text-center">
        <p className="text-lg font-semibold">No vehicles match these filters.</p>
        <p className="mt-2 text-muted-foreground">Our sourcing team can find it for you in the Japanese market.</p>
        <Link to="/request-a-car" className={cn(btn({ variant: "primary" }), "mt-6")}>Request a Car <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
    );
  }
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}</div>;
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(btn({ variant: "outline", size: "sm" }), "disabled:opacity-40")}><ChevronLeft className="h-4 w-4" /> Prev</button>
      <span className="font-mono text-sm text-muted-foreground">Page {page} of {pages}</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(btn({ variant: "outline", size: "sm" }), "disabled:opacity-40")}>Next <ChevronRight className="h-4 w-4" /></button>
    </nav>
  );
}

/* ---------- Form controls ---------- */
export const fieldCls = "h-11 w-full rounded-sm border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-crimson focus:ring-2 focus:ring-crimson/15";

export function SelectField({ label, value, onChange, options, placeholder = "Any" }: { label: string; value?: string | number | undefined; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder?: string }) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block text-muted-foreground">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
        <option value="">{placeholder}</option>
        {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// Built at render time: on the server, the clock reads 1970 outside a request, which broke page start-up.
const yearList = () => Array.from({ length: 25 }, (_, i) => String(new Date().getFullYear() - i));
const priceOpts = [5000, 10000, 20000, 30000, 50000, 80000, 120000].map((n) => ({ value: String(n), label: formatPrice(n) }));
const kmOpts = [10000, 20000, 50000, 80000, 120000, 200000].map((n) => ({ value: String(n), label: formatMileage(n) }));

/** Filter controls bound to a VehicleFilters object. */
export function FilterPanel({ filters, onChange, facets, compact }: { filters: VehicleFilters; onChange: (f: VehicleFilters) => void; facets: Facets; compact?: boolean }) {
  const set = (k: keyof VehicleFilters, val: string) => {
    const isNum = !["make", "model", "transmission", "fuel", "body", "q", "sort"].includes(k);
    const next: VehicleFilters = { ...filters, [k]: val ? (isNum ? Number(val) : val) : undefined, page: undefined };
    if (k === "make") next.model = undefined;
    onChange(next);
  };
  const models = filters.make ? facets.models[filters.make] ?? [] : [...new Set(Object.values(facets.models).flat())].sort();
  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SelectField label="Make" value={filters.make} onChange={(v) => set("make", v)} options={facets.makes} />
        <SelectField label="Model" value={filters.model} onChange={(v) => set("model", v)} options={models} />
        <SelectField label="Min. Year" value={filters.minYear} onChange={(v) => set("minYear", v)} options={yearList()} />
        <SelectField label="Max. Price" value={filters.maxPrice} onChange={(v) => set("maxPrice", v)} options={priceOpts} />
        <SelectField label="Max. Mileage" value={filters.maxMileage} onChange={(v) => set("maxMileage", v)} options={kmOpts} />
        <SelectField label="Transmission" value={filters.transmission} onChange={(v) => set("transmission", v)} options={transmissions} />
        <SelectField label="Fuel" value={filters.fuel} onChange={(v) => set("fuel", v)} options={fuels} />
        <SelectField label="Body Type" value={filters.body} onChange={(v) => set("body", v)} options={bodyTypes} />
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <SelectField label="Make" value={filters.make} onChange={(v) => set("make", v)} options={facets.makes} />
      <SelectField label="Model" value={filters.model} onChange={(v) => set("model", v)} options={models} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Year from" value={filters.minYear} onChange={(v) => set("minYear", v)} options={yearList()} />
        <SelectField label="Year to" value={filters.maxYear} onChange={(v) => set("maxYear", v)} options={yearList()} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Price from" value={filters.minPrice} onChange={(v) => set("minPrice", v)} options={priceOpts} />
        <SelectField label="Price to" value={filters.maxPrice} onChange={(v) => set("maxPrice", v)} options={priceOpts} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Mileage from" value={filters.minMileage} onChange={(v) => set("minMileage", v)} options={kmOpts} />
        <SelectField label="Mileage to" value={filters.maxMileage} onChange={(v) => set("maxMileage", v)} options={kmOpts} />
      </div>
      <SelectField label="Transmission" value={filters.transmission} onChange={(v) => set("transmission", v)} options={transmissions} />
      <SelectField label="Fuel" value={filters.fuel} onChange={(v) => set("fuel", v)} options={fuels} />
      <SelectField label="Body Type" value={filters.body} onChange={(v) => set("body", v)} options={bodyTypes} />
    </div>
  );
}

/** Homepage search module: collects filters and navigates to inventory. */
export function SearchBar({ facets }: { facets: Facets }) {
  const navigate = useNavigate();
  const [f, setF] = useState<VehicleFilters>({});
  const go = () => navigate({ to: "/vehicles", search: f as Record<string, unknown> });
  return (
    <div className="rounded-sm border border-border bg-card p-5 shadow-lift md:p-8">
      <div className="mb-6">
        <p className="eyebrow text-crimson">Inventory search</p>
        <h2 className="mt-2 text-2xl font-bold md:text-3xl">Find Your Next Vehicle</h2>
      </div>
      <FilterPanel filters={f} onChange={setF} facets={facets} compact />
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="eyebrow mb-2 block text-muted-foreground">Stock ID / Keyword</span>
          <input value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value || undefined })} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="e.g. stock number or model" className={fieldCls} />
        </label>
        <div className="flex items-end">
          <button onClick={go} className={cn(btn({ variant: "primary", size: "md" }), "w-full md:w-auto")}><Search className="h-4 w-4" /> Search Inventory</button>
        </div>
      </div>
    </div>
  );
}

export function SpecificationTable({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="grid border-t border-border sm:grid-cols-2">
      {rows.filter(([, v]) => v).map(([k, val]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-border py-3.5 sm:odd:pr-6 sm:even:pl-6">
          <dt className="text-sm text-muted-foreground">{k}</dt>
          <dd className="text-right text-sm font-semibold">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

export function VehicleGallery({ images, alt, sold }: { images: VehicleImage[]; alt: string; sold?: boolean }) {
  const [i, setI] = useState(0);
  const cur = images[i];
  return (
    <div>
      <div className="relative aspect-[3/2] overflow-hidden rounded-sm bg-muted">
        {cur ? <img key={cur.id} src={cur.url} alt={alt} width={1280} height={853} className="h-full w-full animate-in fade-in object-cover duration-500" /> : <NoPhoto />}
        {sold && <span className="absolute left-4 top-4 rounded-sm bg-crimson px-3 py-1.5 text-sm font-extrabold uppercase tracking-widest text-ink-foreground">Sold</span>}
        {images.length > 1 && (
          <>
            <button onClick={() => setI((i - 1 + images.length) % images.length)} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/70 p-2 text-ink-foreground"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => setI((i + 1) % images.length)} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/70 p-2 text-ink-foreground"><ChevronRight className="h-5 w-5" /></button>
            <span className="absolute bottom-3 right-3 rounded-sm bg-ink/80 px-2 py-1 font-mono text-xs text-ink-foreground">{i + 1} / {images.length}</span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((img, idx) => (
            <button key={img.id} onClick={() => setI(idx)} aria-label={`Photo ${idx + 1}`}
              className={cn("aspect-[3/2] overflow-hidden rounded-sm border-2 transition-all", idx === i ? "border-crimson" : "border-transparent opacity-60 hover:opacity-100")}>
              <img src={img.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
