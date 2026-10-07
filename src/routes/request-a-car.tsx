import { createFileRoute } from "@tanstack/react-router";
import { site } from "@/config/site";
import { PageHero } from "@/components/site/primitives";
import { VehicleRequestForm } from "@/components/site/forms";

const t = `Request a Car from Japan — ${site.name}`;
const d = "Can't find the vehicle you need? Tell us your requirements and our sourcing team will search the Japanese market for you.";

export const Route = createFileRoute("/request-a-car")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: RequestPage,
});

function RequestPage() {
  return (
    <>
      <PageHero eyebrow="Vehicle sourcing" title="Request a Car" subtitle="Looking for something specific? Share your requirements and we will source it from the Japanese market." />
      <section className="container-x grid gap-14 py-16 md:py-24 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 className="text-2xl font-bold md:text-3xl">Can't find what you're looking for?</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">Tell us what you need. Our sourcing team will search the Japanese market for you.</p>
          <ol className="mt-10 space-y-6 border-l border-border pl-6">
            {["Share your requirements", "We search available stock in Japan", "Receive matching options with a quote"].map((s, i) => (
              <li key={s} className="relative"><span className="absolute -left-[1.85rem] top-1 h-2.5 w-2.5 rounded-full bg-crimson" /><p className="font-mono text-xs text-crimson">0{i + 1}</p><p className="mt-1 font-semibold">{s}</p></li>
            ))}
          </ol>
        </div>
        <div className="rounded-sm border border-border bg-card p-6 shadow-card md:p-10 lg:col-span-8">
          <VehicleRequestForm />
        </div>
      </section>
    </>
  );
}
