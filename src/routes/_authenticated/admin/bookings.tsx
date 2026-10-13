import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAdmin } from "@/hooks/use-admin";

type BStatus = Database["public"]["Enums"]["booking_status"];
const statuses: BStatus[] = ["pending", "confirmed", "cancelled", "completed"];

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  beforeLoad: ({ context }) => { if (!context.admin.perms.bookings) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Bookings — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Bookings,
});

function Bookings() {
  const admin = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*, vehicles(stock_id, make, model, year)").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set(data.map((b) => b.user_id))];
      const { data: profiles } = admin.perms.customers || admin.perms.bookings
        ? await supabase.from("profiles").select("id, full_name, customer_number").in("id", ids) : { data: [] };
      // Phone numbers come back only for Super Admins; staff see the customer ID instead.
      const { data: phones } = admin.isSuper && ids.length ? await supabase.rpc("get_customer_phones", { _user_ids: ids }) : { data: [] };
      const phoneById = new Map((phones ?? []).map((x) => [x.user_id, x.phone]));
      const byId = new Map((profiles ?? []).map((p) => [p.id, { ...p, phone: phoneById.get(p.id) ?? null }]));
      return data.map((b) => ({ ...b, customer: byId.get(b.user_id) }));
    },
  });

  async function setStatus(id: string, status: BStatus) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Booking updated");
    qc.invalidateQueries({ queryKey: ["admin", "bookings"] });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Booking requests</h1>
      <div className="mt-6 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Date</th><th className="p-3">Vehicle</th><th className="p-3">Customer</th><th className="p-3">Message</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {q.data?.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No bookings yet.</td></tr>}
            {q.data?.map((b) => (
              <tr key={b.id} className="border-t border-border align-top">
                <td className="p-3 whitespace-nowrap">{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="p-3">{b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "—"}<div className="font-mono text-xs text-muted-foreground">{b.vehicles?.stock_id}</div></td>
                <td className="p-3">{b.customer?.full_name ?? "—"}<div className="font-mono text-xs text-muted-foreground">{b.customer?.customer_number}</div>{b.customer?.phone && <div className="text-xs text-muted-foreground">{b.customer.phone}</div>}</td>
                <td className="max-w-xs p-3 text-muted-foreground">{b.message}</td>
                <td className="p-3">
                  <select value={b.status} onChange={(e) => setStatus(b.id, e.target.value as BStatus)} className="rounded-sm border border-border bg-background px-2 py-1 capitalize">
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
