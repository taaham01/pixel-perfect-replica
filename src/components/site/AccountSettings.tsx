import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, Bell, CalendarCheck, Car, Check, CircleDollarSign, Clock, Copy, Download, FileUp, LayoutDashboard, Loader2, LogOut, Mail, MonitorSmartphone, PlusCircle, ShieldCheck, Trash2, UserCheck, UserRound, Users, Wrench, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { countries, site } from "@/config/site";
import { dialCodeFor } from "@/config/countries";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { ChangePasswordForm } from "@/components/site/ChangePasswordForm";
import { PasswordInput } from "@/components/site/PasswordInput";
import { ApprovalPending } from "@/components/site/ApprovalStatus";
import { Switch } from "@/components/ui/switch";
import { detailsSchema } from "@/lib/customer";
import { fetchCustomerDetails } from "@/lib/customer-details";
import { deleteOwnAccount } from "@/lib/account.functions";
import { withTimeout } from "@/lib/async";
import {
  allTimezones, browserTimezone, formatDateTime, readPreferences, utcOffsetLabel,
  type DateFormat, type Preferences, type TimeFormat,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { useCustomer } from "@/hooks/use-customer";

export const SETTINGS_TABS = ["admin", "profile", "security", "preferences", "notifications", "privacy"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const NAV: { id: SettingsTab; label: string; hint: string; icon: LucideIcon; staffOnly?: boolean }[] = [
  { id: "admin", label: "Admin panel", hint: "Inventory, bookings, staff", icon: Wrench, staffOnly: true },
  { id: "profile", label: "Profile", hint: "Name, email, phone", icon: UserRound },
  { id: "security", label: "Security", hint: "Password & sessions", icon: ShieldCheck },
  { id: "preferences", label: "Preferences", hint: "Time zone & formats", icon: Clock },
  { id: "notifications", label: "Notifications", hint: "What we contact you about", icon: Bell },
  { id: "privacy", label: "Privacy & data", hint: "Export or delete", icon: Download },
];

function Card({ title, description, children, tone }: { title: string; description?: string; children: ReactNode; tone?: "danger" }) {
  return (
    <section className={cn("rounded-sm border p-6", tone === "danger" ? "border-crimson/40" : "border-border")}>
      <h2 className={cn("text-lg font-bold", tone === "danger" && "text-crimson")}>{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** All account settings (profile, security, preferences, notifications, privacy), shared by the /settings page and the Settings pop-up. */
export function AccountSettings({ userId, email, isStaff, showAdmin = false, tab, onTabChange, variant = "page" }: {
  userId: string;
  email: string;
  isStaff: boolean;
  /** Show the Admin panel section: true for staff accounts only, so customers never see it. */
  showAdmin?: boolean;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  /** "dialog" uses a compact two-column layout sized for the pop-up window. */
  variant?: "page" | "dialog";
}) {
  const dialog = variant === "dialog";
  const adminVisible = isStaff && showAdmin;
  if (tab === "admin" && !adminVisible) tab = "profile";
  return (
    <div className={cn("grid gap-6", dialog ? "md:grid-cols-[13rem_minmax(0,1fr)] md:gap-0" : "gap-8 lg:grid-cols-12")}>
      <nav aria-label="Settings sections" className={cn(dialog ? "md:border-r md:border-border md:pr-4" : "lg:col-span-3")}>
        <ul className={cn("flex gap-2 overflow-x-auto pb-2", dialog ? "md:sticky md:top-0 md:flex-col md:gap-1 md:overflow-visible md:pb-0" : "lg:sticky lg:top-24 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0")}>
          {NAV.filter((n) => !n.staffOnly || adminVisible).map(({ id, label, hint, icon: Icon }) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onClick={() => onTabChange(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn("flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors", dialog ? "md:border-transparent" : "lg:border-transparent",
                  tab === id ? "border-crimson/40 bg-crimson/5 text-foreground" : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground")}
              >
                <Icon className={cn("h-4 w-4 shrink-0", tab === id && "text-crimson")} />
                <span><span className="block text-sm font-semibold">{label}</span><span className={cn("hidden text-xs text-muted-foreground", dialog ? "md:block" : "lg:block")}>{hint}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className={cn("grid min-w-0 content-start gap-6", dialog ? "md:pl-6" : "lg:col-span-9")}>
        {tab === "admin" && <AdminTab userId={userId} />}
        {tab === "profile" && <ProfileTab userId={userId} email={email} />}
        {tab === "security" && <SecurityTab email={email} minLen={isStaff ? 10 : 8} />}
        {tab === "preferences" && <PreferencesTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "privacy" && <PrivacyTab userId={userId} email={email} isStaff={isStaff} />}
      </div>
    </div>
  );
}

/* ───────────────────────── Admin panel (staff only) ───────────────────────── */

type AdminPath = "/admin" | "/admin/approvals" | "/admin/vehicles" | "/admin/vehicles/new" | "/admin/sold" | "/admin/import" | "/admin/bookings" | "/admin/customers" | "/admin/admins" | "/admin/activity";
type AdminLink = { to: AdminPath; label: string; hint: string; icon: LucideIcon; need?: "super" | "bookings" | "customers" };
const ADMIN_LINKS: { group: string; links: AdminLink[] }[] = [
  { group: "Overview", links: [{ to: "/admin", label: "Dashboard", hint: "Sales, stock and activity at a glance", icon: LayoutDashboard, need: "super" }] },
  { group: "Inventory", links: [
    { to: "/admin/vehicles", label: "Manage inventory", hint: "Edit, publish or remove vehicles", icon: Car },
    { to: "/admin/vehicles/new", label: "Add a vehicle", hint: "List a new car with photos", icon: PlusCircle },
    { to: "/admin/sold", label: "Sold vehicles", hint: "Cars marked as sold", icon: CircleDollarSign },
    { to: "/admin/import", label: "CSV import", hint: "Add many vehicles from a spreadsheet", icon: FileUp },
  ] },
  { group: "Customers", links: [
    { to: "/admin/approvals", label: "Customer approvals", hint: "Check new sign-ups and approve them to book", icon: UserCheck },
    { to: "/admin/bookings", label: "Bookings", hint: "Reservation requests from customers", icon: CalendarCheck, need: "bookings" },
    { to: "/admin/customers", label: "Customers", hint: "Accounts and contact details", icon: UserRound, need: "customers" },
  ] },
  { group: "Team", links: [
    { to: "/admin/admins", label: "Manage staff", hint: "Approve sign-ups, add or remove admins", icon: Users, need: "super" },
    { to: "/admin/activity", label: "Activity log", hint: "Who changed what, and when", icon: Activity, need: "super" },
  ] },
];

/** Shortcuts to every admin area the staff member can use. Shown in the admin portal and in Settings opened from it. */
export function AdminTab({ userId }: { userId: string }) {
  const { data: access, isLoading } = useQuery({
    queryKey: ["admin-access", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: roles }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("staff_permissions").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
      return { super: isSuper, bookings: isSuper || !!p?.can_manage_bookings, customers: isSuper || !!p?.can_view_customers };
    },
  });

  if (isLoading || !access) return <div className="grid h-40 place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <Card title="Admin panel" description="Jump straight to any part of the website's admin area.">
      <div className="grid gap-6">
        <Link to="/admin" className={cn(btn({ variant: "primary" }), "w-full sm:w-auto sm:justify-self-start")}><Wrench className="h-4 w-4" /> Open admin panel <ArrowRight className="h-4 w-4" /></Link>
        {ADMIN_LINKS.map(({ group, links }) => {
          const allowed = links.filter((l) => !l.need || access[l.need]);
          if (!allowed.length) return null;
          return (
            <div key={group}>
              <p className="eyebrow mb-2 text-muted-foreground">{group}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {allowed.map(({ to, label, hint, icon: Icon }) => (
                  <Link key={to} to={to} className="group flex items-start gap-3 rounded-sm border border-border p-3 transition-colors hover:border-crimson/40 hover:bg-crimson/5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-crimson" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ───────────────────────── Profile ───────────────────────── */

function ProfileTab({ userId, email }: { userId: string; email: string }) {
  const qc = useQueryClient();
  const { user } = useCustomer();
  const [country, setCountry] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: details, isLoading, error } = useQuery({ queryKey: ["customer-details", userId], queryFn: () => fetchCustomerDetails(userId) });
  const selectedCountry = country ?? details?.country ?? "";
  const dial = dialCodeFor(selectedCountry);

  const save = useMutation({
    mutationFn: async (v: { fullName: string; country: string; phone: string }) => {
      const row = { full_name: v.fullName, country: v.country, phone: v.phone };
      const { data: existing, error: readErr } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (readErr) throw readErr;
      const { error } = existing ? await supabase.from("profiles").update(row).eq("id", userId) : await supabase.from("profiles").insert({ id: userId, ...row });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["customer-details", userId] }), qc.invalidateQueries({ queryKey: ["customer-summary", userId] })]);
      toast.success("Your details have been saved.");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save your details."),
  });

  const changeEmail = useMutation({
    mutationFn: async (addr: string) => {
      const { error } = await withTimeout(supabase.auth.updateUser({ email: addr }), 15000);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Check both inboxes to confirm the new email address."); setNewEmail(""); },
    onError: (e: Error) => toast.error(e.message || "Could not change your email."),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = detailsSchema.safeParse({ fullName: fd.get("fullName"), country: fd.get("country"), phone: fd.get("phone") });
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message ?? "Please check your details.");
    save.mutate(parsed.data);
  }

  function onEmail(e: FormEvent) {
    e.preventDefault();
    const addr = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return void toast.error("Enter a valid email address.");
    if (addr === email.toLowerCase()) return void toast.error("That's already your email address.");
    changeEmail.mutate(addr);
  }

  async function copyId() {
    if (!details) return;
    try { await navigator.clipboard.writeText(details.customerNumber); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { toast.error("Could not copy the ID."); }
  }

  const initials = (details?.fullName || email).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <Card title="Account">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-crimson text-lg font-bold text-primary-foreground" aria-hidden>{initials || <UserRound />}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{details?.fullName || "Your account"}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            {user?.created_at && <p className="text-xs text-muted-foreground">Member since {new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" })}</p>}
          </div>
          {details && (
            <button onClick={copyId} className="ml-auto inline-flex items-center gap-2 rounded-sm border border-border px-3 py-2 font-mono text-sm hover:bg-secondary/60" aria-label="Copy customer ID">
              {details.customerNumber} {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </button>
          )}
        </div>
      </Card>

      <Card title="Personal details" description="Used by our team to handle your reservations and contact you.">
        {isLoading && <p className="text-sm text-muted-foreground">Loading your details…</p>}
        {error && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">We couldn't load your details. Please refresh and try again.</p>}
        {!isLoading && !error && (
          <form onSubmit={onSubmit} className="grid gap-4" key={details?.customerNumber ?? "new"}>
            <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Full name</span><input name="fullName" required defaultValue={details?.fullName} maxLength={120} autoComplete="name" className={fieldCls} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Country</span>
                <select name="country" required value={selectedCountry} onChange={(e) => setCountry(e.target.value)} className={fieldCls}>
                  <option value="" disabled>Select…</option>
                  {countries.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Phone / WhatsApp</span>
                <input name="phone" type="tel" required defaultValue={details?.phone} placeholder={dial ? `${dial} …` : "+254 700 000000"} maxLength={30} autoComplete="tel" className={fieldCls} />
                <span className="mt-1 block text-xs text-muted-foreground">Include the country code{dial ? ` (${dial})` : ""}. Changing your number means our team has to approve your account again.</span>
              </label>
            </div>
            <div><button disabled={save.isPending} className={btn({ variant: "primary" })}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</button></div>
          </form>
        )}
        {details && !details.phoneVerified && <ApprovalPending phone={details.phone} className="mt-6" />}
        {details?.phoneVerified && <p className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-700"><Check className="h-4 w-4" /> Account approved</p>}
      </Card>

      <Card title="Email address" description={`You sign in with ${email}. Changing it sends a confirmation link to the new address.`}>
        <form onSubmit={onEmail} className="flex flex-col gap-3 sm:flex-row">
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new-email@example.com" maxLength={254} autoComplete="email" aria-label="New email address" className={cn(fieldCls, "sm:flex-1")} />
          <button disabled={changeEmail.isPending || !newEmail} className={btn({ variant: "outline" })}>{changeEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Change email</button>
        </form>
      </Card>
    </>
  );
}

/* ───────────────────────── Security ───────────────────────── */

function SecurityTab({ email, minLen }: { email: string; minLen: number }) {
  const { user } = useCustomer();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"others" | "all" | null>(null);

  async function signOutScope(scope: "others" | "global") {
    setBusy(scope === "others" ? "others" : "all");
    try {
      const { error } = await withTimeout(supabase.auth.signOut({ scope }), 15000);
      if (error) throw error;
      if (scope === "global") { qc.clear(); router.history.push("/login"); return; }
      toast.success("Signed out of all other devices.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sign out.");
    } finally {
      setBusy(null);
    }
  }

  const provider = (user?.app_metadata?.["provider"] as string | undefined) ?? "email";
  const rows: [string, string][] = [
    ["Sign-in method", provider === "email" ? "Email & password" : provider],
    ["Last sign-in", user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"],
    ["Email confirmed", user?.email_confirmed_at ? "Yes" : "No"],
    ["This device", typeof navigator !== "undefined" ? navigator.userAgent.replace(/\(.*?\)/g, "").trim().slice(0, 60) : "—"],
  ];

  return (
    <>
      <Card title="Change password" description="You'll need your current password. After changing it we recommend signing out of your other devices.">
        <ChangePasswordForm email={email} minLen={minLen} />
      </Card>
      <Card title="Sessions" description="Where your account is signed in.">
        <dl className="divide-y divide-border text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-muted-foreground">{k}</dt><dd className="break-words text-right font-medium">{v}</dd></div>)}
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => signOutScope("others")} disabled={busy !== null} className={btn({ variant: "outline", size: "sm" })}>{busy === "others" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorSmartphone className="h-4 w-4" />} Sign out other devices</button>
          <button onClick={() => signOutScope("global")} disabled={busy !== null} className={btn({ variant: "outline", size: "sm" })}>{busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign out everywhere</button>
        </div>
      </Card>
    </>
  );
}

/* ───────────────────────── Preferences ───────────────────────── */

function usePreferenceSave() {
  return useMutation({
    mutationFn: async (prefs: Preferences) => {
      const { error } = await withTimeout(supabase.auth.updateUser({ data: { preferences: prefs } }), 15000);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Saved."),
    onError: (e: Error) => toast.error(e.message || "Could not save your settings."),
  });
}

function PreferencesTab() {
  const { user, ready } = useCustomer();
  const save = usePreferenceSave();
  const saved = useMemo(() => readPreferences(user), [user]);
  const [prefs, setPrefs] = useState<Preferences>(saved);
  const [filter, setFilter] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { if (ready) setPrefs(saved); }, [ready, saved]);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const zones = useMemo(() => allTimezones(), []);
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase().replace(/\s+/g, "_");
    const list = q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones;
    return list.includes(prefs.timezone) ? list : [prefs.timezone, ...list];
  }, [zones, filter, prefs.timezone]);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);

  return (
    <>
      <Card title="Time zone" description="Dates and times across the site are shown in your time zone.">
        <div className="grid gap-4">
          <div className="rounded-sm border border-border bg-secondary/40 p-4">
            <p className="eyebrow text-muted-foreground">Current time in {prefs.timezone.replace(/_/g, " ")} ({utcOffsetLabel(prefs.timezone, now)})</p>
            <p className="mt-1 font-mono text-xl font-bold" aria-live="off">{formatDateTime(now, prefs)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search e.g. Karachi, Nairobi, London…" aria-label="Search time zones" className={fieldCls} />
            <button type="button" onClick={() => { setPrefs({ ...prefs, timezone: browserTimezone() }); setFilter(""); }} className={btn({ variant: "outline" })}>Detect automatically</button>
          </div>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Time zone</span>
            <select value={prefs.timezone} onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })} className={fieldCls}>
              {visible.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")} ({utcOffsetLabel(z, now)})</option>)}
            </select>
          </label>
        </div>
      </Card>

      <Card title="Formats">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Time format</span>
            <select value={prefs.timeFormat} onChange={(e) => setPrefs({ ...prefs, timeFormat: e.target.value as TimeFormat })} className={fieldCls}>
              <option value="12h">12-hour (3:30 PM)</option><option value="24h">24-hour (15:30)</option>
            </select>
          </label>
          <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Date format</span>
            <select value={prefs.dateFormat} onChange={(e) => setPrefs({ ...prefs, dateFormat: e.target.value as DateFormat })} className={fieldCls}>
              <option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option><option value="ymd">YYYY-MM-DD</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button onClick={() => save.mutate(prefs)} disabled={!dirty || save.isPending} className={btn({ variant: "primary" })}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save preferences</button>
        {dirty && <button onClick={() => setPrefs(saved)} className={btn({ variant: "link", size: "sm" })}>Discard changes</button>}
      </div>
    </>
  );
}

/* ───────────────────────── Notifications ───────────────────────── */

function ToggleRow({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = `sw-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <label htmlFor={id} className="cursor-pointer"><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted-foreground">{hint}</span></label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NotificationsTab() {
  const { user, ready } = useCustomer();
  const save = usePreferenceSave();
  const saved = useMemo(() => readPreferences(user), [user]);
  const [prefs, setPrefs] = useState<Preferences>(saved);
  useEffect(() => { if (ready) setPrefs(saved); }, [ready, saved]);

  const n = prefs.notifications;
  const set = (patch: Partial<Preferences["notifications"]>) => setPrefs({ ...prefs, notifications: { ...n, ...patch } });
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);

  return (
    <>
      <Card title="What to tell me about" description="Booking updates are about your own reservations; the rest are optional.">
        <div className="divide-y divide-border">
          <ToggleRow title="Booking updates" hint="When a reservation is confirmed, changed or cancelled." checked={n.bookingUpdates} onChange={(v) => set({ bookingUpdates: v })} />
          <ToggleRow title="New arrivals" hint="When vehicles matching our inventory are added." checked={n.newArrivals} onChange={(v) => set({ newArrivals: v })} />
          <ToggleRow title="Price drops" hint="When a vehicle you may like gets cheaper." checked={n.priceDrops} onChange={(v) => set({ priceDrops: v })} />
          <ToggleRow title="Newsletter & offers" hint="Occasional news and special offers." checked={n.newsletter} onChange={(v) => set({ newsletter: v })} />
        </div>
      </Card>
      <Card title="How to reach me">
        <div className="divide-y divide-border">
          <ToggleRow title="Email" hint="Sent to your account email address." checked={n.viaEmail} onChange={(v) => set({ viaEmail: v })} />
          <ToggleRow title="WhatsApp / phone" hint="Sent to the phone number on your profile." checked={n.viaWhatsapp} onChange={(v) => set({ viaWhatsapp: v })} />
        </div>
      </Card>
      <div className="flex items-center gap-3">
        <button onClick={() => save.mutate(prefs)} disabled={!dirty || save.isPending} className={btn({ variant: "primary" })}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save notification settings</button>
        {dirty && <button onClick={() => setPrefs(saved)} className={btn({ variant: "link", size: "sm" })}>Discard changes</button>}
      </div>
    </>
  );
}

/* ───────────────────────── Privacy & data ───────────────────────── */

function PrivacyTab({ userId, email, isStaff }: { userId: string; email: string; isStaff: boolean }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useCustomer();
  const [exporting, setExporting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function exportData() {
    setExporting(true);
    try {
      const [details, bookings] = await Promise.all([
        fetchCustomerDetails(userId),
        supabase.from("bookings").select("*, vehicles(make, model, year)").order("created_at", { ascending: false }),
      ]);
      const data = {
        exportedAt: new Date().toISOString(),
        account: { id: userId, email, createdAt: user?.created_at ?? null, lastSignInAt: user?.last_sign_in_at ?? null },
        profile: details,
        preferences: readPreferences(user),
        bookings: bookings.data ?? [],
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `${site.name.toLowerCase().replace(/\W+/g, "-")}-my-data.json` });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export your data.");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (confirmEmail.trim().toLowerCase() !== email.toLowerCase()) return setDeleteError("Type your email address exactly to confirm.");
    if (!password) return setDeleteError("Enter your password.");
    setDeleting(true);
    setDeleteError(null);
    try {
      const verify = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 15000);
      if (verify.error) throw new Error("Your password is incorrect.");
      await withTimeout(deleteOwnAccount(), 30000);
      await supabase.auth.signOut().catch(() => undefined);
      qc.clear();
      toast.success("Your account has been deleted.");
      router.history.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete your account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card title="Download my data" description="A JSON file with your profile, preferences and booking requests.">
        <button onClick={exportData} disabled={exporting} className={btn({ variant: "outline" })}>{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download my data</button>
      </Card>

      <Card tone="danger" title="Delete account" description="Permanently deletes your account and sign-in. This can't be undone.">
        {isStaff ? (
          <p className="text-sm text-muted-foreground">Staff accounts can't be deleted here. Ask a super admin to remove your access.</p>
        ) : (
          <form onSubmit={onDelete} className="grid gap-4">
            <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Type <span className="font-mono normal-case text-foreground">{email}</span> to confirm</span>
              <input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" className={fieldCls} />
            </label>
            <label className="block"><span className="eyebrow mb-2 block text-muted-foreground">Your password</span>
              <PasswordInput name="password" autoComplete="current-password" maxLength={128} className={fieldCls} />
            </label>
            {deleteError && <p className="rounded-sm bg-crimson/10 p-3 text-sm text-crimson" role="alert">{deleteError}</p>}
            <div><button disabled={deleting} className={cn(btn({ variant: "outline" }), "border-crimson text-crimson hover:bg-crimson/10 hover:border-crimson")}>{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete my account</button></div>
          </form>
        )}
      </Card>
    </>
  );
}
