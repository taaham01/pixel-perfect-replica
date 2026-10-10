import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { site } from "@/config/site";
import { AuthCard } from "@/components/admin/AuthCard";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/admin") ? s.redirect : undefined,
    denied: s.denied === true || s.denied === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Admin Sign In — ${site.name}` },
      { name: "description", content: "Staff sign in for inventory management." },
      { property: "og:title", content: `Admin Sign In — ${site.name}` },
      { property: "og:description", content: "Staff sign in for inventory management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const { redirect, denied } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(denied ? "This account does not have admin access." : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: String(fd.get("email")).trim(), password: String(fd.get("password")) });
    setLoading(false);
    if (error) { setError(error.message.includes("banned") ? "This account has been deactivated." : "Incorrect email or password."); return; }
    navigate({ to: redirect ?? "/admin", replace: true });
  }

  return (
    <AuthCard title="Sign in" subtitle="For authorised staff only. Accounts are created by a Super Admin.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Email</span><input name="email" type="email" required autoComplete="email" className={fieldCls} /></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Password</span><input name="password" type="password" required autoComplete="current-password" className={fieldCls} /></label>
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in</button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">First time setting up? <Link to="/admin/setup" className="text-crimson hover:underline">Create the first Super Admin</Link></p>
    </AuthCard>
  );
}
