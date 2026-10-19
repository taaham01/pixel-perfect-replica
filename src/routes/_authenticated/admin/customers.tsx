import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { deleteAccount, listCustomers, updateCustomer } from "@/lib/admin.functions";
import { useAdmin } from "@/hooks/use-admin";
import { btn } from "@/components/site/primitives";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  beforeLoad: ({ context }) => { if (!context.admin.perms.customers) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Customers — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Customers,
});

function Customers() {
  const admin = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "customers"], queryFn: () => listCustomers() });

  async function update(userId: string, patch: { active?: boolean; phoneVerified?: boolean }) {
    try { await updateCustomer({ data: { userId, ...patch } }); toast.success("Customer updated"); qc.invalidateQueries({ queryKey: ["admin", "customers"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function remove(userId: string, email: string) {
    if (!window.confirm(`Permanently delete the account ${email} and their bookings? This cannot be undone.`)) return;
    try { await deleteAccount({ data: { userId } }); toast.success("Account deleted"); qc.invalidateQueries({ queryKey: ["admin", "customers"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Customers</h1>
      {q.error && <p className="mt-4 text-crimson">{(q.error as Error).message}</p>}
      <div className="mt-6 overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">ID</th><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Phone</th><th className="p-3">Status</th>{admin.isSuper && <th className="p-3">Actions</th>}</tr>
          </thead>
          <tbody>
            {q.data?.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No customers yet.</td></tr>}
            {q.data?.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{c.customer_number}</td>
                <td className="p-3">{c.full_name ?? "—"}</td>
                <td className="p-3">{c.email}</td>
                <td className="p-3">{admin.isSuper ? (c.phone ?? "—") : <span className="text-muted-foreground">Super Admin only</span>} {c.phone_verified && <span className="text-xs text-champagne">✓ verified</span>}</td>
                <td className="p-3">{c.active ? "Active" : <span className="text-crimson">Suspended</span>}</td>
                {admin.isSuper && (
                  <td className="flex flex-wrap gap-2 p-3">
                    <button onClick={() => update(c.id, { active: !c.active })} className={btn({ variant: "outline", size: "sm" })}>{c.active ? "Suspend" : "Reactivate"}</button>
                    {!c.phone_verified && c.phone && <button onClick={() => update(c.id, { phoneVerified: true })} className={btn({ variant: "outline", size: "sm" })}>Mark phone verified</button>}
                    {admin.isOwner && <button onClick={() => remove(c.id, c.email)} className={btn({ variant: "outline", size: "sm" })}>Delete account</button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
