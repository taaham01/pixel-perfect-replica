import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Car, CircleDollarSign, FileUp, PlusCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { imageUrl, vehiclePrice, mapVehicle } from "@/data/vehicles";
import { useAdmin } from "@/hooks/use-admin";
import { btn } from "@/components/site/primitives";
import { StatusBadge } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: ({ context }) => { if (!context.admin.isSuper) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Dashboard — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const count = async (f: (q: any) => any) => {
  const { count, error } = await f(supabase.from("vehicles").select("id", { count: "exact", head: true }).neq("publish_state", "archived"));
  if (error) throw error;
  return count ?? 0;
};

function Dashboard() {
  const admin = useAdmin();
  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [total, available, reserved, sold, drafts] = await Promise.all([
        count((q) => q), count((q) => q.eq("status", "available")), count((q) => q.eq("status", "reserved")),
        count((q) => q.eq("status", "sold")), count((q) => q.eq("publish_state", "draft")),
      ]);
      return { total, available, reserved, sold, drafts };
    },
  });
  const recent = useQuery({
    queryKey: ["admin", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").order("created_at", { ascending: false }).limit(8);
      if (error) throw error;
      return data.map((r) => ({ ...mapVehicle(r), raw: r }));
    },
  });
  const s = stats.data;
  const cards = [
    { label: "Total vehicles", value: s?.total, to: "/admin/vehicles", search: {} },
    { label: "Available", value: s?.available, to: "/admin/vehicles", search: { status: "available" } },
    { label: "Reserved", value: s?.reserved, to: "/admin/vehicles", search: { status: "reserved" } },
    { label: "Sold", value: s?.sold, to: "/admin/sold", search: {} },
  ] as const;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow text-crimson">Overview</p><h1 className="mt-1 text-3xl font-bold">Dashboard</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/vehicles/new" className={btn({ variant: "primary", size: "sm" })}><PlusCircle className="h-4 w-4" /> Add New Vehicle</Link>
          <Link to="/admin/vehicles" className={btn({ variant: "outline", size: "sm" })}><Car className="h-4 w-4" /> Manage Inventory</Link>
          <Link to="/admin/sold" className={btn({ variant: "outline", size: "sm" })}><CircleDollarSign className="h-4 w-4" /> Sold Vehicles</Link>
          <Link to="/admin/import" className={btn({ variant: "outline", size: "sm" })}><FileUp className="h-4 w-4" /> Import CSV</Link>
          {admin.isSuper && <Link to="/admin/admins" className={btn({ variant: "outline", size: "sm" })}><Users className="h-4 w-4" /> Manage Admins</Link>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} search={c.search} className="rounded-sm border border-border bg-card p-5 transition-shadow hover:shadow-card">
            <p className="eyebrow text-muted-foreground">{c.label}</p>
            <p className="mt-2 text-4xl font-bold">{c.value ?? "—"}</p>
          </Link>
        ))}
      </div>
      {s && s.drafts > 0 && <p className="text-sm text-muted-foreground">{s.drafts} draft(s) not yet published. <Link to="/admin/vehicles" search={{ state: "draft" }} className="text-crimson hover:underline">Review drafts</Link></p>}

      <section>
        <h2 className="mb-4 text-lg font-bold">Recently added</h2>
        {recent.data?.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-10 text-center">
            <p className="text-lg font-semibold">Your inventory is empty.</p>
            <p className="mt-2 text-muted-foreground">Add your first vehicle with photos, or import many at once from a spreadsheet (CSV).</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/admin/vehicles/new" className={btn({ variant: "primary" })}>Add a vehicle</Link>
              <Link to="/admin/import" className={btn({ variant: "outline" })}>Import CSV</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(recent.data ?? []).map((v) => (
              <Link key={v.id} to="/admin/vehicles/$id/edit" params={{ id: v.id }} className="flex gap-3 rounded-sm border border-border bg-card p-3 hover:shadow-card">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-sm bg-muted">{v.thumbUrl && <img src={v.thumbUrl} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">#{v.stockId}</p>
                  <p className="truncate text-sm font-semibold">{v.year} {v.make} {v.model}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs"><span>{vehiclePrice(v)}</span><StatusBadge status={v.status} className="py-0.5" />{v.publishState !== "published" && <span className={cn("rounded-sm bg-muted px-1.5 py-0.5 uppercase")}>{v.publishState}</span>}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
void imageUrl;
