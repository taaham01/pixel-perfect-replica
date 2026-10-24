import { Link } from "@tanstack/react-router";
import { Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";

/** What a customer sees while our team hasn't approved their account yet (replaces SMS phone verification). */
export function ApprovalPending({ phone, className }: { phone?: string; className?: string }) {
  if (!phone) {
    return (
      <div className={cn("rounded-sm border border-border bg-card p-5", className)}>
        <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-crimson" /> Add your phone number</p>
        <p className="mt-2 text-sm text-muted-foreground">Our team approves every new account before it can book vehicles. Add your phone or WhatsApp number so we can check your details.</p>
        <Link to="/account" className={cn(btn({ variant: "primary", size: "sm" }), "mt-4")}>Complete my details</Link>
      </div>
    );
  }
  return (
    <div className={cn("rounded-sm border border-champagne/50 bg-champagne/10 p-5", className)}>
      <p className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-crimson" /> Account awaiting approval</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Our team checks every new account before it can book vehicles. We may contact you on <strong className="text-foreground">{phone}</strong> to confirm your details. Once you're approved you can book straight away.
      </p>
    </div>
  );
}
