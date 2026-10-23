import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { InventoryTable, parseAdminFilters } from "@/components/admin/InventoryTable";
import { btn } from "@/components/site/primitives";
import { DemoCars } from "@/components/admin/DemoCars";
import { useAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/_authenticated/admin/vehicles/")({
  validateSearch: parseAdminFilters,
  head: () => ({ meta: [{ title: "Inventory — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/vehicles/" });
  const admin = useAdmin();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow text-crimson">Inventory</p><h1 className="mt-1 text-3xl font-bold">Manage inventory</h1></div>
        <Link to="/admin/vehicles/new" className={btn({ variant: "primary", size: "sm" })}><PlusCircle className="h-4 w-4" /> Add New Vehicle</Link>
      </div>
      {admin.isSuper && <DemoCars />}
      <InventoryTable filters={filters} onChange={(f) => navigate({ search: f, replace: true })} />
    </div>
  );
}
