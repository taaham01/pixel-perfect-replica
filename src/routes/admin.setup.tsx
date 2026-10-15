import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { site } from "@/config/site";
import { createFirstSuperAdmin, getSetupStatus } from "@/lib/admin.functions";
import { AuthCard } from "@/components/admin/AuthCard";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/components/site/PasswordInput";

export const Route = createFileRoute("/admin/setup")({
  loader: () => getSetupStatus(),
  head: () => ({
    meta: [
      { title: `Admin Setup — ${site.name}` },
      { name: "description", content: "One-time creation of the first Super Admin account." },
      { property: "og:title", content: `Admin Setup — ${site.name}` },
      { property: "og:description", content: "One-time creation of the first Super Admin account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Setup,
});

function Setup() {
  const { needsSetup } = Route.useLoaderData();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!needsSetup) {
    return (
      <AuthCard title="Setup complete" subtitle="A Super Admin already exists. New admin accounts can only be created from inside the dashboard.">
        <Link to="/admin/login" className={cn(btn({ variant: "primary" }), "w-full")}>Go to sign in</Link>
      </AuthCard>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email")).trim();
    const password = String(fd.get("password"));
    if (password !== String(fd.get("confirm"))) { setError("Passwords do not match."); return; }
    setLoading(true); setError(null);
    try {
      await createFirstSuperAdmin({ data: { email, password } });
      await supabase.auth.signInWithPassword({ email, password });
      toast.success("Super Admin created.");
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed.");
    } finally { setLoading(false); }
  }

  return (
    <AuthCard title="Create the first Super Admin" subtitle="This page works only once. After the first Super Admin is created it is permanently locked.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Email</span><input name="email" type="email" required className={fieldCls} /></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Password (min. 10 characters)</span><PasswordInput name="password" minLength={10} required className={fieldCls} /></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Confirm password</span><PasswordInput name="confirm" minLength={10} required className={fieldCls} /></label>
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Create Super Admin</button>
      </form>
    </AuthCard>
  );
}
