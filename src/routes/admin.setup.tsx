import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, KeyRound, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { site } from "@/config/site";
import { isOwnerEmail } from "@/config/staff";
import { checkStaffAccess, requestStaffSignup } from "@/lib/admin.functions";
import { AuthCard } from "@/components/admin/AuthCard";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/components/site/PasswordInput";
import { PASSWORD_HINT, PASSWORD_MIN, passwordProblem } from "@/lib/password-policy";

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [
      { title: `Staff Sign Up — ${site.name}` },
      { name: "description", content: "Restricted sign-up for new staff accounts." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffSignup,
});

type Role = "super_admin" | "inventory_manager";
type Step = { name: "access" } | { name: "form"; access: string } | { name: "pending"; email: string; notified: boolean } | { name: "owner"; email: string };

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

function StaffSignup() {
  const [step, setStep] = useState<Step>({ name: "access" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("inventory_manager");
  const [email, setEmail] = useState("");

  async function onAccess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const access = String(new FormData(e.currentTarget).get("access") ?? "");
    setLoading(true); setError(null);
    try {
      await checkStaffAccess({ data: { access } });
      setStep({ name: "form", access });
    } catch (err) {
      setError(errorText(err, "Incorrect access password."));
    } finally { setLoading(false); }
  }

  async function onSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step.name !== "form") return;
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    const weak = passwordProblem(password, String(fd.get("email") ?? ""));
    if (weak) { setError(weak); return; }
    if (password !== String(fd.get("confirm"))) { setError("Passwords do not match."); return; }
    const addr = email.trim().toLowerCase();
    setLoading(true); setError(null);
    try {
      const res = await requestStaffSignup({ data: { access: step.access, email: addr, password, role: isOwnerEmail(addr) ? "super_admin" : role } });
      setStep(res.kind === "owner_confirm" ? { name: "owner", email: addr } : { name: "pending", email: addr, notified: res.notified });
    } catch (err) {
      const msg = errorText(err, "Sign up failed.");
      if (msg === "Incorrect access password.") { setStep({ name: "access" }); }
      setError(msg);
    } finally { setLoading(false); }
  }

  const signIn = <Link to="/admin/login" search={{ redirect: undefined, denied: undefined }} className={cn(btn({ variant: "primary" }), "w-full")}>Go to staff sign in</Link>;

  if (step.name === "owner") {
    return (
      <AuthCard title="Confirm your email" subtitle="One last step to activate the owner account.">
        <div className="grid gap-5">
          <p className="flex gap-3 rounded-sm border border-border bg-secondary/40 p-4 text-sm"><MailCheck className="h-5 w-5 shrink-0 text-crimson" />
            <span>We sent a confirmation link to <strong>{step.email}</strong>. Open it, then sign in. Your account becomes the owner Super Admin as soon as the email is confirmed.</span></p>
          {signIn}
        </div>
      </AuthCard>
    );
  }

  if (step.name === "pending") {
    return (
      <AuthCard title="Request sent" subtitle="Your staff account is waiting for the owner's approval.">
        <div className="grid gap-5">
          <p className="flex gap-3 rounded-sm border border-border bg-secondary/40 p-4 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-crimson" />
            <span>The account for <strong>{step.email}</strong> is locked until the owner approves it{step.notified ? ". They've been emailed about your request" : ""}. You'll be able to sign in once it's approved.</span></p>
          {signIn}
        </div>
      </AuthCard>
    );
  }

  if (step.name === "access") {
    return (
      <AuthCard title="Staff sign up" subtitle="This area is restricted. Enter the staff access password to continue.">
        <form onSubmit={onAccess} className="grid gap-4">
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Access password</span><PasswordInput name="access" required autoFocus autoComplete="off" className={fieldCls} /></label>
          {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
          <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Continue</button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">Already have an account? <Link to="/admin/login" search={{ redirect: undefined, denied: undefined }} className="text-crimson hover:underline">Sign in</Link></p>
      </AuthCard>
    );
  }

  const owner = isOwnerEmail(email);
  return (
    <AuthCard title="Create your staff account" subtitle="New accounts stay locked until the owner approves them.">
      <form onSubmit={onSignup} className="grid gap-4">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Email</span><input name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} /></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Password</span><PasswordInput name="password" minLength={PASSWORD_MIN} required autoComplete="new-password" className={fieldCls} /><span className="mt-1 block text-xs text-muted-foreground">{PASSWORD_HINT}</span></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Confirm password</span><PasswordInput name="confirm" minLength={PASSWORD_MIN} required autoComplete="new-password" className={fieldCls} /></label>
        {owner ? (
          <p className="flex items-center gap-2 rounded-sm border border-champagne/50 bg-champagne/10 p-3 text-sm"><Crown className="h-4 w-4 text-champagne" /> Owner account: you'll confirm it from your inbox.</p>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="eyebrow mb-2 text-muted-foreground">Account type</legend>
            {([["inventory_manager", "Admin", "Manages inventory, bookings and customers as allowed."], ["super_admin", "Super Admin", "Full control of the website and its Admins."]] as const).map(([value, label, hint]) => (
              <label key={value} className={cn("flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm transition-colors", role === value ? "border-crimson/50 bg-crimson/5" : "border-border hover:bg-secondary/50")}>
                <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="mt-1 accent-[var(--crimson)]" />
                <span><span className="block font-semibold">{label}</span><span className="text-muted-foreground">{hint}</span></span>
              </label>
            ))}
          </fieldset>
        )}
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} {owner ? "Create owner account" : "Request access"}</button>
      </form>
    </AuthCard>
  );
}
