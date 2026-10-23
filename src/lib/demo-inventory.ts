import { supabase } from "@/integrations/supabase/client";
import { processAndUpload, removeStoredFiles } from "@/components/admin/upload";
import type { VehicleInsert } from "@/components/admin/fields";
import alphard from "@/assets/car-alphard.jpg";
import cx5 from "@/assets/car-cx5.jpg";
import hiace from "@/assets/car-hiace.jpg";
import hilux from "@/assets/car-hilux.jpg";
import landcruiser from "@/assets/car-landcruiser.jpg";
import vezel from "@/assets/car-vezel.jpg";

/** Test cars for trying out the site. Every stock ID starts with DEMO- so they can be removed in one go. */
export const DEMO_PREFIX = "DEMO-";

const shipping = "Shipped worldwide by RoRo or container from Yokohama. Export inspection and paperwork included; ask us for a CIF quote to your port.";

const DEMO_CARS: { photo: string; car: Omit<VehicleInsert, "publish_state" | "status" | "mileage_unit" | "currency" | "location" | "shipping_info"> }[] = [
  { photo: landcruiser, car: {
    stock_id: "DEMO-LC22", make: "Toyota", model: "Land Cruiser", variant: "ZX", year: 2022, mileage: 14900, price: 86500,
    engine_cc: 3445, transmission: "Automatic", fuel: "Petrol", body_type: "SUV", drivetrain: "4WD", exterior_color: "Precious White Pearl", interior_color: "Black leather",
    chassis_number: "VJA300-4012345", auction_grade: "5", featured: true,
    description: "Land Cruiser 300 ZX with the 3.5 L twin-turbo V6. One owner, full Toyota service history, sunroof, 360° cameras, cooled seats and the multi-terrain package.",
  } },
  { photo: alphard, car: {
    stock_id: "DEMO-ALP21", make: "Toyota", model: "Alphard", variant: "2.5 S C Package", year: 2021, mileage: 34500, price: 36800,
    engine_cc: 2494, transmission: "CVT", fuel: "Petrol", body_type: "Minivan", drivetrain: "2WD", exterior_color: "Pearl White", interior_color: "Black leather",
    chassis_number: "AGH30-0398765", auction_grade: "4.5", featured: true,
    description: "Luxury 7-seater with twin power sliding doors, power tailgate, captain seats with ottomans, rear entertainment screen and JBL sound.",
  } },
  { photo: hilux, car: {
    stock_id: "DEMO-HLX21", make: "Toyota", model: "Hilux", variant: "Z Double Cab", year: 2021, mileage: 28600, price: 26900,
    engine_cc: 2393, transmission: "Automatic", fuel: "Diesel", body_type: "Pickup", drivetrain: "4WD", exterior_color: "Silver Metallic", interior_color: "Black",
    chassis_number: "GUN125-3923456", auction_grade: "4.5", featured: true,
    description: "2.4 L turbo-diesel double cab with part-time 4WD, rear diff lock, LED headlights, smart entry and towing hitch. Clean bed, no rust.",
  } },
  { photo: hiace, car: {
    stock_id: "DEMO-HIA19", make: "Toyota", model: "HiAce Van", variant: "Super GL Dark Prime II", year: 2019, mileage: 71200, price: 23500,
    engine_cc: 2754, transmission: "Automatic", fuel: "Diesel", body_type: "Van", drivetrain: "2WD", exterior_color: "Black", interior_color: "Grey",
    chassis_number: "GDH201-1034567", auction_grade: "4",
    description: "Popular Super GL long-body van with the 2.8 L diesel, power sliding door, rear heater, reversing camera and smart key.",
  } },
  { photo: vezel, car: {
    stock_id: "DEMO-VZL21", make: "Honda", model: "Vezel", variant: "e:HEV Z", year: 2021, mileage: 21300, price: 19600,
    engine_cc: 1496, transmission: "CVT", fuel: "Hybrid", body_type: "SUV", drivetrain: "2WD", exterior_color: "Midnight Blue", interior_color: "Black",
    chassis_number: "RV5-1012345", auction_grade: "4.5",
    description: "Economical hybrid compact SUV with Honda Sensing, adaptive cruise control, LED lights, hands-free power tailgate and wireless phone charging.",
  } },
  { photo: cx5, car: {
    stock_id: "DEMO-CX520", make: "Mazda", model: "CX-5", variant: "XD L Package", year: 2020, mileage: 42800, price: 17900,
    engine_cc: 2188, transmission: "Automatic", fuel: "Diesel", body_type: "SUV", drivetrain: "AWD", exterior_color: "Soul Red Crystal", interior_color: "Black leather",
    chassis_number: "KF2P-4123456", auction_grade: "4.5",
    description: "2.2 L SkyActiv-D diesel with AWD, leather seats, heated steering wheel, Bose audio, head-up display and 360° view monitor.",
  } },
];

export async function countDemoCars() {
  const { count } = await supabase.from("vehicles").select("id", { count: "exact", head: true }).like("stock_id", `${DEMO_PREFIX}%`);
  return count ?? 0;
}

/** Adds the demo cars (skipping any already there) as published, available vehicles, each with its photo. */
export async function loadDemoCars(onStep: (msg: string) => void = () => {}) {
  let added = 0;
  for (const { photo, car } of DEMO_CARS) {
    const name = `${car.year} ${car.make} ${car.model}`;
    const { data: existing } = await supabase.from("vehicles").select("id").eq("stock_id", car.stock_id).maybeSingle();
    if (existing) { onStep(`${name} already added`); continue; }
    onStep(`Adding ${name}…`);
    const { data: row, error } = await supabase.from("vehicles").insert({
      ...car, status: "available", publish_state: "published", mileage_unit: "km", currency: "USD", location: "Yokohama, Japan", shipping_info: shipping,
    }).select("id").single();
    if (error || !row) throw new Error(`Could not add ${name}: ${error?.message ?? "unknown error"}`);
    const blob = await (await fetch(photo)).blob();
    const up = await processAndUpload(row.id, blob);
    const { error: imgErr } = await supabase.from("vehicle_images").insert({ vehicle_id: row.id, ...up, position: 0, is_primary: true, original_name: `${car.stock_id}.jpg` });
    if (imgErr) { await removeStoredFiles([up.storage_path, up.thumb_path]); throw new Error(`Added ${name}, but its photo could not be saved.`); }
    added++;
  }
  return added;
}

/** Deletes every DEMO- car with its photos (and any bookings made on them). */
export async function removeDemoCars() {
  const { data: cars, error } = await supabase.from("vehicles").select("id").like("stock_id", `${DEMO_PREFIX}%`);
  if (error) throw new Error(error.message);
  for (const { id } of cars ?? []) {
    const { data: imgs } = await supabase.from("vehicle_images").select("storage_path, thumb_path").eq("vehicle_id", id);
    const { error: delErr } = await supabase.from("vehicles").delete().eq("id", id);
    if (delErr) throw new Error(delErr.message);
    await removeStoredFiles((imgs ?? []).flatMap((i) => [i.storage_path, i.thumb_path]));
  }
  return cars?.length ?? 0;
}
