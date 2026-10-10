import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { site } from "@/config/site";
import { parseFilters, type VehicleFilters } from "@/data/vehicles";
import { getFacets, listVehicles } from "@/lib/vehicles.functions";
import { PageHero } from "@/components/site/primitives";
import { InventoryView } from "@/components/site/inventory";

export const Route = createFileRoute("/vehicles/")({
  validateSearch: (s: Record<string, unknown>): VehicleFilters => parseFilters(s),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [result, facets] = await Promise.all([listVehicles({ data: { scope: "available", ...deps } }), getFacets()]);
    return { result, facets };
  },
  head: () => ({
    meta: [
      { title: `Japanese Used Vehicles for Export — ${site.name}` },
      { name: "description", content: "Search and filter Japanese used cars, SUVs, vans and pickups available for international export." },
      { property: "og:title", content: `Vehicle Inventory — ${site.name}` },
      { property: "og:description", content: "Browse Japanese used vehicles available for worldwide export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inventory,
});

function Inventory() {
  const filters = Route.useSearch();
  const { result, facets } = Route.useLoaderData();
  const navigate = useNavigate({ from: "/vehicles/" });
  return (
    <>
      <PageHero eyebrow="Inventory" title="Available Cars" subtitle="Japanese vehicles currently available for international export. Filter by make, budget and specification." />
      <InventoryView scope="available" filters={filters} result={result} facets={facets} onChange={(f) => navigate({ search: f, replace: true, resetScroll: false })} />
    </>
  );
}
