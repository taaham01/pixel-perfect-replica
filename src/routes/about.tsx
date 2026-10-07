import { createFileRoute } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import { site } from "@/config/site";
import { PageHero, SectionHeader } from "@/components/site/primitives";
import { CTASection, TrustSection } from "@/components/site/sections";

const t = `About Us — ${site.name}`;
const d = "An international Japanese used-car exporter connecting quality vehicles from Japan with customers and dealers worldwide.";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="Japanese Vehicles. Global Connections." />
      <section className="container-x grid items-center gap-14 py-20 md:py-28 lg:grid-cols-2">
        <div>
          <SectionHeader eyebrow="Who we are" title="Connecting quality vehicles from Japan with the world." />
          <div className="mt-8 space-y-5 leading-relaxed text-muted-foreground">
            <p>{site.name} is an international exporter of Japanese used vehicles. We help private buyers and dealers source reliable vehicles from Japan and coordinate every step of the export.</p>
            <p>Our focus is simple: careful vehicle selection, transparent quotations and responsive support from enquiry to delivery.</p>
            <p className="rounded-sm border border-dashed border-border p-4 font-mono text-xs">[Company history, founding year, team and registration details — to be added]</p>
          </div>
        </div>
        <img src={hero} alt="Vehicles awaiting export at a Japanese port" loading="lazy" width={1920} height={1088} className="aspect-[4/3] w-full rounded-sm object-cover" />
      </section>
      <TrustSection />
      <CTASection title="Let's find your next vehicle." text="Browse our inventory or tell us exactly what you need." />
    </>
  );
}
