import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { site } from "@/config/site";
import { AuthCard } from "@/components/admin/AuthCard";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Customer Sign In — ${site.name}` },
      { name: "description", content: "Sign in to view your profile and booking requests." },
      { property: "og:title", content: `Customer Sign In — ${site.name}` },
      { property: "og:description", content: "Sign in to view your profile and booking requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({ email: String(fd.get("email")).trim(), password: String(fd.get("password")) });
    if (error) { setError("Incorrect email or password."); return; }
    navigate({ to: redirect ?? "/account", replace: true });
  }
  return (
    <AuthCard title="Customer sign in">
      <form onSubmit={onSubmit} className="grid gap-4">
        <input name="email" type="email" required placeholder="Email" className={fieldCls} />
        <input name="password" type="password" required placeholder="Password" className={fieldCls} />
        {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
        <button className={cn(btn({ variant: "primary" }), "w-full")}>Sign in</button>
      </form>
    </AuthCard>
  );
}
