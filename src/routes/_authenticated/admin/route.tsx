import { useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCustomerApprovals } from "@/lib/admin.functions";
import { Activity, Wrench, UserCheck, Inbox, Car, CircleDollarSign, FileUp, CalendarCheck, LayoutDashboard, LogOut, Settings, UserRound, Menu, PlusCircle, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { Logo } from "@/components/site/Logo";
import { NavArrows } from "@/components/site/NavArrows";
import { cn } from "@/lib/utils";
import { isOwnerEmail, isPrimaryOwnerEmail } from "@/config/staff";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    if (!context.roles.length) throw redirect({ to: "/account" });
    const isSuper = context.roles.includes("super_admin");
    const { data: p } = await supabase.from("staff_permissions").select("*").eq("user_id", context.user.id).maybeSingle();
    const perms = { publish: isSuper || !!p?.can_publish, bookings: isSuper || !!p?.can_manage_bookings, customers: isSuper || !!p?.can_view_customers };
    return { admin: { ...context.user, roles: context.roles, isSuper, isOwner: isSuper && isOwnerEmail(context.user.email), isPrimaryOwner: isSuper && isPrimaryOwnerEmail(context.user.email), perms } };
  },
  head: () => ({ meta: [{ title: "Admin — AL-HASSAN MOTORS JAPAN" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const admin = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  // Customers waiting for approval, shown as a count next to the sidebar link.
  const approvals = useQuery({ queryKey: ["admin", "customer-approvals"], queryFn: () => listCustomerApprovals(), staleTime: 30_000, refetchInterval: 60_000 });
  const waiting = (approvals.data ?? []).filter((c) => !c.approved && !c.suspended).length;
  // New messages from the website's forms.
  const newInquiries = useQuery({
    queryKey: ["admin", "inquiries-new"], staleTime: 30_000, refetchInterval: 60_000,
    queryFn: async () => (await supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new")).count ?? 0,
  });
  const links = [
    { to: "/admin/manage", label: "Manage everything", icon: Wrench },
    { to: "/admin/approvals", label: "Customer approvals", icon: UserCheck, badge: waiting },
    { to: "/admin/inquiries", label: "Inquiries", icon: Inbox, badge: newInquiries.data ?? 0 },
    ...(admin.isSuper ? [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] : []),
    { to: "/admin/vehicles", label: "Inventory", icon: Car, exact: true },
    { to: "/admin/vehicles/new", label: "Add vehicle", icon: PlusCircle },
    { to: "/admin/sold", label: "Sold vehicles", icon: CircleDollarSign },
    { to: "/admin/import", label: "CSV import", icon: FileUp },
    ...(admin.perms.bookings ? [{ to: "/admin/bookings", label: "Bookings", icon: CalendarCheck }] : []),
    ...(admin.perms.customers ? [{ to: "/admin/customers", label: "Customers", icon: UserRound }] : []),
    ...(admin.isSuper ? [{ to: "/admin/admins", label: "Manage staff", icon: Users }, { to: "/admin/activity", label: "Activity log", icon: Activity }] : []),
  ];

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {links.map((l) => (
        <Link key={l.to} to={l.to} onClick={() => setOpen(false)} activeOptions={{ exact: "exact" in l }}
          className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-ink-soft hover:text-ink-foreground"
          activeProps={{ className: "!bg-ink-soft !text-ink-foreground" }}>
          <l.icon className="h-4 w-4" /> {l.label}
          {"badge" in l && !!l.badge && <span className="ml-auto rounded-full bg-crimson px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{l.badge}</span>}
        </Link>
      ))}
      <div className="mt-auto border-t border-ink-line pt-3">
        <p className="truncate px-3 text-xs text-ink-muted">{admin.email}</p>
        <p className="px-3 text-[0.65rem] uppercase tracking-wider text-champagne">{admin.isOwner ? "Owner" : admin.isSuper ? "Super Admin" : "Admin"}</p>
        <Link to="/settings" search={{ tab: "profile", from: "admin" }} onClick={() => setOpen(false)} className="mt-2 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-ink-muted hover:bg-ink-soft hover:text-ink-foreground"><Settings className="h-4 w-4" /> Settings</Link>
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm text-ink-muted hover:bg-ink-soft hover:text-ink-foreground"><LogOut className="h-4 w-4" /> Sign out</button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-ink lg:flex">
        <div className="border-b border-ink-line p-5"><Logo tone="light" /></div>
        {nav}
      </aside>
      <header className="sticky top-0 z-40 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3"><Logo tone="light" /><NavArrows /></div>
        <button onClick={() => setOpen(!open)} aria-label="Menu" className="text-ink-foreground">{open ? <X /> : <Menu />}</button>
      </header>
      {open && <div className="fixed inset-x-0 top-[60px] bottom-0 z-40 flex flex-col overflow-y-auto bg-ink lg:hidden">{nav}</div>}
      <main className="px-4 py-6 md:px-8 md:py-10 lg:ml-64">
        <NavArrows tone="dark" className="mb-4 hidden lg:flex" />
        <Outlet />
      </main>
    </div>
  );
}
