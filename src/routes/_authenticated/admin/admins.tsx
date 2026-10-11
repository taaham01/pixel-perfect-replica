import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/admins")({
  head: () => ({ meta: [{ title: "Manage admins — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="rounded-sm border border-dashed border-border p-10 text-center">
      <h1 className="text-2xl font-bold">Manage admins</h1>
      <p className="mt-2 text-muted-foreground">This section is not finished yet.</p>
    </div>
  ),
});
