import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, FileText, Globe2, Handshake, Headset, Layers, Receipt, Search, Ship, Truck, Users, Wallet } from "lucide-react";
import { whatsappLink } from "@/config/site";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeader, btn } from "./primitives";

export const processSteps = [
  { n: "01", icon: Search, title: "Choose Your Vehicle", text: "Browse our inventory or tell us what you're looking for." },
  { n: "02", icon: Receipt, title: "Receive Your Quote", text: "Our team confirms the vehicle price, export costs and shipping options." },
  { n: "03", icon: Wallet, title: "Complete Your Purchase", text: "Our team guides you through the documentation and payment process." },
  { n: "04", icon: Ship, title: "We Ship", text: "Your vehicle is prepared and shipped to your selected destination." },
];

export function ProcessSteps({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div className={cn("grid border-t md:grid-cols-4", dark ? "border-ink-line" : "border-border")}>
      {processSteps.map((s, i) => (
        <Reveal key={s.n} delay={i * 100} className={cn("group relative border-b py-10 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0", dark ? "border-ink-line" : "border-border")}>
          <span className="absolute left-0 top-0 h-0.5 w-0 bg-crimson transition-all duration-700 group-hover:w-full md:left-8 md:group-first:left-0" />
          <div className="flex items-center justify-between">
            <span className={cn("font-mono text-sm", dark ? "text-champagne" : "text-crimson")}>{s.n}</span>
            <s.icon className={cn("h-6 w-6 transition-transform duration-500 group-hover:-translate-y-1", dark ? "text-ink-muted" : "text-muted-foreground")} strokeWidth={1.5} />
          </div>
          <h3 className={cn("mt-8 text-xl font-bold", dark && "text-ink-foreground")}>{s.title}</h3>
          <p className={cn("mt-3 leading-relaxed", dark ? "text-ink-muted" : "text-muted-foreground")}>{s.text}</p>
        </Reveal>
      ))}
    </div>
  );
}

const trust = [
  { icon: BadgeCheck, title: "Japanese Vehicle Expertise", text: "We know the Japanese market, grades and specifications inside out." },
  { icon: Layers, title: "Carefully Selected Inventory", text: "Vehicles are chosen for condition, history and export suitability." },
  { icon: Receipt, title: "Transparent Pricing", text: "Clear FOB and CIF quotations with no hidden line items." },
  { icon: Globe2, title: "Worldwide Export", text: "Shipping coordination to ports across multiple regions." },
  { icon: Headset, title: "Dedicated Sales Support", text: "A real person guides you from enquiry to delivery." },
  { icon: Handshake, title: "Dealer-Friendly Service", text: "Flexible sourcing for single units and regular volumes." },
];

