import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { site } from "@/config/site";
import { parseFilters, type VehicleFilters } from "@/data/vehicles";
import { getFacets, listVehicles } from "@/lib/vehicles.functions";
import { PageHero } from "@/components/site/primitives";
import { InventoryView } from "@/components/site/inventory";

export const Route = createFileRoute("/sold-cars")({
  validateSearch: (s: Record<string, unknown>): VehicleFilters => parseFilters(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [result, facets] = await Promise.all([listVehicles({ data: { scope: "sold", ...deps } }), getFacets()]);
    return { result, facets };
  },
  head: () => ({
    meta: [
      { title: `Sold Cars — ${site.name}` },
      { name: "description", content: "Japanese vehicles we have recently sold and exported to customers worldwide." },
      { property: "og:title", content: `Recently Sold Vehicles — ${site.name}` },
      { property: "og:description", content: "See Japanese vehicles recently exported by our team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SoldCars,
});

function SoldCars() {
  const filters = Route.useSearch();
  const { result, facets } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/sold-cars" });
  return (
    <>
      <PageHero eyebrow="Track record" title="Sold Cars" subtitle="Vehicles recently sold and exported. These are no longer available — ask us to source a similar one." />
      <InventoryView scope="sold" filters={filters} result={result} facets={facets} onChange={(f) => navigate({ search: f, replace: true, resetScroll: false })} />
    </>
  );
}
