import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InventoryTable, parseAdminFilters } from "@/components/admin/InventoryTable";

export const Route = createFileRoute("/_authenticated/admin/sold")({
  validateSearch: parseAdminFilters,
  head: () => ({ meta: [{ title: "Sold vehicles — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/sold" });
  return (
    <div>
      <div className="mb-6"><p className="eyebrow text-crimson">Inventory</p><h1 className="mt-1 text-3xl font-bold">Sold vehicles</h1></div>
      <InventoryTable filters={filters} lockStatus="sold" onChange={(f) => navigate({ search: f, replace: true })} />
    </div>
  );
}
