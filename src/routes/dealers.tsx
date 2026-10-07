import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { PageHero } from "@/components/site/primitives";
import { dealerFeatures } from "@/components/site/sections";
import { DealerForm } from "@/components/site/forms";

const t = `Dealer Partner Program — ${site.name}`;
const d = "Competitive Japanese vehicle sourcing, bulk purchasing, export documentation and shipping coordination for car dealers.";

export const Route = createFileRoute("/dealers")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: DealersPage,
});

function DealersPage() {
  return (
    <>
      <PageHero eyebrow="Dealer program" title="Built for Dealers" subtitle="Whether you are buying one vehicle or sourcing regularly for your business, our export team helps you find competitive Japanese vehicles." />
      <section className="container-x py-20">
        <ul className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {dealerFeatures.map((f) => (
            <li key={f.title} className="bg-background p-8"><f.icon className="h-6 w-6 text-crimson" strokeWidth={1.5} /><p className="mt-6 text-lg font-bold">{f.title}</p></li>
          ))}
        </ul>
      </section>
      <section className="container-x grid gap-12 pb-24 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 className="text-2xl font-bold md:text-3xl">Dealer inquiry</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">Tell us about your business and the vehicles you source. A member of our export team will contact you to discuss partnership terms.</p>
        </div>
        <div className="rounded-sm border border-border bg-card p-6 shadow-card md:p-10 lg:col-span-8"><DealerForm /></div>
      </section>
    </>
  );
}