export function TrustSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="container-x grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHeader eyebrow="Why us" title="Built Around Trust." subtitle="Every step of an international vehicle purchase should feel clear and accountable. That is how we work." />
        </div>
        <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:col-span-8">
          {trust.map((t, i) => (
            <Reveal key={t.title} delay={i * 60} className="bg-background p-8 transition-colors hover:bg-card">
              <t.icon className="h-6 w-6 text-crimson" strokeWidth={1.5} />
              <h3 className="mt-6 text-lg font-bold">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Japan origin + destination region nodes, positioned on a 1000x500 canvas */
const JAPAN = { x: 845, y: 175 };
const regions = [
  { name: "Africa", x: 530, y: 300 },
  { name: "Middle East", x: 600, y: 200 },
  { name: "South Asia", x: 700, y: 225 },
  { name: "Caribbean", x: 270, y: 225 },
  { name: "Oceania", x: 880, y: 370 },
  { name: "Other International Markets", x: 470, y: 120 },
];

export function WorldMap() {
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-ink-foreground md:py-32">
      <div className="grid-lines absolute inset-0 opacity-30" />
      <div className="container-x relative">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeader tone="dark" eyebrow="Global reach" title="From Japan to the World" subtitle="We coordinate vehicle exports from Japanese ports to buyers across major international regions." />
          <div className="shrink-0">
            <p className="mb-4 text-ink-muted">Looking for a vehicle in your market?</p>
            <a href={whatsappLink("Hello, I'd like to discuss exporting a vehicle to my country.")} target="_blank" rel="noreferrer" className={btn({ variant: "primary", size: "lg" })}>Talk to Our Export Team <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
        <Reveal className="mt-16">
          <svg viewBox="0 0 1000 480" className="h-auto w-full" role="img" aria-label="Export routes from Japan to international regions">
            <defs>
              <pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="var(--ink-muted)" opacity="0.25" /></pattern>
            </defs>
            {/* abstract continents */}
            <g fill="url(#dots)">
              <path d="M150 80 L330 70 L360 150 L300 210 L240 200 L180 160 Z" />
              <path d="M260 230 L330 240 L350 330 L310 430 L280 420 L265 320 Z" />
              <path d="M450 70 L600 60 L640 120 L560 160 L470 150 Z" />
              <path d="M480 180 L590 180 L620 280 L570 400 L520 390 L490 290 Z" />
              <path d="M600 140 L800 90 L880 150 L820 230 L720 260 L640 220 Z" />
              <path d="M820 340 L930 330 L950 400 L860 420 Z" />
            </g>
            {regions.map((r, i) => {
              const cx = (JAPAN.x + r.x) / 2, cy = Math.min(JAPAN.y, r.y) - 90;
              return <path key={r.name} d={`M${JAPAN.x} ${JAPAN.y} Q${cx} ${cy} ${r.x} ${r.y}`} fill="none" stroke="var(--crimson)" strokeWidth="1.5" className="route-line" style={{ animationDelay: `${i * 0.35}s` }} />;
            })}
            {regions.map((r) => (
              <g key={r.name}>
                <circle cx={r.x} cy={r.y} r="4" fill="var(--champagne)" />
                <text x={r.x} y={r.y + 22} textAnchor="middle" fill="var(--ink-foreground)" fontSize="13" fontWeight="600">{r.name}</text>
              </g>
            ))}
            <circle cx={JAPAN.x} cy={JAPAN.y} r="5" fill="var(--crimson)" style={{ animation: "pulse-dot 2s infinite" }} />
            <circle cx={JAPAN.x} cy={JAPAN.y} r="14" fill="none" stroke="var(--crimson)" opacity="0.5" />
            <text x={JAPAN.x + 22} y={JAPAN.y + 5} fill="var(--ink-foreground)" fontSize="14" fontWeight="800" letterSpacing="2">JAPAN</text>
          </svg>
        </Reveal>
      </div>
    </section>
  );
}

export const dealerFeatures = [
  { icon: Search, title: "Competitive Vehicle Sourcing" },
  { icon: Truck, title: "Bulk Purchasing" },
  { icon: FileText, title: "Export Documentation" },
  { icon: Ship, title: "Shipping Coordination" },
  { icon: Headset, title: "Dedicated Sales Support" },
  { icon: Users, title: "Repeat-Buyer Assistance" },
];

export function DealerSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="container-x grid items-center gap-14 lg:grid-cols-2">
        <SectionHeader eyebrow="Dealer program" title="Built for Dealers" subtitle="Whether you are buying one vehicle or sourcing regularly for your business, our export team helps you find competitive Japanese vehicles and coordinates every step of the export." />
        <div>
          <ul className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2">
            {dealerFeatures.map((f) => (
              <li key={f.title} className="flex items-center gap-4 bg-background p-5"><f.icon className="h-5 w-5 shrink-0 text-crimson" strokeWidth={1.5} /><span className="font-semibold">{f.title}</span></li>
            ))}
          </ul>
          <Link to="/dealers" className={cn(btn({ variant: "ink", size: "lg" }), "mt-8")}>Become a Dealer Partner <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}

export function CTASection({ title = "Can't find what you're looking for?", text = "Tell us what you need. Our sourcing team will search the Japanese market for you." }: { title?: string; text?: string }) {
  return (
    <section className="container-x pb-24">
      <div className="relative overflow-hidden rounded-sm bg-crimson px-8 py-14 text-primary-foreground md:px-16 md:py-20">
        <div className="grid-lines absolute inset-0 opacity-30" />
        <div className="relative flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="text-3xl font-bold leading-tight md:text-4xl">{title}</h2>
            <p className="mt-4 text-lg opacity-85">{text}</p>
          </div>
          <Link to="/request-a-car" className={btn({ variant: "ink", size: "lg" })}>Request a Car <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
    </section>
  );
}
