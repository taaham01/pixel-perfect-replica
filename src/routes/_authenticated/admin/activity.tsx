import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  beforeLoad: ({ context }) => { if (!context.admin.isSuper) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Activity log — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Activity,
});

function Activity() {
  const q = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_activity").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  return (
    <div>
      <h1 className="text-2xl font-bold">Activity log</h1>
      <ul className="mt-6 divide-y divide-border rounded-sm border border-border bg-card text-sm">
        {q.data?.length === 0 && <li className="p-4 text-muted-foreground">No activity yet.</li>}
        {q.data?.map((a) => (
          <li key={a.id} className="flex flex-wrap gap-x-4 p-3">
            <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            <span className="font-mono">{a.action}</span>
            <span>{a.actor_email ?? "system"}</span>
            <span className="truncate text-muted-foreground">{JSON.stringify(a.details)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
