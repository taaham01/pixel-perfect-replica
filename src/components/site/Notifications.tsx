import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/hooks/use-customer";
import { expireOverdueBookings } from "@/lib/bookings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Note = { id: string; kind: string; title: string; body: string; read_at: string | null; created_at: string; slug: string | null };

/** The signed-in customer's on-site messages (booking approved / expired, car available again…). */
export function useNotifications() {
  const { user } = useCustomer();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["my-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Note[]> => {
      await expireOverdueBookings(); // so "available again" messages arrive on time
      const { data, error } = await supabase.from("notifications").select("id, kind, title, body, read_at, created_at, vehicle_id")
        .order("created_at", { ascending: false }).limit(30);
      if (error) return [];
      const ids = [...new Set(data.map((n) => n.vehicle_id).filter((id): id is string => !!id))];
      const slugs = new Map<string, string>();
      if (ids.length) {
        const { data: cars } = await supabase.from("vehicles").select("id, slug").in("id", ids);
        for (const c of cars ?? []) if (c.slug) slugs.set(c.id, c.slug);
      }
      return data.map((n) => ({ ...n, slug: n.vehicle_id ? slugs.get(n.vehicle_id) ?? null : null }));
    },
  });
  const markRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-notifications"] });
      await qc.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });
  const items = list.data ?? [];
  return { signedIn: !!user, items, unread: items.filter((n) => !n.read_at).length, markRead, loading: list.isLoading };
}

const icon: Record<string, typeof Bell> = { booking_approved: CheckCircle2, booking_expired: Clock, booking_cancelled: XCircle, car_available: BellRing, car_sold: XCircle };

function NoteItem({ n }: { n: Note }) {
  const Icon = icon[n.kind] ?? Bell;
  const body = (
    <>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", n.kind === "car_available" || n.kind === "booking_approved" ? "text-emerald-700" : "text-crimson")} />
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold">{n.title}{!n.read_at && <span className="h-2 w-2 rounded-full bg-crimson" aria-label="New" />}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
      </span>
    </>
  );
  const cls = cn("flex gap-3 rounded-sm p-3 text-left", !n.read_at && "bg-champagne/10");
  return n.slug
    ? <Link to="/vehicles/$slug" params={{ slug: n.slug }} className={cn(cls, "hover:bg-secondary")}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

/** Bell in the top bar with the unread count; opening it marks messages as read. */
export function NotificationBell({ className }: { className?: string }) {
  const n = useNotifications();
  if (!n.signedIn) return null;
  return (
    <Popover onOpenChange={(open) => { if (!open && n.unread) n.markRead.mutate(); }}>
      <PopoverTrigger className={cn("relative grid h-9 w-9 place-items-center rounded-sm text-ink-foreground hover:bg-ink-soft", className)} aria-label={n.unread ? `${n.unread} new messages` : "Messages"}>
        <Bell className="h-5 w-5" />
        {n.unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-crimson px-1 text-center text-[10px] font-bold leading-[18px] text-primary-foreground">{n.unread}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-semibold">Messages</p>
          <Link to="/account" hash="messages" className="text-xs text-crimson hover:underline">See all</Link>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1">
          {n.items.length === 0
            ? <p className="p-6 text-center text-sm text-muted-foreground">No messages yet. We'll let you know here about your bookings and cars you follow.</p>
            : n.items.slice(0, 8).map((x) => <NoteItem key={x.id} n={x} />)}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Full list of messages on the My account page. */
export function NotificationList() {
  const n = useNotifications();
  if (!n.signedIn) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 id="messages" className="scroll-mt-28 text-xl font-bold">Messages</h2>
        {n.unread > 0 && <button onClick={() => n.markRead.mutate()} className="text-sm text-crimson hover:underline">Mark all as read</button>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Updates on your bookings, and alerts for cars you asked to be notified about.</p>
      <div className="mt-4 grid gap-1 rounded-sm border border-border p-1">
        {n.loading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
        {!n.loading && n.items.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No messages yet.</p>}
        {n.items.map((x) => <NoteItem key={x.id} n={x} />)}
      </div>
    </div>
  );
}
