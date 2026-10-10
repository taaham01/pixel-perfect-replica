import type { Database } from "@/integrations/supabase/types";
import { formatPrice } from "@/config/site";

/* Shared vehicle types, constants and mappers. Data itself lives in the database
   and is fetched through src/lib/vehicles.functions.ts (public) or the admin pages. */

export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleImageRow = Database["public"]["Tables"]["vehicle_images"]["Row"];
export type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
export type PublishState = Database["public"]["Enums"]["publish_state"];

export const bodyTypes = ["SUV", "Van", "Pickup", "Minivan", "Sedan", "Hatchback", "Wagon", "Coupe", "Truck", "Bus"];
export const fuels = ["Petrol", "Diesel", "Hybrid", "Electric", "LPG"];
export const transmissions = ["Automatic", "Manual", "CVT"];
export const drivetrains = ["2WD", "4WD", "AWD"];
export const currencies = ["USD", "JPY", "EUR", "GBP", "AED", "AUD"];
export const commonMakes = ["Toyota", "Honda", "Nissan", "Mazda", "Mitsubishi", "Subaru", "Suzuki", "Lexus", "Isuzu", "Daihatsu"];
export const vehicleStatuses: VehicleStatus[] = ["available", "reserved", "sold"];
export const publishStates: PublishState[] = ["draft", "published", "archived"];
export const PAGE_SIZE = 24;
export const MAX_IMAGES = 60;

export interface Vehicle {
  id: string;
  slug: string;
  stockId: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  mileage: number;
  mileageUnit: string;
  price: number;
  currency: string;
  engineCc: number | null;
  transmission: string | null;
  fuel: string | null;
  bodyType: string | null;
  drivetrain: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  chassisNumber: string | null;
  auctionGrade: string | null;
  description: string | null;
  location: string | null;
  shippingInfo: string | null;
  status: VehicleStatus;
  publishState: PublishState;
  featured: boolean;
  coverUrl: string | null;
  thumbUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleImage {
  id: string;
  url: string;
  thumbUrl: string;
  position: number;
  isPrimary: boolean;
}

/** Images are served from private storage through our own cached image route. */
export const imageUrl = (path?: string | null) => (path ? `/api/public/images/${path}` : null);

export function mapVehicle(r: VehicleRow): Vehicle {
  return {
    id: r.id, slug: r.slug ?? r.id, stockId: r.stock_id, make: r.make, model: r.model, variant: r.variant ?? "",
    year: r.year, mileage: r.mileage, mileageUnit: r.mileage_unit, price: Number(r.price), currency: r.currency,
    engineCc: r.engine_cc, transmission: r.transmission, fuel: r.fuel, bodyType: r.body_type, drivetrain: r.drivetrain,
    exteriorColor: r.exterior_color, interiorColor: r.interior_color, chassisNumber: r.chassis_number,
    auctionGrade: r.auction_grade, description: r.description, location: r.location, shippingInfo: r.shipping_info,
    status: r.status, publishState: r.publish_state, featured: r.featured,
    coverUrl: imageUrl(r.primary_image_path), thumbUrl: imageUrl(r.primary_thumb_path ?? r.primary_image_path),
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export function mapImage(r: VehicleImageRow): VehicleImage {
  return { id: r.id, url: imageUrl(r.storage_path)!, thumbUrl: imageUrl(r.thumb_path ?? r.storage_path)!, position: r.position, isPrimary: r.is_primary };
}

export const vehicleName = (x: { year: number; make: string; model: string }) => `${x.year} ${x.make} ${x.model}`;
export const engineLabel = (cc: number | null) => (cc ? `${(cc / 1000).toFixed(1)}L · ${cc.toLocaleString("en-US")} cc` : "—");
export const formatMileage = (n: number, unit = "km") => `${new Intl.NumberFormat("en-US").format(n)} ${unit}`;
export const vehiclePrice = (v: Pick<Vehicle, "price" | "currency">) => formatPrice(v.price, v.currency);

export type SortKey = "newest" | "year" | "price-asc" | "price-desc" | "mileage";

export interface VehicleFilters {
  q?: string | undefined;
  make?: string | undefined;
  model?: string | undefined;
  minYear?: number | undefined;
  maxYear?: number | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  minMileage?: number | undefined;
  maxMileage?: number | undefined;
  transmission?: string | undefined;
  fuel?: string | undefined;
  body?: string | undefined;
  sort?: SortKey | undefined;
  page?: number | undefined;
}

export interface Facets { makes: string[]; models: Record<string, string[]> }

const num = (v: unknown) => (v === undefined || v === "" || v === null || isNaN(Number(v)) ? undefined : Number(v));
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** Parse URL search params into typed filters. */
export function parseFilters(s: Record<string, unknown>): VehicleFilters {
  return {
    q: str(s.q), make: str(s.make), model: str(s.model), transmission: str(s.transmission), fuel: str(s.fuel), body: str(s.body),
    minYear: num(s.minYear), maxYear: num(s.maxYear), minPrice: num(s.minPrice), maxPrice: num(s.maxPrice),
    minMileage: num(s.minMileage), maxMileage: num(s.maxMileage),
    sort: (["newest", "year", "price-asc", "price-desc", "mileage"] as const).find((x) => x === s.sort),
    page: num(s.page),
  };
}
