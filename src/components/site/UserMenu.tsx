import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, LogOut, Settings, UserRound } from "lucide-react";
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
  const { user, ready, profile, email, displayName } = useCustomer();
  const signOut = useSignOut();

  if (!ready) return layout === "desktop" ? <span className="h-9 w-24" aria-hidden /> : null;

  if (!user) {
    return layout === "desktop"
      ? <Link to="/login" search={{ redirect: undefined }} className={btn({ variant: "ghostLight", size: "sm" })}>Sign In</Link>
      : <Link to="/login" search={{ redirect: undefined }} className="border-b border-ink-line py-4 text-lg font-semibold text-ink-foreground">Sign In</Link>;
  }

  const initial = (displayName[0] ?? "?").toUpperCase();

  if (layout === "mobile") {
    return (
      <div className="border-b border-ink-line py-4">
        <p className="text-xs uppercase tracking-wider text-ink-muted">Signed in as</p>
        <p className="mt-1 text-lg font-semibold text-ink-foreground">{displayName}</p>
        {profile && <p className="mt-0.5 font-mono text-xs text-champagne">{profile.customerNumber}</p>}
        <div className="mt-4 flex gap-5 text-sm font-medium text-ink-foreground">
          <Link to="/account" className="inline-flex items-center gap-2"><Settings className="h-4 w-4" /> Settings</Link>
          <button onClick={signOut} className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Log out</button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-sm border border-ink-foreground/25 px-2.5 text-sm font-medium text-ink-foreground outline-none transition-colors hover:bg-ink-foreground/10 focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-crimson text-xs font-bold text-primary-foreground">{initial}</span>
        <span className="max-w-[9rem] truncate">{displayName}</span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          {profile && <CopyId value={profile.customerNumber} />}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/account"><UserRound className="mr-2 h-4 w-4" /> My account</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/account"><Settings className="mr-2 h-4 w-4" /> Settings</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => { void signOut(); }} className="text-crimson focus:text-crimson"><LogOut className="mr-2 h-4 w-4" /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
