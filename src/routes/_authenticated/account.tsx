import { useState, type FormEvent } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { countries, site } from "@/config/site";
import { PageHero, btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { detailsSchema } from "@/lib/customer";
import { fetchCustomerDetails } from "@/lib/customer-details";
import { PhoneVerification } from "@/components/site/PhoneVerification";
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
      const { data, error } = await supabase.from("bookings").select("*, vehicles(make, model, year)").order("created_at", { ascending: false });
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

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = detailsSchema.safeParse({ fullName: fd.get("fullName"), country: fd.get("country"), phone: fd.get("phone") });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Please check your details.");
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

          {details && !showForm && details.phone && !details.phoneVerified && (
            <div className="mb-6"><PhoneVerification phone={details.phone} userId={user.id} /></div>
          )}

          {details && !showForm && (
            <div className="rounded-sm border border-border p-6">
              <p className="eyebrow text-muted-foreground">Customer ID</p>
              <CustomerNumber value={details.customerNumber} />
              <p className="mt-1 text-xs text-muted-foreground">Quote this ID when you speak to our team so we know it's you.</p>
              <dl className="mt-6 divide-y divide-border text-sm">
                <Row label="Name" value={details.fullName || "—"} />
                <Row label="Country" value={details.country || "—"} />
                <Row label="Phone / WhatsApp" value={details.phone ? `${details.phone}${details.phoneVerified ? " ✓ verified" : ""}` : "—"} />
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
                {details?.phoneVerified && <span className="mt-1 block text-xs text-muted-foreground">Changing your number means it has to be verified again.</span>}
              </label>
              <div className="flex gap-3">
                <button disabled={save.isPending} className={cn(btn({ variant: "primary" }))}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
                {details && <button type="button" onClick={() => setEditing(false)} className={btn({ variant: "outline" })}>Cancel</button>}
              </div>
            </form>
          )}
        </div>

        <div className="lg:col-span-7">
          <h2 className="text-xl font-bold">My booking requests</h2>
          <ul className="mt-4 divide-y divide-border rounded-sm border border-border">
            {bookings.isLoading && <li className="p-4 text-muted-foreground">Loading…</li>}
            {bookings.data?.length === 0 && <li className="p-4 text-muted-foreground">No bookings yet.</li>}
            {bookings.data?.map((b) => (
              <li key={b.id} className="flex justify-between gap-4 p-4">
                <span>{b.vehicles ? `${b.vehicles.year} ${b.vehicles.make} ${b.vehicles.model}` : "Vehicle"}</span>
                <span className="capitalize">{b.status}</span>
              </li>
            ))}
          </ul>
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
