import { useState, type FormEvent, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, Loader2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { countries } from "@/config/site";
import { useCustomer } from "@/hooks/use-customer";
import { useSaveProfile } from "@/hooks/use-save-profile";
import { authErrorMessage, detailsSchema } from "@/lib/customer";
import { fetchCustomerDetails } from "@/lib/customer-details";
import { fieldCls } from "./vehicles";
import { btn } from "./primitives";
import { cn } from "@/lib/utils";

type Tab = "profile" | "password";

const tabs: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "password", label: "Password", icon: KeyRound },
];

/** Big settings window that floats over the current page (the page stays visible around its edges). */
export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [tab, setTab] = useState<Tab>("profile");
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex h-[calc(100dvh-3rem)] w-[calc(100vw-1.5rem)] max-w-[1200px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-ink-line bg-background shadow-lift outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:h-[calc(100dvh-6rem)] sm:w-[calc(100vw-8rem)] md:flex-row"
        >
          <aside className="flex shrink-0 flex-col bg-ink text-ink-foreground md:w-64">
            <div className="flex items-center justify-between px-5 py-4 md:block md:py-6">
              <DialogPrimitive.Title className="text-xl font-semibold">Settings</DialogPrimitive.Title>
              <DialogPrimitive.Close aria-label="Close settings" className="rounded-sm p-1 text-ink-muted hover:text-ink-foreground focus-visible:ring-2 focus-visible:ring-ring md:hidden">
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Settings sections">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? "page" : undefined}
                  className={cn("flex items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-semibold transition-colors", tab === id ? "bg-ink-soft text-ink-foreground" : "text-ink-muted hover:bg-ink-soft/60 hover:text-ink-foreground")}
                >
                  <Icon className={cn("h-4 w-4", tab === id && "text-champagne")} /> {label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="relative min-h-0 flex-1 overflow-y-auto p-6 sm:p-10">
            <DialogPrimitive.Close aria-label="Close settings" className="absolute right-4 top-4 hidden rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:block">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
            {tab === "profile" ? <ProfilePanel /> : <PasswordPanel onClose={() => onOpenChange(false)} />}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Panel({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl">
      <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function ProfilePanel() {
  const { user, email } = useCustomer();
  const userId = user?.id ?? "";
  const { data: details, isLoading } = useQuery({
    queryKey: ["customer-details", userId],
    queryFn: () => fetchCustomerDetails(userId),
    enabled: !!userId,
  });
  const save = useSaveProfile(userId);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = detailsSchema.safeParse({ fullName: fd.get("fullName"), country: fd.get("country"), phone: fd.get("phone") });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check your details."); return; }
    save.mutate(parsed.data);
  }

  return (
    <Panel title="Profile" intro="Your name, country and phone number. Your email and customer ID can't be changed here.">
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        // key remounts the form once details load so defaultValue is applied
        <form key={details?.customerNumber ?? "new"} onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <ReadOnly label="Email" value={email ?? ""} />
            <ReadOnly label="Customer ID" value={details?.customerNumber ?? "Assigned on first save"} mono />
          </div>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Full name</span>
            <input name="fullName" required defaultValue={details?.fullName} maxLength={100} autoComplete="name" className={fieldCls} />
          </label>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Country</span>
            <select name="country" required defaultValue={details?.country ?? ""} className={fieldCls}>
              <option value="" disabled>Select…</option>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Phone / WhatsApp</span>
            <input name="phone" type="tel" required defaultValue={details?.phone} maxLength={30} autoComplete="tel" className={fieldCls} />
            <span className="mt-1 block text-xs text-muted-foreground">
              {details?.phoneVerified ? "Verified. Changing your number means it has to be verified again." : "Not verified yet. Verify it on the My Account page to book a car."}
            </span>
          </label>
          <button type="submit" disabled={save.isPending} className={btn({ variant: "primary", size: "md" })}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save changes
          </button>
        </form>
      )}
    </Panel>
  );
}

function ReadOnly({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="eyebrow mb-2 block text-muted-foreground">{label}</span>
      <div className={cn("flex h-11 items-center truncate rounded-sm border border-input bg-muted px-3 text-sm text-muted-foreground", mono && "font-mono")}>{value}</div>
    </div>
  );
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(8, "Your new password must be at least 8 characters.").max(72, "Your new password is too long (72 characters max)."),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "The new passwords don't match.", path: ["confirm"] })
  .refine((v) => v.next !== v.current, { message: "Your new password must be different from the current one.", path: ["next"] });

function PasswordField({ id, label, value, onChange, autoComplete, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="eyebrow mb-2 block text-muted-foreground">{label}</label>
      <div className="relative">
        <input id={id} type={shown ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required className={cn(fieldCls, "pr-11")} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground">
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PasswordPanel({ onClose }: { onClose: () => void }) {
  const { email } = useCustomer();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: async () => {
      if (!email) throw new Error("We couldn't find your email. Please sign in again.");
      // Prove the person knows the current password before allowing a change.
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (verifyErr) throw new Error("Your current password is incorrect.");
      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) throw new Error(authErrorMessage(updateErr.message));
      if (signOutOthers) await supabase.auth.signOut({ scope: "others" });
    },
    onSuccess: () => {
      toast.success("Your password has been changed.");
      setCurrent(""); setNext(""); setConfirm(""); setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse({ current, next, confirm });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Please check the form."); return; }
    setError(null);
    change.mutate();
  }

  return (
    <Panel title="Change password" intro="Enter your current password, then choose a new one.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <PasswordField id="pw-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
        <p className="-mt-3 text-xs">
          <Link to="/forgot-password" onClick={onClose} className="text-crimson underline-offset-4 hover:underline">Forgot your current password?</Link>
        </p>
        <PasswordField id="pw-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" hint="At least 8 characters." />
        <PasswordField id="pw-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <label className="flex items-start gap-3 text-sm text-foreground">
          <input type="checkbox" checked={signOutOthers} onChange={(e) => setSignOutOthers(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--crimson)]" />
          <span>Sign me out on my other devices<span className="block text-xs text-muted-foreground">Recommended. This device stays signed in.</span></span>
        </label>
        {error && <p role="alert" className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={change.isPending} className={btn({ variant: "primary", size: "md" })}>
          {change.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Update password
        </button>
      </form>
    </Panel>
  );
}
