import type { Database } from "@/integrations/supabase/types";
import { bodyTypes, currencies, drivetrains, fuels, transmissions } from "@/data/vehicles";

export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
type FieldType = "text" | "longtext" | "int" | "number" | "enum" | "bool";
export interface FieldDef { key: keyof VehicleInsert & string; label: string; type: FieldType; required?: boolean; options?: string[]; suggestions?: string[]; aliases: string[]; max?: number }

export const vehicleFields: FieldDef[] = [
  { key: "stock_id", label: "Stock ID", type: "text", required: true, max: 40, aliases: ["stock", "stock no", "stock number", "stockid", "ref", "reference"] },
  { key: "make", label: "Make", type: "text", required: true, max: 60, aliases: ["brand", "manufacturer", "maker"] },
  { key: "model", label: "Model", type: "text", required: true, max: 80, aliases: [] },
  { key: "variant", label: "Variant / Grade", type: "text", max: 120, aliases: ["grade", "trim", "version"] },
  { key: "year", label: "Model year", type: "int", required: true, aliases: ["model year", "yr", "registration year", "reg year"] },
  { key: "mileage", label: "Mileage", type: "int", required: true, aliases: ["odometer", "km", "kms", "distance"] },
  { key: "mileage_unit", label: "Mileage unit", type: "enum", options: ["km", "mi"], aliases: ["unit", "odometer unit"] },
  { key: "price", label: "Price", type: "number", required: true, aliases: ["fob", "fob price", "amount", "cost"] },
  { key: "currency", label: "Currency", type: "enum", required: true, options: currencies, aliases: ["curr"] },
  { key: "engine_cc", label: "Engine capacity (cc)", type: "int", aliases: ["engine", "cc", "displacement", "engine size"] },
  { key: "transmission", label: "Transmission", type: "text", suggestions: transmissions, max: 40, aliases: ["gearbox", "trans"] },
  { key: "fuel", label: "Fuel type", type: "text", suggestions: fuels, max: 40, aliases: ["fuel type"] },
  { key: "body_type", label: "Body type", type: "text", suggestions: bodyTypes, max: 40, aliases: ["body", "type", "body style"] },
  { key: "drivetrain", label: "Drivetrain", type: "text", suggestions: drivetrains, max: 20, aliases: ["drive", "drive type", "wd"] },
  { key: "exterior_color", label: "Exterior colour", type: "text", max: 60, aliases: ["color", "colour", "exterior color"] },
  { key: "interior_color", label: "Interior colour", type: "text", max: 60, aliases: ["interior", "interior colour"] },
  { key: "chassis_number", label: "Chassis number", type: "text", max: 40, aliases: ["chassis", "vin", "chassis no", "frame number"] },
  { key: "auction_grade", label: "Auction grade", type: "text", max: 10, aliases: ["grade score", "auction score"] },
  { key: "location", label: "Country / location", type: "text", max: 120, aliases: ["country", "yard", "city"] },
  { key: "shipping_info", label: "Destination / shipping info", type: "longtext", max: 1000, aliases: ["shipping", "destination", "port"] },
  { key: "description", label: "Description", type: "longtext", max: 5000, aliases: ["notes", "details", "comments"] },
  { key: "status", label: "Availability", type: "enum", required: true, options: ["available", "reserved", "sold"], aliases: ["availability", "state"] },
  { key: "featured", label: "Featured", type: "bool", aliases: ["highlight"] },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function guessField(header: string): string | undefined {
  const h = norm(header);
  return vehicleFields.find((f) => norm(f.key) === h || norm(f.label) === h || f.aliases.some((a) => norm(a) === h))?.key;
}

const parseNum = (s: string) => {
  const cleaned = s.replace(/[^\d.\-]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
};

/** Validates raw string input and returns a database-ready record plus human-readable errors. */
export function validateVehicle(raw: Record<string, string | undefined>) {
  const out: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const thisYear = new Date().getFullYear();
  for (const f of vehicleFields) {
    const v = (raw[f.key] ?? "").toString().trim();
    if (!v) {
      if (f.key === "status") { out.status = "available"; continue; }
      if (f.key === "mileage_unit") { out.mileage_unit = "km"; continue; }
      if (f.key === "featured") { out.featured = false; continue; }
      if (f.required) errors[f.key] = `${f.label} is required`;
      else out[f.key] = null;
      continue;
    }
    if (f.max && v.length > f.max) { errors[f.key] = `${f.label} must be at most ${f.max} characters`; continue; }
    switch (f.type) {
      case "int": {
        let n = parseNum(v);
        if (f.key === "engine_cc" && n > 0 && n < 20) n = Math.round(n * 1000); // "2.8" litres
        if (!Number.isFinite(n)) { errors[f.key] = `${f.label} must be a number`; break; }
        n = Math.round(n);
        if (f.key === "year" && (n < 1950 || n > thisYear + 1)) { errors[f.key] = `Year must be between 1950 and ${thisYear + 1}`; break; }
        if (f.key === "mileage" && (n < 0 || n > 3_000_000)) { errors[f.key] = "Mileage looks invalid"; break; }
        if (f.key === "engine_cc" && (n < 50 || n > 20000)) { errors[f.key] = "Engine capacity must be 50–20,000 cc"; break; }
        out[f.key] = n; break;
      }
      case "number": {
        const n = parseNum(v);
        if (!Number.isFinite(n) || n < 0 || n > 1e10) errors[f.key] = `${f.label} must be a positive number`;
        else out[f.key] = Math.round(n * 100) / 100;
        break;
      }
      case "enum": {
        const val = f.key === "currency" ? v.toUpperCase() : v.toLowerCase();
        if (!f.options!.includes(val)) errors[f.key] = `${f.label} must be one of: ${f.options!.join(", ")}`;
        else out[f.key] = val;
        break;
      }
      case "bool": out[f.key] = ["1", "true", "yes", "y", "x"].includes(v.toLowerCase()); break;
      default: out[f.key] = v;
    }
  }
  return { value: out as VehicleInsert, errors };
}

export function rowToForm(r: Record<string, unknown>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const f of vehicleFields) {
    const v = r[f.key];
    o[f.key] = v === null || v === undefined ? "" : f.type === "bool" ? (v ? "true" : "") : String(v);
  }
  return o;
}

export const dbErrorMessage = (e: { code?: string; message?: string } | null) => {
  if (!e) return "Something went wrong.";
  if (e.code === "23505") return "A vehicle with this Stock ID already exists.";
  if (e.code === "42501" || e.message?.includes("row-level security")) return "You do not have permission to do this.";
  if (e.message?.includes("Super Admin")) return e.message;
  return "Could not save. Please check the details and try again.";
};
