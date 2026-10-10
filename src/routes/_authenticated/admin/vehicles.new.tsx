import { createFileRoute } from "@tanstack/react-router";
import { VehicleEditor } from "@/components/admin/VehicleEditor";

export const Route = createFileRoute("/_authenticated/admin/vehicles/new")({
  head: () => ({ meta: [{ title: "Add vehicle — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => <VehicleEditor />,
});
