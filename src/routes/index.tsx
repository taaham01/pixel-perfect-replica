import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { site } from "@/config/site";
import { getFacets, getFeaturedVehicles } from "@/lib/vehicles.functions";
import { btn, Reveal, SectionHeader } from "@/components/site/primitives";
import { SearchBar, VehicleGrid } from "@/components/site/vehicles";
import { CTASection, DealerSection, ProcessSteps, TrustSection, WorldMap } from "@/components/site/sections";

const title = `${site.name} — Japanese Cars, Delivered Worldwide`;
const description = "Quality Japanese used vehicles, carefully selected and exported directly to customers and dealers around the world.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const [featured, facets] = await Promise.all([getFeaturedVehicles(), getFacets()]);
    return { featured, facets };
  },
  component: Home,
});

function Home() {
  const { featured, facets } = Route.useLoaderData();
  return (
    <>
      <section className="relative flex min-h-[92vh] items-end overflow-hidden bg-ink pb-40 pt-36 text-ink-foreground md:items-center md:pb-48">
        <img src={hero} alt="Toyota Land Cruiser at a Japanese export port at dusk" width={1920} height={1088} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-[65%_center]" />
        <div className="bg-hero-veil absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
        <div className="container-x relative">
          <p className="eyebrow mb-6 flex animate-fade-up items-center gap-3 text-champagne"><span className="h-px w-8 bg-current" />Export from Japan</p>
          <h1 className="max-w-3xl animate-fade-up text-5xl font-extrabold leading-[0.98] [animation-delay:100ms] md:text-7xl lg:text-8xl">
            Japanese Cars.<br /><span className="text-ink-muted">Delivered Worldwide.</span>
          </h1>
          <p className="mt-7 max-w-xl animate-fade-up text-lg leading-relaxed text-ink-muted [animation-delay:200ms]">
            Quality Japanese vehicles, carefully selected and exported directly to customers and dealers around the world.
          </p>
          <div className="mt-10 flex animate-fade-up flex-wrap gap-3 [animation-delay:300ms]">
            <Link to="/vehicles" className={btn({ variant: "primary", size: "lg" })}>Browse Vehicles <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/request-a-car" className={btn({ variant: "ghostLight", size: "lg" })}>Request a Car</Link>
          </div>
          <p className="mt-10 animate-fade-up font-mono text-xs tracking-[0.2em] text-ink-muted [animation-delay:400ms]">
            JAPAN BASED <span className="mx-2 text-crimson">•</span> WORLDWIDE EXPORT <span className="mx-2 text-crimson">•</span> DEALER FRIENDLY
          </p>
        </div>
      </section>

      <section className="container-x relative z-10 -mt-28">
        <SearchBar facets={facets} />
      </section>

      <section className="py-24 md:py-32">
        <div className="container-x">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeader eyebrow="Inventory" title="Featured Vehicles" subtitle="Explore vehicles currently available for international export." />
            <Link to="/vehicles" className={btn({ variant: "outline" })}>View All Vehicles <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <Reveal><VehicleGrid vehicles={featured} /></Reveal>
        </div>
      </section>

      <section className="bg-ink py-24 md:py-32">
        <div className="container-x">
          <SectionHeader tone="dark" eyebrow="How it works" title="Four steps from Japan to your door." className="mb-14" />
          <ProcessSteps tone="dark" />
        </div>
      </section>

      <TrustSection />
      <WorldMap />
      <DealerSection />
      <CTASection />
    </>
  );
}
