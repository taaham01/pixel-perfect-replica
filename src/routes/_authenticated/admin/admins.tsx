import { useState, type FormEvent } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createAdmin, listAdmins, listStaffPermissions, setAdminActive, setAdminRole, setStaffPermissions } from "@/lib/admin.functions";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { PasswordInput } from "@/components/site/PasswordInput";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  beforeLoad: ({ context }) => { if (!context.admin.isSuper) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Manage staff — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Admins,
});

const permLabels = { can_publish: "Publish / unpublish", can_manage_bookings: "Manage bookings", can_view_customers: "View customers" } as const;
type PermKey = keyof typeof permLabels;

function Admins() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const staff = useQuery({ queryKey: ["admin", "staff"], queryFn: () => listAdmins() });
  const perms = useQuery({ queryKey: ["admin", "perms"], queryFn: () => listStaffPermissions() });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "staff"] }); qc.invalidateQueries({ queryKey: ["admin", "perms"] }); };
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; const fd = new FormData(form);
    setBusy(true);
    await run(() => createAdmin({ data: { email: String(fd.get("email")), password: String(fd.get("password")), role: fd.get("role") as "inventory_manager" | "super_admin" } }), "Staff account created");
    setBusy(false); form.reset();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Manage staff</h1>
      <form onSubmit={onCreate} className="grid gap-3 rounded-sm border border-border bg-card p-5 md:grid-cols-4">
        <input name="email" type="email" required placeholder="Email" className={fieldCls} />
        <PasswordInput name="password" minLength={10} required placeholder="Temporary password (10+)" className={fieldCls} />
        <select name="role" className={fieldCls}><option value="inventory_manager">Inventory Team</option><option value="super_admin">Super Admin</option></select>
        <button disabled={busy} className={btn({ variant: "primary" })}>Create account</button>
      </form>
      <div className="overflow-x-auto rounded-sm border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Permissions</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {staff.data?.map((s) => {
              const isSuper = s.roles.includes("super_admin");
              const p = perms.data?.find((x) => x.user_id === s.id);
              const cur = { can_publish: !!p?.can_publish, can_manage_bookings: !!p?.can_manage_bookings, can_view_customers: !!p?.can_view_customers };
              return (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="p-3">{s.email}{s.isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</td>
                  <td className="p-3">
                    {isSuper ? "Super Admin" : "Inventory Team"}
                    {!s.isSelf && (
                      <button className="mt-1 block text-xs text-crimson hover:underline"
                        onClick={() => run(async () => {
                          await setAdminRole({ data: { userId: s.id, role: isSuper ? "inventory_manager" : "super_admin", grant: true } });
                          await setAdminRole({ data: { userId: s.id, role: isSuper ? "super_admin" : "inventory_manager", grant: false } });
                        }, "Role changed")}>
                        {isSuper ? "Make Inventory Team" : "Promote to Super Admin"}
                      </button>
                    )}
                  </td>
                  <td className="p-3">
                    {isSuper ? <span className="text-muted-foreground">Full access</span> : (Object.keys(permLabels) as PermKey[]).map((k) => (
                      <label key={k} className="flex items-center gap-2">
                        <input type="checkbox" checked={cur[k]} onChange={(e) => run(() => setStaffPermissions({ data: { userId: s.id, perms: { ...cur, [k]: e.target.checked } } }), "Permissions saved")} />
                        {permLabels[k]}
                      </label>
                    ))}
                  </td>
                  <td className="p-3">
                    {s.active ? "Active" : <span className="text-crimson">Deactivated</span>}
                    {!s.isSelf && <button onClick={() => run(() => setAdminActive({ data: { userId: s.id, active: !s.active } }), "Account updated")} className="mt-1 block text-xs text-crimson hover:underline">{s.active ? "Deactivate" : "Reactivate"}</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
