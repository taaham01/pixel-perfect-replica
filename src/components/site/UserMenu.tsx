import { useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, LogOut, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { btn } from "./primitives";

function useSignOut() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.history.push("/");
  };
}

function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy(e: { preventDefault: () => void; stopPropagation: () => void }) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the ID.");
    }
  }
  return (
    <button type="button" onClick={copy} aria-label="Copy customer ID" className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground">
      {value} {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** Navbar account area: Sign In when signed out; name, customer ID, settings and log out when signed in. */
export function UserMenu({ layout = "desktop" }: { layout?: "desktop" | "mobile" }) {
  const { user, ready, profile, email } = useCustomer();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const show = () => { window.clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = window.setTimeout(() => setOpen(false), 150); };
  // The username is whatever comes before the @ in the email address.
  const username = email.split("@")[0] || email;

  if (!ready) return layout === "desktop" ? <span className="h-9 w-24" aria-hidden /> : null;

  if (!user) {
    return layout === "desktop"
      ? <Link to="/login" search={{ redirect: undefined }} className={btn({ variant: "ghostLight", size: "sm" })}>Sign In</Link>
      : <Link to="/login" search={{ redirect: undefined }} className="border-b border-ink-line py-4 text-lg font-semibold text-ink-foreground">Sign In</Link>;
  }

  if (layout === "mobile") {
    return (
      <div className="border-b border-ink-line py-4">
        <p className="text-xs uppercase tracking-wider text-ink-muted">Signed in as</p>
        <p className="mt-1 text-lg font-semibold text-ink-foreground">{username}</p>
        {profile && <p className="mt-0.5 font-mono text-xs text-champagne">{profile.customerNumber}</p>}
        <div className="mt-4 flex gap-5 text-sm font-medium text-ink-foreground">
          <Link to="/account" className="inline-flex items-center gap-2"><Settings className="h-4 w-4" /> Settings</Link>
          <button onClick={signOut} className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Log out</button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${username}`}
        onPointerEnter={show}
        onPointerLeave={hide}
        className="grid h-9 w-9 place-items-center rounded-full border border-ink-foreground/25 text-ink-foreground outline-none transition-colors hover:bg-ink-foreground/10 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-ink-foreground/10"
      >
        <UserRound className="h-5 w-5" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} onPointerEnter={show} onPointerLeave={hide} className="w-64">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-semibold">{username}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          {profile && <CopyId value={profile.customerNumber} />}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/account"><Settings className="mr-2 h-4 w-4" /> Settings</Link></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { void signOut(); }} className="text-crimson focus:text-crimson"><LogOut className="mr-2 h-4 w-4" /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
