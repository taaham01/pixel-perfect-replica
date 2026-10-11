import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({ meta: [{ title: "Activity log — Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <div className="rounded-sm border border-dashed border-border p-10 text-center">
      <h1 className="text-2xl font-bold">Activity log</h1>
      <p className="mt-2 text-muted-foreground">This section is not finished yet.</p>
    </div>
  ),
});
