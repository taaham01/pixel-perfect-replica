import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { countries, site } from "@/config/site";
import { dialCodeFor } from "@/config/countries";
import { AuthShell } from "@/components/site/AuthShell";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { authErrorMessage, safeRedirect, signupSchema } from "@/lib/customer";
import { cn } from "@/lib/utils";
import { PasswordInput } from "@/components/site/PasswordInput";

const t = `Create Account — ${site.name}`;

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: safeRedirect(s.redirect) }),
  head: () => ({ meta: [{ title: t }, { name: "description", content: "Create an account to reserve vehicles from our inventory." }, { name: "robots", content: "noindex" }] }),
  component: Signup,
});

function Signup() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const dial = dialCodeFor(country);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      fullName: fd.get("fullName"), country: fd.get("country"), phone: fd.get("phone"),
      email: fd.get("email"), password: fd.get("password"),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please check your details.");
    const v = parsed.data;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { full_name: v.fullName, phone: v.phone, country: v.country },
        emailRedirectTo: `${window.location.origin}${redirect ?? "/account"}`,
      },
    });
    setLoading(false);
    if (error) return setError(authErrorMessage(error.message));
    // Supabase hides whether an address is registered: an existing address comes back with no identities.
    if (data.user && data.user.identities?.length === 0) return setError("An account with this email already exists. Try signing in.");
    if (data.session) return router.history.push(redirect ?? "/account");
    setCheckEmail(v.email);
  }

  if (checkEmail) {
    return (
      <AuthShell eyebrow="Almost there" title="Check your email" footer={<Link to="/login" search={{ redirect }} className="text-champagne hover:underline">Back to sign in</Link>}>
        <div className="flex gap-4">
          <MailCheck className="h-8 w-8 shrink-0 text-crimson" strokeWidth={1.5} />
          <p className="text-sm leading-relaxed text-muted-foreground">We've sent a confirmation link to the email you entered, <strong className="text-foreground">{checkEmail}</strong>, if it exists. Open it to activate your account, then sign in.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Customer account"
      title="Create your account"
      subtitle="Reserve vehicles and track your reservations. Our team uses your details only to handle your requests."
      footer={<>Already registered? <Link to="/login" search={{ redirect }} className="text-champagne hover:underline">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Full name <span className="text-crimson">*</span></span><input name="fullName" required autoComplete="name" maxLength={120} className={fieldCls} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Country <span className="text-crimson">*</span></span>
            <select name="country" required value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" className={fieldCls}>
              <option value="" disabled>Select…</option>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Phone / WhatsApp <span className="text-crimson">*</span></span><input name="phone" type="tel" required autoComplete="tel" placeholder={dial ? `${dial} …` : "+254 700 000000"} maxLength={30} className={fieldCls} /><span className="mt-1 block text-xs text-muted-foreground">Include the country code{dial ? ` (${dial})` : ""}. We'll text you a code to verify it before you can book.</span></label>
        </div>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Email <span className="text-crimson">*</span></span><input name="email" type="email" required autoComplete="email" maxLength={254} className={fieldCls} /></label>
        <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Password <span className="text-crimson">*</span></span><PasswordInput name="password" required minLength={8} maxLength={128} autoComplete="new-password" className={fieldCls} /><span className="mt-1 block text-xs text-muted-foreground">At least 8 characters.</span></label>
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
        <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account</button>
        <p className="text-center text-xs text-muted-foreground">By signing up you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
    </AuthShell>
  );
}
