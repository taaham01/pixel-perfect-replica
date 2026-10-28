import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { APPROVAL_HOURS } from "@/lib/bookings";
import { AwaitingApprovals } from "@/components/admin/BookingApprovals";
import { btn } from "@/components/site/primitives";

export const Route = createFileRoute("/_authenticated/admin/booking-approvals")({
  beforeLoad: ({ context }) => { if (!context.admin.perms.bookings) throw redirect({ to: "/admin/inventory" }); },
  head: () => ({ meta: [{ title: "Booking approvals — Admin" }, { name: "robots", content: "noindex" }] }),
  component: BookingApprovals,
});

function BookingApprovals() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-crimson">Customers</p>
          <h1 className="mt-1 text-3xl font-bold">Booking approvals</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Customers' car bookings waiting for your approval. Approving reserves the car in the customer's name. Anything not approved within {APPROVAL_HOURS} hours is cancelled automatically and the car becomes available again.
          </p>
        </div>
        <Link to="/admin/bookings" className={btn({ variant: "outline", size: "sm" })}><CalendarCheck className="h-4 w-4" /> All bookings</Link>
      </div>
      <AwaitingApprovals />
    </div>
  );
}
