import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getSessionFast } from "@/lib/auth-store";

export type AdminRole = "super_admin" | "inventory_manager";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = (await getSessionFast(5000))?.user ?? null;
    if (!user) {
      if (location.pathname.startsWith("/admin")) throw redirect({ to: "/admin/login", search: { redirect: location.href } });
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (data ?? []).map((r) => r.role as AdminRole);
    return { user: { id: user.id, email: user.email ?? "" }, roles };
  },
  component: () => <Outlet />,
});
