import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Gauge, Fuel as FuelIcon, MapPin, Search, Settings2 } from "lucide-react";
import { formatKm, formatPrice } from "@/config/site";
import {
  bodyTypes, fuels, makes, modelsByMake, transmissions, vehicleSlug,
  type Vehicle, type VehicleFilters,
} from "@/data/vehicles";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";

const availabilityLabel = { available: "Available", reserved: "Reserved", sold: "Sold" } as const;

export function VehicleCard({ vehicle: v }: { vehicle: Vehicle }) {
  const slug = vehicleSlug(v);
  return (
    <article className="group flex flex-col overflow-hidden rounded-sm border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link to="/vehicles/$slug" params={{ slug }} className="relative block aspect-[3/2] overflow-hidden bg-muted">
        <img src={v.images[0] ?? ""} alt={`${v.year} ${v.make} ${v.model} ${v.variant}`} loading="lazy" width={1280} height={864}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        <span className="absolute left-3 top-3 rounded-sm bg-ink/85 px-2 py-1 font-mono text-[0.68rem] tracking-wider text-ink-foreground backdrop-blur">#{v.stockId}</span>
        {v.availability !== "available" && (
          <span className={cn("absolute right-3 top-3 rounded-sm px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wider", v.availability === "sold" ? "bg-foreground text-background" : "bg-champagne text-ink")}>
            {availabilityLabel[v.availability]}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{v.year} · {v.make}</p>
            <h3 className="mt-1 text-lg font-bold leading-tight">{v.model} <span className="font-medium text-muted-foreground">{v.variant}</span></h3>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-4 text-sm">
          <Spec icon={Gauge} label={formatKm(v.mileage)} />
          <Spec icon={Settings2} label={v.transmission} />
          <Spec icon={FuelIcon} label={`${v.fuel} · ${v.engine.split(" ")[0] ?? ""}`} />
          <Spec icon={MapPin} label={v.location.split(",")[0] ?? v.location} />
        </dl>
        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <div>
            <p className="eyebrow text-muted-foreground">FOB Price</p>
            <p className="text-2xl font-bold tracking-tight">{formatPrice(v.price, v.currency)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/vehicles/$slug" params={{ slug }} className={btn({ variant: "outline", size: "sm" })}>View Details</Link>
          <Link to="/vehicles/$slug" params={{ slug }} hash="inquiry" className={btn({ variant: "ink", size: "sm" })}>Get Quote</Link>
        </div>
      </div>
    </article>
  );
}

function Spec({ icon: Icon, label }: { icon: typeof Gauge; label: string }) {
  return <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0 text-crimson" /><span className="truncate text-foreground/80">{label}</span></div>;
}

export function VehicleGrid({ vehicles }: { vehicles: Vehicle[] }) {
  if (!vehicles.length) {
    return (
      <div className="rounded-sm border border-dashed border-border px-6 py-16 text-center">
        <p className="text-lg font-semibold">No vehicles match these filters.</p>
        <p className="mt-2 text-muted-foreground">Our sourcing team can find it for you in the Japanese market.</p>
        <Link to="/request-a-car" className={cn(btn({ variant: "primary" }), "mt-6")}>Request a Car <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
    );
  }
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}</div>;
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

const years = Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i));
const priceOpts = [10000, 20000, 30000, 50000, 80000].map((n) => ({ value: String(n), label: `Up to ${formatPrice(n)}` }));
const kmOpts = [20000, 50000, 80000, 120000].map((n) => ({ value: String(n), label: `Under ${formatKm(n)}` }));

/** Filter controls bound to a VehicleFilters object. */
export function FilterPanel({ filters, onChange, compact }: { filters: VehicleFilters; onChange: (f: VehicleFilters) => void; compact?: boolean }) {
  const set = (k: keyof VehicleFilters, val: string) => {
    const num = ["minYear", "maxPrice", "maxMileage"].includes(k);
    const next = { ...filters, [k]: val ? (num ? Number(val) : val) : undefined };
    if (k === "make") next.model = undefined;
    onChange(next);
  };
  return (
    <div className={cn("grid gap-4", compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1")}>
      <SelectField label="Make" value={filters.make} onChange={(v) => set("make", v)} options={makes} />
      <SelectField label="Model" value={filters.model} onChange={(v) => set("model", v)} options={modelsByMake(filters.make)} />
      <SelectField label="Min. Year" value={filters.minYear} onChange={(v) => set("minYear", v)} options={years} />
      <SelectField label="Max. Price" value={filters.maxPrice} onChange={(v) => set("maxPrice", v)} options={priceOpts} />
      <SelectField label="Mileage" value={filters.maxMileage} onChange={(v) => set("maxMileage", v)} options={kmOpts} />
      <SelectField label="Transmission" value={filters.transmission} onChange={(v) => set("transmission", v)} options={transmissions} />
      <SelectField label="Fuel" value={filters.fuel} onChange={(v) => set("fuel", v)} options={fuels} />
      <SelectField label="Body Type" value={filters.body} onChange={(v) => set("body", v)} options={bodyTypes} />
    </div>
  );
}

/** Homepage search module: collects filters and navigates to inventory. */
export function SearchBar() {
  const navigate = useNavigate();
  const [f, setF] = useState<VehicleFilters>({});
  const [port, setPort] = useState("");
  const go = () => navigate({ to: "/vehicles", search: f as Record<string, unknown> });
  return (
    <div className="rounded-sm border border-border bg-card p-5 shadow-lift md:p-8">
      <div className="mb-6 flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <p className="eyebrow text-crimson">Inventory search</p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">Find Your Next Vehicle</h2>
        </div>
      </div>
      <FilterPanel filters={f} onChange={setF} compact />
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <SelectField label="Destination Port" value={port} onChange={setPort} options={["Mombasa", "Dar es Salaam", "Durban", "Jebel Ali", "Karachi", "Chittagong", "Kingston", "Auckland", "Other"]} />
        <label className="block">
          <span className="eyebrow mb-2 block text-muted-foreground">Stock ID / Keyword</span>
          <input value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value || undefined })} onKeyDown={(e) => e.key === "Enter" && go()} placeholder="e.g. AH10241 or Hilux" className={fieldCls} />
        </label>
        <div className="flex items-end">
          <button onClick={go} className={cn(btn({ variant: "primary", size: "md" }), "w-full md:w-auto")}><Search className="h-4 w-4" /> Search Inventory</button>
        </div>
      </div>
    </div>
  );
}

export function SpecificationTable({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid border-t border-border sm:grid-cols-2">
      {rows.map(([k, val]) => (
        <div key={k} className="flex justify-between gap-4 border-b border-border py-3.5 sm:odd:pr-6 sm:even:pl-6">
          <dt className="text-sm text-muted-foreground">{k}</dt>
          <dd className="text-right text-sm font-semibold">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

export function VehicleGallery({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="aspect-[3/2] overflow-hidden rounded-sm bg-muted">
        <img key={i} src={images[i] ?? ""} alt={alt} width={1280} height={864} className="h-full w-full animate-in fade-in object-cover duration-500" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((src, idx) => (
            <button key={idx} onClick={() => setI(idx)} aria-label={`Image ${idx + 1}`}
              className={cn("aspect-[3/2] overflow-hidden rounded-sm border-2 transition-all", idx === i ? "border-crimson" : "border-transparent opacity-60 hover:opacity-100")}>
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
