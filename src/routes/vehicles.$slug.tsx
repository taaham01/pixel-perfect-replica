import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, FileCheck2, MessageCircle, ScanSearch, Ship } from "lucide-react";
import { site, whatsappLink } from "@/config/site";
import { engineLabel, formatMileage, vehicleName, vehiclePrice } from "@/data/vehicles";
import { getVehicleBySlug } from "@/lib/vehicles.functions";
import { btn } from "@/components/site/primitives";
import { SpecificationTable, VehicleCard, VehicleGallery } from "@/components/site/vehicles";
import { InquiryForm } from "@/components/site/forms";
import { BookVehicle } from "@/components/site/BookVehicle";
import { vehicleWhatsappMessage } from "@/components/site/WhatsAppButton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vehicles/$slug")({
  loader: async ({ params }) => {
    const res = await getVehicleBySlug({ data: { slug: params.slug } });
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: `Vehicle not found — ${site.name}` }, { name: "robots", content: "noindex" }] };
    const v = loaderData.vehicle;
    const sold = v.status === "sold";
    const t = `${sold ? "SOLD — " : ""}${vehicleName(v)} ${v.variant} — Stock ${v.stockId} | ${site.name}`;
    const d = `${vehicleName(v)} ${v.variant}, ${formatMileage(v.mileage, v.mileageUnit)}${v.transmission ? `, ${v.transmission}` : ""}${v.fuel ? `, ${v.fuel}` : ""}. ${sold ? "This vehicle has been sold." : `${vehiclePrice(v)} FOB. Export from Japan.`}`;
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
          brand: v.make, model: v.model, vehicleModelDate: String(v.year), sku: v.stockId, color: v.exteriorColor ?? undefined,
          mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileage, unitCode: v.mileageUnit === "mi" ? "SMI" : "KMT" },
          offers: { "@type": "Offer", price: v.price, priceCurrency: v.currency, availability: v.status === "available" ? "https://schema.org/InStock" : sold ? "https://schema.org/SoldOut" : "https://schema.org/LimitedAvailability" },
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
      <p className="mt-3 text-muted-foreground">Browse our current inventory or request a similar vehicle.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/vehicles" className={btn({ variant: "ink" })}>Browse Vehicles</Link>
        <Link to="/request-a-car" className={btn({ variant: "outline" })}>Request a Car</Link>
      </div>
    </div>
  );
}

function VehicleDetail() {
  const { vehicle: v, images, related } = Route.useLoaderData();
  const name = vehicleName(v);
  const sold = v.status === "sold";
  const wa = whatsappLink(sold
    ? `Hello, I saw the sold ${name} (Stock ${v.stockId}). Can you source a similar vehicle for me?`
    : vehicleWhatsappMessage(name, v.stockId));

  return (
    <>
      <div className="h-18 bg-ink" />
      <div className="container-x pt-8">
        <Link to={sold ? "/sold-cars" : "/vehicles"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> {sold ? "Sold cars" : "All vehicles"}</Link>
      </div>
      <section className="container-x grid gap-10 py-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <VehicleGallery images={images} alt={`${name} ${v.variant}`} sold={sold} />
        </div>
        <div className="lg:col-span-5">
          <p className="font-mono text-sm text-crimson">Stock #{v.stockId}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight md:text-4xl">{name}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{v.variant}</p>
          <div className="mt-6 flex items-end justify-between border-y border-border py-5">
            <div>
              <p className="eyebrow text-muted-foreground">{sold ? "Sold" : "FOB Price"}</p>
              <p className={cn("text-4xl font-bold tracking-tight", sold && "text-muted-foreground line-through decoration-2")}>{vehiclePrice(v)}</p>
            </div>
            <span className={cn("rounded-sm px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
              v.status === "available" ? "bg-whatsapp/15 text-foreground" : sold ? "bg-crimson text-ink-foreground" : "bg-champagne text-ink")}>{v.status}</span>
          </div>
          {sold && <p className="mt-4 rounded-sm border border-crimson/30 bg-crimson/5 p-4 text-sm">This vehicle has been sold and is no longer available. We can source a similar one for you.</p>}
          <div className="mt-6">
            <SpecificationTable rows={[
              ["Make", v.make], ["Model", v.model], ["Year", String(v.year)], ["Mileage", formatMileage(v.mileage, v.mileageUnit)],
              ["Engine", v.engineCc ? engineLabel(v.engineCc) : null], ["Transmission", v.transmission], ["Fuel", v.fuel], ["Drive", v.drivetrain],
              ["Exterior", v.exteriorColor], ["Interior", v.interiorColor], ["Chassis No.", v.chassisNumber], ["Auction Grade", v.auctionGrade],
              ["Stock ID", v.stockId], ["Location", v.location],
            ]} />
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {sold
              ? <Link to="/request-a-car" className={btn({ variant: "primary", size: "lg" })}>Request a Similar Car</Link>
              : <a href="#inquiry" className={btn({ variant: "primary", size: "lg" })}>Request Export Quote</a>}
            <a href={wa} target="_blank" rel="noreferrer" className={btn({ variant: "whatsapp", size: "lg" })}><MessageCircle className="h-4 w-4" /> Chat on WhatsApp</a>
          </div>
          {v.status === "available" && <BookVehicle vehicleId={v.id} vehicleName={name} />}
        </div>
      </section>

      <section className="container-x grid gap-14 py-16 lg:grid-cols-12">
        <div className="space-y-14 lg:col-span-7">
          {v.description && <Block title="Vehicle Overview"><p className="whitespace-pre-line leading-relaxed text-muted-foreground">{v.description}</p></Block>}
          <Block title="Specifications">
            <SpecificationTable rows={[["Body Type", v.bodyType], ["Engine", v.engineCc ? engineLabel(v.engineCc) : null], ["Drive", v.drivetrain], ["Transmission", v.transmission], ["Fuel", v.fuel], ["Exterior Color", v.exteriorColor], ["Interior Color", v.interiorColor]]} />
          </Block>
          <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2">
            <Info icon={Ship} title="Export Information" text={v.shippingInfo || `Departs from ${v.location || "Japan"}. Quotations available on FOB or CIF terms to your destination port.`} />
            <Info icon={Ship} title="Estimated Shipping" text="Shipping schedule and cost depend on destination and vessel availability. Our team will confirm in your quote." />
            <Info icon={ScanSearch} title="Inspection Information" text="Pre-export inspection can be arranged where required by the destination country." />
            <Info icon={FileCheck2} title="Documents" text="Export certificate, bill of lading and invoice are provided. Additional documents on request." />
          </div>
        </div>
        {!sold && (
          <aside id="inquiry" className="scroll-mt-28 lg:col-span-5">
            <div className="rounded-sm border border-border bg-card p-6 shadow-card md:p-8 lg:sticky lg:top-28">
              <p className="eyebrow text-crimson">Inquiry</p>
              <h2 className="mt-2 text-2xl font-bold">Request this vehicle</h2>
              <p className="mb-6 mt-2 text-sm text-muted-foreground">Receive a full export quotation including shipping to your port.</p>
              <InquiryForm stockId={v.stockId} vehicle={name} />
            </div>
          </aside>
        )}
      </section>

      {related.length > 0 && (
        <section className="border-t border-border py-20">
          <div className="container-x">
            <h2 className="mb-10 text-2xl font-bold md:text-3xl">{sold ? "Available alternatives" : "Similar vehicles"}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{related.map((r) => <VehicleCard key={r.id} vehicle={r} />)}</div>
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
