import { useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Copy, LogOut, Settings, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { btn } from "./primitives";
import { SettingsDialog } from "./SettingsDialog";

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
    <button type="button" onClick={copy} aria-label="Copy customer ID" className="inline-flex items-center gap-1.5 font-mono text-xs text-champagne hover:text-ink-foreground">
      {value} {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** Navbar account area: Sign In when signed out; name, customer ID, settings and log out when signed in. */
export function UserMenu({ layout = "desktop" }: { layout?: "desktop" | "mobile" }) {
  const { user, ready, profile, email, displayName } = useCustomer();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const show = () => { window.clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = window.setTimeout(() => setOpen(false), 150); };

  if (!ready) return layout === "desktop" ? <span className="h-9 w-24" aria-hidden /> : null;

  if (!user) {
    return layout === "desktop"
      ? <Link to="/login" search={{ redirect: undefined }} className={btn({ variant: "ghostLight", size: "sm" })}>Sign In</Link>
      : <Link to="/login" search={{ redirect: undefined }} className="border-b border-ink-line py-4 text-lg font-semibold text-ink-foreground">Sign In</Link>;
  }

  if (layout === "mobile") {
    return (
      <>
      <div className="border-b border-ink-line py-4">
        <p className="text-xs uppercase tracking-wider text-ink-muted">Signed in as</p>
        <p className="mt-1 text-lg font-semibold text-ink-foreground">{displayName}</p>
        {profile && <p className="mt-0.5 font-mono text-xs text-champagne">{profile.customerNumber}</p>}
        <div className="mt-4 flex gap-5 text-sm font-medium text-ink-foreground">
          <button onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-2"><Settings className="h-4 w-4" /> Settings</button>
          <button onClick={signOut} className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Log out</button>
        </div>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </>
    );
  }

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${displayName}`}
        onPointerEnter={show}
        onPointerLeave={hide}
        className="flex h-9 items-center gap-2 rounded-sm border border-ink-foreground/25 pl-1.5 pr-2.5 text-sm font-semibold text-ink-foreground outline-none transition-colors hover:bg-ink-foreground/10 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-ink-foreground/10"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-crimson text-primary-foreground"><UserRound className="h-3.5 w-3.5" strokeWidth={2} /></span>
        <span className="max-w-[10rem] truncate">{displayName}</span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} onPointerEnter={show} onPointerLeave={hide} className="w-64 border-ink-line bg-ink text-ink-foreground shadow-lift">
        <DropdownMenuLabel className="space-y-1 font-normal">
          <p className="text-xs uppercase tracking-wider text-ink-muted">Signed in as</p>
          <p className="truncate text-sm font-semibold text-ink-foreground">{displayName}</p>
          <p className="truncate text-xs text-ink-muted">{email}</p>
          {profile && <CopyId value={profile.customerNumber} />}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-ink-line" />
        <DropdownMenuItem onSelect={() => { setOpen(false); setSettingsOpen(true); }} className="cursor-pointer focus:bg-ink-soft focus:text-ink-foreground"><Settings className="mr-2 h-4 w-4 text-champagne" /> Settings</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { void signOut(); }} className="cursor-pointer text-[oklch(0.72_0.15_25)] focus:bg-ink-soft focus:text-[oklch(0.78_0.15_25)]"><LogOut className="mr-2 h-4 w-4" /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
