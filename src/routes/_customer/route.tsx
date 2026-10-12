import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Gate for pages that need any signed-in user (customers and staff alike). */
export const Route = createFileRoute("/_customer")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { user: { id: user.id, email: user.email ?? "" } };
  },
  component: () => <Outlet />,
});
