import { createFileRoute } from "@tanstack/react-router";
import { useAdmin } from "@/hooks/use-admin";
import { AdminTab } from "@/components/site/AccountSettings";

export const Route = createFileRoute("/_authenticated/admin/manage")({
  head: () => ({ meta: [{ title: "Manage everything — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Manage,
});

function Manage() {
  const admin = useAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage everything</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every part of the website you can control, in one place.</p>
      </div>
      <AdminTab userId={admin.id} />
    </div>
  );
}
