import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { site } from "@/config/site";
import { AuthShell } from "@/components/site/AuthShell";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { authErrorMessage, safeRedirect } from "@/lib/customer";
import { cn } from "@/lib/utils";

const t = `Sign In — ${site.name}`;

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: safeRedirect(s.redirect) }),
  head: () => ({ meta: [{ title: t }, { name: "description", content: "Sign in to reserve vehicles and manage your account." }, { name: "robots", content: "noindex" }] }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")).trim(),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) return setError(authErrorMessage(error.message));
    router.history.push(redirect ?? "/account");
  }

  return (
    <AuthShell
      eyebrow="Customer account"
      title="Sign in"
      subtitle="Sign in to reserve vehicles and track your reservations."
      footer={<>New here? <Link to="/signup" search={{ redirect }} className="text-champagne hover:underline">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Email</span><input name="email" type="email" required autoComplete="email" className={fieldCls} /></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Password</span><input name="password" type="password" required autoComplete="current-password" className={fieldCls} /></label>
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in</button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">Staff? <Link to="/admin/login" className="text-crimson hover:underline">Admin sign in</Link></p>
    </AuthShell>
  );
}
