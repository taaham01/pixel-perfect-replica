import { useState, type FormEvent } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, ShieldCheck, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { createAdmin, decideStaffRequest, listAdmins, listStaffPermissions, listStaffRequests, removeStaff, setAdminActive, setAdminRole, setStaffPermissions } from "@/lib/admin.functions";
import { useAdmin } from "@/hooks/use-admin";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { PasswordInput } from "@/components/site/PasswordInput";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  beforeLoad: ({ context }) => { if (!context.admin.isSuper) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Manage staff — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Admins,
});

const permLabels = { can_publish: "Publish / unpublish", can_manage_bookings: "Manage bookings", can_view_customers: "View customers" } as const;
type PermKey = keyof typeof permLabels;
const roleName = { super_admin: "Super Admin", inventory_manager: "Admin" } as const;

function Admins() {
  const me = useAdmin();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const staff = useQuery({ queryKey: ["admin", "staff"], queryFn: () => listAdmins() });
  const perms = useQuery({ queryKey: ["admin", "perms"], queryFn: () => listStaffPermissions() });
  const requests = useQuery({ queryKey: ["admin", "staff-requests"], queryFn: () => listStaffRequests(), enabled: me.isOwner });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["admin"] }); };
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget; const fd = new FormData(form);
    setBusy(true);
    await run(() => createAdmin({ data: { email: String(fd.get("email")), password: String(fd.get("password")), role: (fd.get("role") ?? "inventory_manager") as "inventory_manager" | "super_admin" } }), "Staff account created");
    setBusy(false); form.reset();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Manage staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.isOwner ? "You're the owner: you approve new staff and you're the only one who can add or remove Super Admins." : "Super Admins can add and remove Admins. Only the owner can add or remove Super Admins."}
        </p>
      </div>

      {me.isOwner && (
        <section className="rounded-sm border border-champagne/50 bg-champagne/5 p-5">
          <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-crimson" /> Pending sign-up requests</h2>
          {requests.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
            : !requests.data?.length ? <p className="mt-3 text-sm text-muted-foreground">No one is waiting for approval.</p>
            : (
              <ul className="mt-4 divide-y divide-border rounded-sm border border-border bg-card">
                {requests.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <span>
                      <span className="font-semibold">{r.email}</span>
                      <span className={cn("ml-2 rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", r.role === "super_admin" ? "bg-champagne/20 text-foreground" : "bg-secondary text-muted-foreground")}>{roleName[r.role]}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Requested {new Date(r.requestedAt).toLocaleString()}</span>
                    </span>
                    <span className="flex gap-2">
                      <button onClick={() => run(() => decideStaffRequest({ data: { userId: r.id, approve: true } }), `${r.email} approved`)} className={btn({ variant: "primary", size: "sm" })}><Check className="h-4 w-4" /> Approve</button>
                      <button onClick={() => { if (window.confirm(`Reject and delete the request from ${r.email}?`)) void run(() => decideStaffRequest({ data: { userId: r.id, approve: false } }), "Request rejected"); }} className={btn({ variant: "outline", size: "sm" })}><X className="h-4 w-4" /> Reject</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </section>
      )}

      <form onSubmit={onCreate} className="grid gap-3 rounded-sm border border-border bg-card p-5 md:grid-cols-4">
        <input name="email" type="email" required placeholder="Email" className={fieldCls} />
        <PasswordInput name="password" minLength={10} required placeholder="Temporary password (10+)" className={fieldCls} />
        <select name="role" className={fieldCls}>
          <option value="inventory_manager">Admin</option>
          {me.isOwner && <option value="super_admin">Super Admin</option>}
        </select>
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
              // Owner can manage everyone but themselves; other Super Admins can manage Admins only.
              const canManage = !s.isSelf && !s.isOwner && (me.isOwner || !isSuper);
              const p = perms.data?.find((x) => x.user_id === s.id);
              const cur = { can_publish: !!p?.can_publish, can_manage_bookings: !!p?.can_manage_bookings, can_view_customers: !!p?.can_view_customers };
              return (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="p-3">{s.email}{s.isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</td>
                  <td className="p-3">
                    {s.isOwner ? <span className="inline-flex items-center gap-1 font-semibold"><Crown className="h-3.5 w-3.5 text-champagne" /> Owner</span> : isSuper ? "Super Admin" : "Admin"}
                    {canManage && me.isOwner && (
                      <button className="mt-1 block text-xs text-crimson hover:underline"
                        onClick={() => run(async () => {
                          await setAdminRole({ data: { userId: s.id, role: isSuper ? "inventory_manager" : "super_admin", grant: true } });
                          await setAdminRole({ data: { userId: s.id, role: isSuper ? "super_admin" : "inventory_manager", grant: false } });
                        }, "Role changed")}>
                        {isSuper ? "Make Admin" : "Promote to Super Admin"}
                      </button>
                    )}
                    {canManage && (
                      <button className="mt-1 flex items-center gap-1 text-xs text-crimson hover:underline"
                        onClick={() => { if (window.confirm(`Remove ${s.email} from staff? They will lose all admin access.`)) void run(() => removeStaff({ data: { userId: s.id } }), "Removed from staff"); }}>
                        <UserMinus className="h-3 w-3" /> Remove from staff
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
                    {canManage && <button onClick={() => run(() => setAdminActive({ data: { userId: s.id, active: !s.active } }), "Account updated")} className="mt-1 block text-xs text-crimson hover:underline">{s.active ? "Deactivate" : "Reactivate"}</button>}
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
