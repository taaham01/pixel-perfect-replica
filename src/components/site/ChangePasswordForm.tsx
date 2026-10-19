import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { btn } from "./primitives";
import { fieldCls } from "./vehicles";
import { cn } from "@/lib/utils";
import { changeOwnPassword } from "@/lib/password.functions";
import { withTimeout } from "@/lib/async";
import { PasswordInput } from "@/components/site/PasswordInput";

/** 0–4 rough strength score, shown as a meter under the new-password field. */
export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (!pw) return { score: 0, label: "" };
  return { score, label: ["Too weak", "Weak", "Fair", "Good", "Strong"][score] ?? "" };
}

/** Change-password form: verifies the current password, then updates it (browser first, server as fallback). */
export function ChangePasswordForm({ email, minLen, onDone }: { email: string | null; minLen: number; onDone?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const strength = passwordStrength(next);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const currentPassword = String(fd.get("current") ?? "");
    const password = String(fd.get("password") ?? "");
    if (!currentPassword) return setError("Enter your current password.");
    if (password.length < minLen) return setError(`Password must be at least ${minLen} characters.`);
    if (password !== String(fd.get("confirm") ?? "")) return setError("The two passwords don't match.");
    if (password === currentPassword) return setError("Choose a password you haven't used before.");
    setLoading(true);
    setError(null);
    try {
      if (!email) throw new Error("Your account email is missing. Please sign in again.");
      const verify = await withTimeout(supabase.auth.signInWithPassword({ email, password: currentPassword }), 15000);
      if (verify.error) throw new Error("Your current password is incorrect.");
      let browserError: string | null = null;
      try {
        const res = await withTimeout(
          supabase.auth.updateUser({ password, current_password: currentPassword } as Parameters<typeof supabase.auth.updateUser>[0]),
          8000,
          "browser update timed out",
        );
        browserError = res.error ? res.error.message : null;
      } catch (err) {
        browserError = err instanceof Error ? err.message : "failed";
      }
      if (browserError) {
        const m = browserError.toLowerCase();
        if (m.includes("same") || m.includes("different") || m.includes("weak") || m.includes("pwned") || m.includes("known")) throw new Error(browserError);
        try {
          await withTimeout(changeOwnPassword({ data: { password } }), 20000);
        } catch (err) {
          throw new Error(`${browserError} (server fallback: ${err instanceof Error ? err.message : "failed"})`);
        }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const m = raw.toLowerCase();
      if (m.includes("same") || m.includes("different")) setError("Choose a password you haven't used before.");
      else if (m.includes("weak") || m.includes("pwned") || m.includes("known")) setError("That password is too easy to guess. Please choose a stronger one.");
      else setError(`We couldn't update your password${raw ? `: ${raw}` : "."}`);
      return;
    } finally {
      setLoading(false);
    }
    form.reset();
    setNext("");
    toast.success("Password changed.");
    onDone?.();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Current password</span>
        <PasswordInput name="current" required maxLength={128} autoComplete="current-password" className={fieldCls} />
      </label>
      <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">New password</span>
        <PasswordInput name="password" required minLength={minLen} maxLength={128} autoComplete="new-password" className={fieldCls} onChange={(e) => setNext(e.target.value)} />
        {next && (
          <span className="mt-2 flex items-center gap-3" aria-live="polite">
            <span className="flex h-1.5 flex-1 gap-1">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={cn("flex-1 rounded-full bg-border transition-colors", strength.score >= i && (strength.score <= 1 ? "bg-crimson" : strength.score === 2 ? "bg-amber-500" : "bg-emerald-600"))} />
              ))}
            </span>
            <span className="w-16 text-right text-xs text-muted-foreground">{strength.label}</span>
          </span>
        )}
        <span className="mt-1 block text-xs text-muted-foreground">At least {minLen} characters. A mix of letters, numbers and symbols is stronger.</span>
      </label>
      <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Confirm new password</span>
        <PasswordInput name="confirm" required minLength={minLen} maxLength={128} autoComplete="new-password" className={fieldCls} />
      </label>
      {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
      <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full sm:w-auto")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Update password</button>
    </form>
  );
}
