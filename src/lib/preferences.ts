import type { User } from "@supabase/supabase-js";

export type TimeFormat = "12h" | "24h";
export type DateFormat = "dmy" | "mdy" | "ymd";

export type Preferences = {
  timezone: string;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  notifications: {
    bookingUpdates: boolean;
    newArrivals: boolean;
    priceDrops: boolean;
    newsletter: boolean;
    viaEmail: boolean;
    viaWhatsapp: boolean;
  };
};

export const browserTimezone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
};

export const defaultPreferences = (): Preferences => ({
  timezone: browserTimezone(),
  timeFormat: "12h",
  dateFormat: "dmy",
  notifications: { bookingUpdates: true, newArrivals: false, priceDrops: false, newsletter: false, viaEmail: true, viaWhatsapp: true },
});

/** Preferences are kept in the account's own metadata, so they follow the person to any device. */
export function readPreferences(user: User | null): Preferences {
  const base = defaultPreferences();
  const raw: unknown = user?.user_metadata?.["preferences"];
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Preferences>;
  return {
    timezone: typeof r.timezone === "string" && isValidTimezone(r.timezone) ? r.timezone : base.timezone,
    timeFormat: r.timeFormat === "24h" ? "24h" : "12h",
    dateFormat: r.dateFormat === "mdy" || r.dateFormat === "ymd" ? r.dateFormat : "dmy",
    notifications: { ...base.notifications, ...(r.notifications && typeof r.notifications === "object" ? r.notifications : {}) },
  };
}

export function isValidTimezone(tz: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}

const FALLBACK_ZONES = [
  "UTC", "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi", "America/Chicago", "America/Los_Angeles",
  "America/New_York", "America/Sao_Paulo", "Asia/Dhaka", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Riyadh",
  "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Europe/London", "Europe/Moscow", "Pacific/Auckland",
];

export function allTimezones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (list?.length) return list.includes("UTC") ? list : ["UTC", ...list];
  } catch { /* older browsers */ }
  return FALLBACK_ZONES;
}

/** "UTC+5", "UTC-3:30" for the given zone right now. */
export function utcOffsetLabel(tz: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "";
    return part.replace("GMT", "UTC") || "UTC";
  } catch { return "UTC"; }
}

export function formatDateTime(at: Date, p: Pick<Preferences, "timezone" | "timeFormat" | "dateFormat">): string {
  const tz = isValidTimezone(p.timezone) ? p.timezone : "UTC";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const [d, m, y] = [get("day"), get("month"), get("year")];
  const date = p.dateFormat === "mdy" ? `${m}/${d}/${y}` : p.dateFormat === "ymd" ? `${y}-${m}-${d}` : `${d}/${m}/${y}`;
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: p.timeFormat === "12h" }).format(at);
  return `${date}, ${time}`;
}
