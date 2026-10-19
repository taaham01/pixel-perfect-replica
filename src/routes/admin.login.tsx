import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { site } from "@/config/site";
import { AuthCard } from "@/components/admin/AuthCard";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/components/site/PasswordInput";
import { claimOwnerRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string; denied?: boolean } => ({
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
  const entering = useRef(false);

  /** After signing in: make sure the owner holds Super Admin, then open the dashboard. */
  async function enter() {
    if (entering.current) return;
    entering.current = true;
    try { await claimOwnerRole(); } catch { /* not fatal: the dashboard still checks roles */ }
    navigate({ to: redirect ?? "/admin", replace: true });
  }

  // Arriving from the owner's emailed sign-in or confirmation link: the session is picked up from the link, so continue automatically.
  useEffect(() => {
    if (typeof window === "undefined" || !/access_token|code=/.test(window.location.hash + window.location.search)) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => { if (session && event === "SIGNED_IN") void enter(); });
    void supabase.auth.getSession().then(({ data: d }) => { if (d.session) void enter(); });
    return () => data.subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: String(fd.get("email")).trim(), password: String(fd.get("password")) });
    if (error) {
      setLoading(false);
      const m = error.message.toLowerCase();
      setError(m.includes("banned") ? "This account is locked. It may be waiting for the owner's approval, or it has been deactivated." : m.includes("not confirmed") ? "Please confirm your email first, using the link we sent you." : "Incorrect email or password.");
      return;
    }
    await enter();
    setLoading(false);
  }

  return (
    <AuthCard title="Sign in" subtitle="For authorised staff only.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Email</span><input name="email" type="email" required autoComplete="email" className={fieldCls} /></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Password</span><PasswordInput name="password" required autoComplete="current-password" className={fieldCls} /></label>
        <Link to="/forgot-password" className="-mt-2 justify-self-end text-xs text-crimson hover:underline">Forgot password?</Link>
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in</button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">New staff member? <Link to="/admin/setup" className="text-crimson hover:underline">Sign up</Link></p>
    </AuthCard>
  );
}
