import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btn } from "./primitives";
import { fieldCls } from "./vehicles";
import { cn } from "@/lib/utils";

/** Settings panel that opens on top of the current page (the page stays visible behind it). */
export function SettingsDialog({ open, onOpenChange, staff }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set for admin/staff: shows their email and role instead of customer details, and requires 10+ characters. */
  staff?: { email: string | null; roleLabel: string };
}) {
  const customer = useCustomer();
  const { profile } = customer;
  const email = staff ? staff.email : customer.email;
  const displayName = staff ? "Staff account" : customer.displayName;
  const minLen = staff ? 10 : 8;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close(next: boolean) {
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const password = String(fd.get("password") ?? "");
    if (password.length < minLen) return setError(`Password must be at least ${minLen} characters.`);
    if (password !== String(fd.get("confirm") ?? "")) return setError("The two passwords don't match.");
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      const m = error.message.toLowerCase();
      return setError(
        m.includes("same") ? "Choose a password you haven't used before."
        : m.includes("weak") || m.includes("pwned") || m.includes("known") ? "That password is too easy to guess. Please choose a stronger one."
        : "We couldn't update your password. Please sign in again and retry.",
      );
    }
    form.reset();
    toast.success("Password changed.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account.</DialogDescription>
        </DialogHeader>

        <div className="rounded-sm border border-border bg-secondary/40 p-3 text-sm">
          <p className="font-semibold">{displayName}</p>
          {email && <p className="text-muted-foreground">{email}</p>}
          {staff ? <p className="mt-1 text-xs uppercase tracking-wider text-crimson">{staff.roleLabel}</p> : profile && <p className="mt-1 font-mono text-xs text-crimson">{profile.customerNumber}</p>}
        </div>

        <form onSubmit={onSubmit} className="grid gap-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-crimson" /> Change password</p>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">New password</span>
            <input name="password" type="password" required minLength={minLen} maxLength={128} autoComplete="new-password" className={fieldCls} />
          </label>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Confirm new password</span>
            <input name="confirm" type="password" required minLength={minLen} maxLength={128} autoComplete="new-password" className={fieldCls} />
          </label>
          {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{error}</p>}
          <button disabled={loading} className={cn(btn({ variant: "primary" }), "w-full")}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Update password</button>
        </form>

        {!staff && <Link to="/account" onClick={() => onOpenChange(false)} className="text-center text-sm text-crimson hover:underline">My details &amp; bookings →</Link>}
      </DialogContent>
    </Dialog>
  );
}
