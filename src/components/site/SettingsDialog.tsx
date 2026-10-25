import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountSettings, type SettingsTab } from "@/components/site/AccountSettings";

/** Settings as a window over the current page: every section of the /settings page, fully working. */
export function SettingsDialog({ open, onOpenChange, initialTab = "profile" }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
}) {
  const { user, email } = useCustomer();
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  // Start on the requested section each time the window opens.
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  // Close when a setting navigates away (e.g. "Sign out everywhere" or deleting the account).
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const openedOn = useRef(pathname);
  useEffect(() => { if (open) openedOn.current = pathname; }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && pathname !== openedOn.current) onOpenChange(false); }, [pathname, open, onOpenChange]);

  const { data: isStaff } = useQuery({
    queryKey: ["is-staff", user?.id],
    enabled: open && !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).length > 0;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-xl">Account settings</DialogTitle>
          <DialogDescription>Manage your profile, security, preferences and privacy.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {user && isStaff !== undefined ? (
            <AccountSettings variant="dialog" userId={user.id} email={email} isStaff={isStaff} showAdmin={isStaff} tab={tab} onTabChange={setTab} />
          ) : (
            <div className="grid h-64 place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
