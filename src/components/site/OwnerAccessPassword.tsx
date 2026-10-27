import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isPrimaryOwnerEmail } from "@/config/staff";
import { passwordProblem, PASSWORD_HINT } from "@/lib/password-policy";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";
import { PasswordInput } from "./PasswordInput";
import { fieldCls } from "./vehicles";

/**
 * Owner-only (taaham01@gmail.com): change the password that unlocks the staff sign-up screen.
 * The database re-checks that the caller is the owner and their account password before saving,
 * and stores only a bcrypt hash of the new access password.
 */
export function OwnerAccessPassword({ email }: { email: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = isPrimaryOwnerEmail(email);

  const changed = useQuery({
    queryKey: ["staff-access-changed"],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("staff_access_password_changed_at");
      if (error) return null;
      return data;
    },
  });

  if (!isOwner) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const account = String(fd.get("account") ?? "");
    const next = String(fd.get("next") ?? "");
    if (!account) return setError("Enter your own account password to confirm it's you.");
    const weak = passwordProblem(next);
    if (weak) return setError(weak);
    if (next.length > 72) return setError("The access password must be at most 72 characters.");
    if (next !== String(fd.get("confirm") ?? "")) return setError("The two new passwords don't match.");
    if (next === account) return setError("Use a different password from your own account password.");
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("set_staff_access_password", { _account_password: account, _new_password: next });
    setBusy(false);
    if (error) {
      const m = error.message;
      if (m.includes("could not find the function") || m.includes("does not exist")) return setError("This feature needs a one-time database update (migration 0009). Please run it first.");
      return setError(m.includes("incorrect") || m.includes("owner") || m.includes("12–72") ? m : "We couldn't change the access password. Please try again.");
    }
    form.reset();
    toast.success("Staff access password changed. Share the new one only with people you trust.");
    void qc.invalidateQueries({ queryKey: ["staff-access-changed"] });
  }

  const last = changed.data ? new Date(changed.data).toLocaleString() : "Never changed here (still the original password)";

  return (
    <section className="rounded-sm border border-champagne/40 bg-champagne/5 p-5">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-crimson" />
        <div className="min-w-0">
          <h3 className="font-bold">Staff sign-up access password</h3>
          <p className="mt-1 text-sm text-muted-foreground">Only you (the owner) can see this. It's the password people must enter before they can request a staff account. Stored encrypted — nobody, including you, can view it afterwards.</p>
          <p className="mt-2 text-xs text-muted-foreground">Last changed: <span className="font-medium text-foreground">{last}</span></p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:max-w-md">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Your account password</span>
          <PasswordInput name="account" required autoComplete="current-password" className={fieldCls} /></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">New access password</span>
          <PasswordInput name="next" required minLength={12} maxLength={72} autoComplete="new-password" className={fieldCls} />
          <span className="mt-1 block text-xs text-muted-foreground">{PASSWORD_HINT}</span></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Confirm new access password</span>
          <PasswordInput name="confirm" required minLength={12} maxLength={72} autoComplete="new-password" className={fieldCls} /></label>
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={busy} className={cn(btn({ variant: "primary" }), "w-full sm:w-auto")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Change access password
        </button>
      </form>
    </section>
  );
}
