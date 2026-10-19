import { Link } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { useCustomer } from "@/hooks/use-customer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChangePasswordForm } from "@/components/site/ChangePasswordForm";

/** Quick settings panel (used in the admin area): account summary and change password. Customers get the full /settings page. */
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-crimson" /> Change password</p>
        <ChangePasswordForm email={email} minLen={minLen} onDone={() => onOpenChange(false)} />

        <Link to="/settings" search={{ tab: "profile" }} onClick={() => onOpenChange(false)} className="text-center text-sm text-crimson hover:underline">All settings →</Link>
      </DialogContent>
    </Dialog>
  );
}
