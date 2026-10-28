import { Link, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, BellRing, Hourglass, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";

/** Small "Under process" tag for a car whose booking is waiting for staff approval. */
export function UnderProcessTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm bg-amber-500 px-2 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-ink", className)}>
      <Hourglass className="h-3 w-3" /> Under process
    </span>
  );
}

/** Cars the signed-in customer asked to be told about when they become available again. */
function useWatching() {
  const { user } = useCustomer();
  return useQuery({
    queryKey: ["my-watched-cars", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_watchers").select("vehicle_id").eq("user_id", user!.id);
      if (error) return new Set<string>();
      return new Set(data.map((w) => w.vehicle_id));
    },
  });
}

/**
 * "Click here to get information on this car if it's not sold": the customer is put on the car's
 * notify list and gets a message on the website if the booking isn't confirmed and the car is free again.
 */
export function NotifyMeButton({ vehicleId, compact, className }: { vehicleId: string; compact?: boolean; className?: string }) {
  const { user, ready } = useCustomer();
  const here = useRouterState({ select: (s) => s.location.href });
  const qc = useQueryClient();
  const watching = useWatching();
  const on = !!watching.data?.has(vehicleId);

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in first.");
      const { error } = on
        ? await supabase.from("vehicle_watchers").delete().eq("user_id", user.id).eq("vehicle_id", vehicleId)
        : await supabase.from("vehicle_watchers").insert({ user_id: user.id, vehicle_id: vehicleId });
      if (error && error.code !== "23505") throw new Error(on ? "Couldn't turn off the alert." : "Couldn't set the alert. You may be following too many cars.");
    },
    onSuccess: async () => {
      toast.success(on ? "Alert turned off." : "Done — we'll message you here if this car becomes available again.");
      await qc.invalidateQueries({ queryKey: ["my-watched-cars"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const size = compact ? "sm" : "md";
  if (!ready) return null;
  if (!user) {
    return (
      <Link to="/login" search={{ redirect: here }} className={cn(btn({ variant: "outline", size }), className)}>
        <Bell className="h-4 w-4" /> {compact ? "Sign in to get notified" : "Click here to get notified if this car isn't sold"}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => toggle.mutate()} disabled={toggle.isPending || watching.isLoading}
      className={cn(btn({ variant: on ? "outline" : "ink", size }), className)}
      title={on ? "You'll get a message here if this car becomes available again. Click to turn off." : undefined}>
      {toggle.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {on ? (compact ? "You'll be notified" : "You'll be notified if it's available again") : compact ? "Notify me if available" : "Click here to get notified if this car isn't sold"}
      {on && <BellOff className="h-3.5 w-3.5 opacity-60" aria-label="Turn off" />}
    </button>
  );
}
