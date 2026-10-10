import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mapImage, mapVehicle, PAGE_SIZE, type Facets } from "@/data/vehicles";
import { publicClient } from "./supabase-public.server";

const opt = <T extends z.ZodTypeAny>(s: T) => s.optional();
const listSchema = z.object({
  scope: z.enum(["available", "sold"]),
  q: opt(z.string().max(100)),
  make: opt(z.string().max(60)),
  model: opt(z.string().max(80)),
  minYear: opt(z.number().int()), maxYear: opt(z.number().int()),
  minPrice: opt(z.number()), maxPrice: opt(z.number()),
  minMileage: opt(z.number()), maxMileage: opt(z.number()),
  transmission: opt(z.string().max(40)), fuel: opt(z.string().max(40)), body: opt(z.string().max(40)),
  sort: opt(z.enum(["newest", "year", "price-asc", "price-desc", "mileage"])),
  page: opt(z.number().int().min(1).max(100000)),
});

const sorts = {
  newest: ["created_at", false], year: ["year", false], "price-asc": ["price", true],
  "price-desc": ["price", false], mileage: ["mileage", true],
} as const;

export const listVehicles = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data: f }) => {
    const page = f.page ?? 1;
    let q = publicClient().from("vehicles").select("*", { count: "exact" }).eq("publish_state", "published");
    q = f.scope === "sold" ? q.eq("status", "sold") : q.in("status", ["available", "reserved"]);
    const term = f.q?.toLowerCase().replace(/[%_\\,()*]/g, " ").trim();
    if (term) q = q.ilike("search_text", `%${term}%`);
    if (f.make) q = q.eq("make", f.make);
    if (f.model) q = q.eq("model", f.model);
    if (f.minYear) q = q.gte("year", f.minYear);
    if (f.maxYear) q = q.lte("year", f.maxYear);
    if (f.minPrice) q = q.gte("price", f.minPrice);
    if (f.maxPrice) q = q.lte("price", f.maxPrice);
    if (f.minMileage) q = q.gte("mileage", f.minMileage);
    if (f.maxMileage) q = q.lte("mileage", f.maxMileage);
    if (f.transmission) q = q.eq("transmission", f.transmission);
    if (f.fuel) q = q.eq("fuel", f.fuel);
    if (f.body) q = q.eq("body_type", f.body);
    const [col, asc] = sorts[f.sort ?? "newest"];
    const from = (page - 1) * PAGE_SIZE;
    const { data, count, error } = await q.order(col, { ascending: asc }).order("id").range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("listVehicles", error);
      return { items: [], total: 0, page, error: "Inventory is temporarily unavailable. Please try again shortly." };
    }
    return { items: (data ?? []).map(mapVehicle), total: count ?? 0, page, error: null as string | null };
  });

export const getFeaturedVehicles = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("vehicles").select("*")
    .eq("publish_state", "published").in("status", ["available", "reserved"])
    .order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(6);
  if (error) console.error("featured", error);
  return (data ?? []).map(mapVehicle);
});

export const getFacets = createServerFn({ method: "GET" }).handler(async (): Promise<Facets> => {
  const { data, error } = await publicClient().rpc("vehicle_facets");
  if (error) console.error("facets", error);
  const models: Record<string, string[]> = {};
  for (const r of data ?? []) (models[r.make] ??= []).push(r.model);
  return { makes: Object.keys(models).sort(), models };
});

export const getVehicleBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row } = await sb.from("vehicles").select("*").eq("slug", data.slug).eq("publish_state", "published").maybeSingle();
    if (!row) return null;
    const [{ data: imgs }, { data: rel }] = await Promise.all([
      sb.from("vehicle_images").select("*").eq("vehicle_id", row.id).order("is_primary", { ascending: false }).order("position"),
      sb.from("vehicles").select("*").eq("publish_state", "published").in("status", ["available", "reserved"]).neq("id", row.id)
        .or(`make.eq."${row.make.replace(/"/g, "")}"${row.body_type ? `,body_type.eq."${row.body_type.replace(/"/g, "")}"` : ""}`)
        .order("created_at", { ascending: false }).limit(3),
    ]);
    return { vehicle: mapVehicle(row), images: (imgs ?? []).map(mapImage), related: (rel ?? []).map(mapVehicle) };
  });
