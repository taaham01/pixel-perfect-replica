import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check, Copy, Loader2, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { countries, site } from "@/config/site";
import { PageHero, btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { detailsSchema } from "@/lib/customer";
import { fetchCustomerDetails } from "@/lib/customer-details";
import { ApprovalPending } from "@/components/site/ApprovalStatus";
import { CONTACT_METHODS, bookingStatusInfo } from "@/components/site/BookVehicle";
import { vehiclePrice, mapVehicle } from "@/data/vehicles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: `My Account — ${site.name}` }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

function Account() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: details, isLoading, error } = useQuery({
    queryKey: ["customer-details", user.id],
    queryFn: () => fetchCustomerDetails(user.id),
  });

  const bookings = useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("*, vehicles(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (v: { fullName: string; country: string; phone: string }) => {
      const row = { full_name: v.fullName, country: v.country, phone: v.phone };
      const { data: existing, error: readErr } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (readErr) throw readErr;
      const { error } = existing
        ? await supabase.from("profiles").update(row).eq("id", user.id)
        : await supabase.from("profiles").insert({ id: user.id, ...row });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["customer-details", user.id] }),
        qc.invalidateQueries({ queryKey: ["customer-summary", user.id] }),
      ]);
      setEditing(false);
      toast.success("Your details have been saved.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save your details."),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
      if (error) throw new Error("We couldn't cancel this booking. Please contact us.");
    },
    onSuccess: async () => { toast.success("Booking cancelled."); await qc.invalidateQueries({ queryKey: ["my-bookings"] }); await qc.invalidateQueries({ queryKey: ["my-booking"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = detailsSchema.safeParse({ fullName: fd.get("fullName"), country: fd.get("country"), phone: fd.get("phone") });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check your details."); return; }
    save.mutate(parsed.data);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.history.push("/");
  }

  const showForm = editing || (details === null && !isLoading && !error);
  const firstName = details?.fullName.split(" ")[0];

  return (
    <>
      <PageHero eyebrow="My account" title={firstName ? `Welcome, ${firstName}.` : "Your account"} subtitle="Your details and booking requests in one place." />
      <section className="container-x grid gap-10 py-14 md:py-20 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {isLoading && <p className="text-sm text-muted-foreground">Loading your details…</p>}
          {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">We couldn't load your details. Please refresh and try again.</p>}

          {details && !showForm && !details.phoneVerified && <ApprovalPending phone={details.phone} className="mb-6" />}

          {details && !showForm && (
            <div className="rounded-sm border border-border p-6">
              <p className="eyebrow text-muted-foreground">Customer ID</p>
              <CustomerNumber value={details.customerNumber} />
              <p className="mt-1 text-xs text-muted-foreground">Quote this ID when you speak to our team so we know it's you.</p>
              <dl className="mt-6 divide-y divide-border text-sm">
                <Row label="Name" value={details.fullName || "—"} />
                <Row label="Country" value={details.country || "—"} />
                <Row label="Phone / WhatsApp" value={details.phone || "—"} />
                <Row label="Account status" value={details.phoneVerified ? "✓ Approved" : "Awaiting approval"} />
                <Row label="Email" value={user.email} />
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => setEditing(true)} className={btn({ variant: "outline", size: "sm" })}>Edit details</button>
                <button onClick={signOut} className={btn({ variant: "link", size: "sm" })}><LogOut className="h-4 w-4" /> Sign out</button>
              </div>
            </div>
          )}

          {showForm && !isLoading && (
            <form onSubmit={onSubmit} className="grid gap-4 rounded-sm border border-border p-6">
              <h2 className="text-lg font-bold">{details ? "Edit your details" : "Complete your details"}</h2>
              {!details && <p className="text-sm text-muted-foreground">We need your name, country and phone number before you can book a vehicle.</p>}
              <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Full name</span><input name="fullName" required defaultValue={details?.fullName} maxLength={120} className={fieldCls} /></label>
              <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Country</span>
                <select name="country" required defaultValue={details?.country ?? ""} className={fieldCls}>
                  <option value="" disabled>Select…</option>
                  {countries.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Phone / WhatsApp</span><input name="phone" type="tel" required defaultValue={details?.phone} maxLength={30} className={fieldCls} />
                {details?.phoneVerified && <span className="mt-1 block text-xs text-muted-foreground">Changing your number means our team has to approve your account again.</span>}
              </label>
              <div className="flex gap-3">
                <button disabled={save.isPending} className={cn(btn({ variant: "primary" }))}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
                {details && <button type="button" onClick={() => setEditing(false)} className={btn({ variant: "outline" })}>Cancel</button>}
              </div>
            </form>
          )}
        </div>

        <div className="lg:col-span-7">
          <h2 id="bookings" className="scroll-mt-28 text-xl font-bold">My bookings &amp; reservations</h2>
          <p className="mt-1 text-sm text-muted-foreground">Book a car from its page. Once our team confirms, it's reserved in your name.</p>
          <div className="mt-4 grid gap-3">
            {bookings.isLoading && <p className="rounded-sm border border-border p-4 text-muted-foreground">Loading…</p>}
            {bookings.data?.length === 0 && (
              <div className="rounded-sm border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <CalendarCheck className="mx-auto mb-2 h-6 w-6" />
                You haven't booked a car yet.
                <div className="mt-4"><Link to="/vehicles" className={btn({ variant: "primary", size: "sm" })}>Browse vehicles</Link></div>
              </div>
            )}
            {bookings.data?.map((b) => {
              const v = b.vehicles ? mapVehicle(b.vehicles) : null;
              const info = bookingStatusInfo[b.status] ?? bookingStatusInfo.pending!;
              const active = b.status === "pending" || b.status === "confirmed";
              return (
                <article key={b.id} className={cn("flex gap-4 rounded-sm border p-4", active ? "border-border bg-card" : "border-border/60 opacity-80")}>
                  <div className="h-20 w-28 shrink-0 overflow-hidden rounded-sm bg-muted">
                    {v?.thumbUrl && <img src={v.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {v ? <Link to="/vehicles/$slug" params={{ slug: v.slug }} className="font-semibold hover:text-crimson">{v.year} {v.make} {v.model}</Link> : <span className="font-semibold">Vehicle no longer listed</span>}
                        {v && <p className="text-xs text-muted-foreground"><span className="font-mono">{v.stockId}</span> · {vehiclePrice(v)}</p>}
                      </div>
                      <span className={cn("rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", info.tone)}>{info.label}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{info.hint}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Booked {new Date(b.created_at).toLocaleDateString()}
                      {b.destination ? ` · To ${b.destination}` : ""}
                      {b.contact_method ? ` · Contact by ${CONTACT_METHODS.find((m) => m.id === b.contact_method)?.label ?? b.contact_method}` : ""}
                    </p>
                    {b.staff_note && <p className="mt-2 rounded-sm bg-secondary/60 p-2 text-sm"><span className="font-semibold">Message from our team:</span> {b.staff_note}</p>}
                    {active && (
                      <button onClick={() => { if (window.confirm("Cancel this booking?")) cancel.mutate(b.id); }} disabled={cancel.isPending} className={cn(btn({ variant: "link", size: "sm" }), "mt-1 h-auto py-1")}>
                        <X className="h-4 w-4" /> Cancel booking
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all text-right font-medium">{value}</dd>
    </div>
  );
}

function CustomerNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Please select the ID and copy it manually.");
    }
  }
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="font-mono text-2xl font-bold tracking-wider">{value}</span>
      <button onClick={copy} aria-label="Copy customer ID" className="rounded-sm border border-border p-2 text-muted-foreground hover:text-foreground">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
