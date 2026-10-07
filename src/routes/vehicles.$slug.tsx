import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, FileCheck2, MessageCircle, ScanSearch, Ship } from "lucide-react";
import { formatKm, formatPrice, site, whatsappLink } from "@/config/site";
import { getVehicleBySlug, getVehicles, vehicleName, vehicleSlug } from "@/data/vehicles";
import { btn } from "@/components/site/primitives";
import { SpecificationTable, VehicleCard, VehicleGallery } from "@/components/site/vehicles";
import { InquiryForm } from "@/components/site/forms";
import { vehicleWhatsappMessage } from "@/components/site/WhatsAppButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vehicles/$slug")({
  loader: ({ params }) => {
    const vehicle = getVehicleBySlug(params.slug);
    if (!vehicle) throw notFound();
    return { vehicle };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: `Vehicle not found — ${site.name}` }, { name: "robots", content: "noindex" }] };
    const v = loaderData.vehicle;
    const t = `${vehicleName(v)} ${v.variant} — Stock ${v.stockId} | ${site.name}`;
    const d = `${vehicleName(v)} ${v.variant}, ${formatKm(v.mileage)}, ${v.transmission}, ${v.fuel}. ${formatPrice(v.price)} FOB. Export from Japan.`;
    return {
      meta: [
        { title: t }, { name: "description", content: d },
        { property: "og:title", content: t }, { property: "og:description", content: d },
        { property: "og:type", content: "product" }, { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org", "@type": "Car", name: `${vehicleName(v)} ${v.variant}`,
          brand: v.make, model: v.model, vehicleModelDate: String(v.year), sku: v.stockId, color: v.color,
          mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileage, unitCode: "KMT" },
          offers: { "@type": "Offer", price: v.price, priceCurrency: v.currency, availability: v.availability === "available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
        }),
      }],
    };
  },
  notFoundComponent: VehicleNotFound,
  component: VehicleDetail,
});

function VehicleNotFound() {
  return (
    <div className="container-x py-48 text-center">
      <h1 className="text-3xl font-bold">This vehicle is no longer listed.</h1>
      <p className="mt-3 text-muted-foreground">It may have been sold. Browse our current inventory or request a similar vehicle.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/vehicles" className={btn({ variant: "ink" })}>Browse Vehicles</Link>
        <Link to="/request-a-car" className={btn({ variant: "outline" })}>Request a Car</Link>
      </div>
    </div>
  );
}

function VehicleDetail() {
  const { vehicle: v } = Route.useLoaderData();
  const name = vehicleName(v);
  const related = getVehicles().filter((x) => x.id !== v.id && (x.bodyType === v.bodyType || x.make === v.make)).slice(0, 3);
  const wa = whatsappLink(vehicleWhatsappMessage(name, v.stockId));

  return (
    <>
      <div className="h-18 bg-ink" />
      <div className="container-x pt-8">
        <Link to="/vehicles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> All vehicles</Link>
      </div>
      <section className="container-x grid gap-10 py-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <VehicleGallery images={v.images} alt={`${name} ${v.variant}`} />
        </div>
        <div className="lg:col-span-5">
          <p className="font-mono text-sm text-crimson">Stock #{v.stockId}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{name}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{v.variant}</p>
          <div className="mt-6 flex items-end justify-between border-y border-border py-5">
            <div>
              <p className="eyebrow text-muted-foreground">FOB Price</p>
              <p className="text-4xl font-bold tracking-tight">{formatPrice(v.price, v.currency)}</p>
            </div>
            <span className={cn("rounded-sm px-2.5 py-1 text-xs font-bold uppercase tracking-wider", v.availability === "available" ? "bg-whatsapp/15 text-foreground" : "bg-muted text-muted-foreground")}>{v.availability}</span>
          </div>
          <div className="mt-6">
            <SpecificationTable rows={[
              ["Make", v.make], ["Model", v.model], ["Year", String(v.year)], ["Mileage", formatKm(v.mileage)],
              ["Engine", v.engine], ["Transmission", v.transmission], ["Fuel", v.fuel], ["Drive", v.drive],
              ["Color", v.color], ["Chassis No.", v.chassisNumber], ["Stock ID", v.stockId], ["Location", v.location],
            ]} />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a href="#inquiry" className={btn({ variant: "primary", size: "lg" })}>Request Export Quote</a>
            <a href={wa} target="_blank" rel="noreferrer" className={btn({ variant: "whatsapp", size: "lg" })}><MessageCircle className="h-4 w-4" /> Chat on WhatsApp</a>
          </div>
        </div>
      </section>

      <section className="container-x grid gap-14 py-16 lg:grid-cols-12">
        <div className="space-y-14 lg:col-span-7">
          <Block title="Vehicle Overview"><p className="leading-relaxed text-muted-foreground">{v.description}</p></Block>
          <Block title="Specifications">
            <SpecificationTable rows={[["Body Type", v.bodyType], ["Engine", v.engine], ["Drive", v.drive], ["Transmission", v.transmission], ["Fuel", v.fuel], ["Exterior Color", v.color]]} />
          </Block>
          <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2">
            <Info icon={Ship} title="Export Information" text={`Departs from ${v.location}. Quotations available on FOB or CIF terms to your destination port.`} />
            <Info icon={Ship} title="Estimated Shipping" text="Shipping schedule and cost depend on destination and vessel availability. Our team will confirm in your quote." />
            <Info icon={ScanSearch} title="Inspection Information" text="Pre-export inspection can be arranged where required by the destination country." />
            <Info icon={FileCheck2} title="Documents" text="Export certificate, bill of lading and invoice are provided. Additional documents on request." />
          </div>
        </div>
        <aside id="inquiry" className="scroll-mt-28 lg:col-span-5">
          <div className="rounded-sm border border-border bg-card p-6 shadow-card md:p-8 lg:sticky lg:top-28">
            <p className="eyebrow text-crimson">Inquiry</p>
            <h2 className="mt-2 text-2xl font-bold">Request this vehicle</h2>
            <p className="mb-6 mt-2 text-sm text-muted-foreground">Receive a full export quotation including shipping to your port.</p>
            <InquiryForm stockId={v.stockId} vehicle={name} />
          </div>
        </aside>
      </section>

      {related.length > 0 && (
        <section className="border-t border-border py-20">
          <div className="container-x">
            <h2 className="mb-10 text-2xl font-bold md:text-3xl">Similar vehicles</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{related.map((r) => <VehicleCard key={vehicleSlug(r)} vehicle={r} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h2 className="mb-5 text-xl font-bold">{title}</h2>{children}</div>;
}
function Info({ icon: Icon, title, text }: { icon: typeof Ship; title: string; text: string }) {
  return <div className="bg-background p-6"><Icon className="h-5 w-5 text-crimson" strokeWidth={1.5} /><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></div>;
}
