import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { VehicleEditor } from "@/components/admin/VehicleEditor";

export const Route = createFileRoute("/_authenticated/admin/vehicles/$id/edit")({
  loader: async ({ params }) => {
    const { data, error } = await supabase.from("vehicles").select("*").eq("id", params.id).maybeSingle();
    if (error) throw new Error("Could not load vehicle.");
    if (!data) throw notFound();
    return data;
  },
  head: () => ({ meta: [{ title: "Edit vehicle — Admin" }, { name: "robots", content: "noindex" }] }),
  notFoundComponent: () => <div className="py-20 text-center"><p className="text-lg font-semibold">Vehicle not found.</p><Link to="/admin/vehicles" className="text-crimson hover:underline">Back to inventory</Link></div>,
  component: Page,
});

function Page() {
  const v = Route.useLoaderData();
  return <VehicleEditor key={v.id + v.updated_at} vehicle={v} />;
}
