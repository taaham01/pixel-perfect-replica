import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type AdminRole = "super_admin" | "inventory_manager";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/admin/login", search: { redirect: location.href } });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (data ?? []).map((r) => r.role as AdminRole);
    if (!roles.length) {
      // Signed in but not staff (e.g. a customer): deny without ending their session.
      throw redirect({ to: "/admin/login", search: { denied: true } });
    }
    return { admin: { id: user.id, email: user.email ?? "", roles, isSuper: roles.includes("super_admin") } };
  },
  component: () => <Outlet />,
});
