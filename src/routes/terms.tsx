import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { PageHero } from "@/components/site/primitives";

const t = `Terms & Conditions — ${site.name}`;
const d = `Terms of sale, shipping and use of the ${site.name} website.`;

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => (
    <>
      <PageHero eyebrow="Legal" title="Terms & Conditions" />
      <article className="container-x max-w-3xl space-y-6 py-16 leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground">
        <p className="font-mono text-xs">[Placeholder — have these terms reviewed by a legal professional before publishing.]</p>
        <h2>Vehicle listings</h2>
        <p>Vehicle information and prices are provided in good faith and may change without notice. Availability is confirmed only upon issuance of an invoice.</p>
        <h2>Quotations & payment</h2>
        <p>Quotations state whether prices are FOB or CIF. Payment terms are specified on each invoice.</p>
        <h2 id="shipping" className="scroll-mt-28">Shipping policy</h2>
        <p>Shipping schedules depend on vessel availability. Import duties, taxes and port charges in the destination country are the buyer's responsibility unless stated otherwise.</p>
        <h2>Contact</h2>
        <p>Questions about these terms can be sent to {site.contact.email}.</p>
      </article>
    </>
  ),
});
