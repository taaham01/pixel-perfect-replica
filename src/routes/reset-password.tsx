import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { site } from "@/config/site";
import { AuthShell } from "@/components/site/AuthShell";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/components/site/PasswordInput";

const t = `Choose a New Password — ${site.name}`;

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: t }, { name: "robots", content: "noindex" }] }),
  component: ResetPassword,
});

type Stage = "checking" | "ready" | "invalid" | "done";

function ResetPassword() {
  const [stage, setStage] = useState<Stage>("checking");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cameFromLink = useRef(false);

  useEffect(() => {
    // The emailed link carries the recovery token in the URL; capture that before the client clears it.
    const url = `${window.location.hash}${window.location.search}`;
    cameFromLink.current = /type=recovery|[?&]code=|access_token=/.test(url);
    if (/error=|error_code=/.test(url)) {
      setStage("invalid");
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStage("ready");
    });
    const timer = window.setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession();
      setStage((cur) => (cur !== "checking" ? cur : s.session && cameFromLink.current ? "ready" : "invalid"));
    }, 2500);
    return () => {
      data.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== String(fd.get("confirm") ?? "")) return setError("The two passwords don't match.");
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      const m = error.message.toLowerCase();
      return setError(
        m.includes("same") ? "Choose a password you haven't used before."
        : m.includes("weak") || m.includes("pwned") || m.includes("known") ? "That password is too easy to guess. Please choose a stronger one."
        : "We couldn't update your password. Please request a new link and try again.",
      );
    }
    // End the temporary recovery session so the person signs in fresh with the new password.
    await supabase.auth.signOut();
    setLoading(false);
    setStage("done");
  }

  if (stage === "checking") {
    return (
      <AuthShell eyebrow="Password reset" title="Checking your link…">
        <p className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> One moment.</p>
      </AuthShell>
    );
  }

  if (stage === "invalid") {
    return (
      <AuthShell eyebrow="Password reset" title="This link isn't valid">
        <div className="flex gap-4">
          <TriangleAlert className="h-8 w-8 shrink-0 text-crimson" strokeWidth={1.5} />
          <div className="text-sm leading-relaxed text-muted-foreground">
            <p>The reset link has expired, was already used, or wasn't opened in this browser.</p>
            <Link to="/forgot-password" className={cn(btn({ variant: "primary", size: "sm" }), "mt-4")}>Get a new link</Link>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (stage === "done") {
    return (
      <AuthShell eyebrow="Password reset" title="Password updated">
        <div className="flex gap-4">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-crimson" strokeWidth={1.5} />
          <div className="text-sm leading-relaxed text-muted-foreground">
            <p>Your password has been changed. Sign in with your new password.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/login" search={{ redirect: undefined }} className={btn({ variant: "primary", size: "sm" })}>Customer sign in</Link>
              <Link to="/admin/login" search={{ redirect: undefined, denied: undefined }} className={btn({ variant: "outline", size: "sm" })}>Staff sign in</Link>
            </div>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Password reset" title="Choose a new password" subtitle="Pick a password you haven't used here before.">
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">New password</span><PasswordInput name="password" required minLength={8} maxLength={128} autoComplete="new-password" className={fieldCls} /><span className="mt-1 block text-xs text-muted-foreground">At least 8 characters.</span></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Confirm new password</span><PasswordInput name="confirm" required minLength={8} maxLength={128} autoComplete="new-password" className={fieldCls} /></label>
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Update password</button>
      </form>
    </AuthShell>
  );
}
