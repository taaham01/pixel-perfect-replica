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
import { cn } from "@/lib/utils";

const t = `My Account — ${site.name}`;

export const Route = createFileRoute("/_customer/account")({
  head: () => ({ meta: [{ title: t }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

type Details = { customerNumber: string; fullName: string; country: string; phone: string } | null;

function Account() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: details, isLoading, error } = useQuery({
    queryKey: ["customer-details", user.id],
    queryFn: async (): Promise<Details> => {
      const [p, c] = await Promise.all([
        supabase.from("customer_profiles").select("customer_number, full_name, country").eq("user_id", user.id).maybeSingle(),
        supabase.from("customer_contacts").select("phone").eq("user_id", user.id).maybeSingle(),
      ]);
      if (p.error) throw p.error;
      if (!p.data) return null;
      return { customerNumber: p.data.customer_number, fullName: p.data.full_name, country: p.data.country, phone: c.data?.phone ?? "" };
    },
  });

  const save = useMutation({
    mutationFn: async (v: { fullName: string; country: string; phone: string }) => {
      const { error } = await supabase.rpc("complete_customer_profile", { _full_name: v.fullName, _phone: v.phone, _country: v.country });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["customer-details", user.id] });
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
    qc.clear();
    await supabase.auth.signOut();
    router.history.push("/");
  }

  const showForm = !!details && editing ? true : details === null && !isLoading && !error;

  return (
    <>
      <PageHero eyebrow="My account" title={details ? `Welcome, ${details.fullName.split(" ")[0]}.` : "Your account"} subtitle="Your details and reservations in one place." />
      <section className="container-x grid gap-10 py-14 md:py-20 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {isLoading && <p className="text-sm text-muted-foreground">Loading your details…</p>}
          {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">We couldn't load your details. Please refresh and try again.</p>}

          {details && !showForm && (
            <div className="rounded-sm border border-border p-6">
              <p className="eyebrow text-muted-foreground">Customer ID</p>
              <CustomerNumber value={details.customerNumber} />
              <p className="mt-1 text-xs text-muted-foreground">Quote this ID when you speak to our team so we know it's you.</p>
              <dl className="mt-6 divide-y divide-border text-sm">
                <Row label="Name" value={details.fullName} />
                <Row label="Country" value={details.country} />
                <Row label="Phone / WhatsApp" value={details.phone || "—"} />
                <Row label="Email" value={user.email} />
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => setEditing(true)} className={btn({ variant: "outline", size: "sm" })}>Edit details</button>
                <button onClick={signOut} className={btn({ variant: "link", size: "sm" })}><LogOut className="h-4 w-4" /> Sign out</button>
              </div>
            </div>
          )}

          {showForm && (
            <form onSubmit={onSubmit} className="grid gap-4 rounded-sm border border-border p-6">
              <h2 className="text-lg font-bold">{details ? "Edit your details" : "Complete your details"}</h2>
              {!details && <p className="text-sm text-muted-foreground">We need your name, country and phone number before you can reserve a vehicle.</p>}
              <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Full name</span><input name="fullName" required defaultValue={details?.fullName} maxLength={120} className={fieldCls} /></label>
              <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Country</span>
                <select name="country" required defaultValue={details?.country ?? ""} className={fieldCls}>
                  <option value="" disabled>Select…</option>
                  {countries.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Phone / WhatsApp</span><input name="phone" type="tel" required defaultValue={details?.phone} maxLength={30} className={fieldCls} /></label>
              <div className="flex gap-3">
                <button disabled={save.isPending} className={cn(btn({ variant: "primary" }))}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save</button>
                {details && <button type="button" onClick={() => setEditing(false)} className={btn({ variant: "outline" })}>Cancel</button>}
              </div>
            </form>
          )}
        </div>

        <div className="lg:col-span-7">
          <h2 className="text-xl font-bold">My reservations</h2>
          <p className="mt-3 text-sm text-muted-foreground">Vehicles you reserve will appear here.</p>
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
