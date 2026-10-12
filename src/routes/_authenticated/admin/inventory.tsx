import { createFileRoute, redirect } from "@tanstack/react-router";

/** Inventory team landing page — the inventory list. */
export const Route = createFileRoute("/_authenticated/admin/inventory")({
  beforeLoad: () => { throw redirect({ to: "/admin/vehicles" }); },
});
