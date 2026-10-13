import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { site } from "@/config/site";
import { AuthShell } from "@/components/site/AuthShell";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { authErrorMessage } from "@/lib/customer";
import { cn } from "@/lib/utils";

const t = `Reset Password — ${site.name}`;

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: "Get a link to reset your password." }, { name: "robots", content: "noindex" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim().toLowerCase();
    if (!email) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    // Only report problems that don't reveal whether the address has an account (e.g. rate limits).
    if (error && /rate|too many|limit/i.test(error.message)) return setError(authErrorMessage(error.message));
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthShell eyebrow="Password reset" title="Check your email" footer={<Link to="/login" search={{ redirect: undefined }} className="text-champagne hover:underline">Back to sign in</Link>}>
        <div className="flex gap-4">
          <MailCheck className="h-8 w-8 shrink-0 text-crimson" strokeWidth={1.5} />
          <p className="text-sm leading-relaxed text-muted-foreground">
            If an account exists for <strong className="text-foreground">{sentTo}</strong>, we've sent a link to reset your password. It can take a minute to arrive, so check your spam folder too. The link works once and expires soon.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Forgot your password?"
      subtitle="Enter the email you signed up with and we'll send you a link to choose a new password."
      footer={<Link to="/login" search={{ redirect: undefined }} className="text-champagne hover:underline">Back to sign in</Link>}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Email</span><input name="email" type="email" required autoComplete="email" maxLength={254} className={fieldCls} /></label>
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link</button>
      </form>
      <p className="mt-6 text-center text-xs text-muted-foreground">This works for customer and staff accounts.</p>
    </AuthShell>
  );
}
