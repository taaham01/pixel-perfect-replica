import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "My account" }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

function Account() {
  const { user } = Route.useRouteContext();
  const bookings = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*, vehicles(make, model, year)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="container-x py-32">
      <h1 className="text-3xl font-bold">My account</h1>
      <p className="mt-2 text-muted-foreground">{user.email}</p>
      <h2 className="mt-10 text-xl font-semibold">My booking requests</h2>
      <ul className="mt-4 divide-y divide-border rounded-sm border border-border">
        {bookings.data?.length === 0 && <li className="p-4 text-muted-foreground">No bookings yet.</li>}
        {bookings.data?.map((b) => (
          <li key={b.id} className="flex justify-between p-4">
            <span>{b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "Vehicle"}</span>
            <span className="capitalize">{b.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
