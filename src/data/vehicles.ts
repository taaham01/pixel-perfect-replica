import landcruiser from "@/assets/car-landcruiser.jpg";
import hiace from "@/assets/car-hiace.jpg";
import hilux from "@/assets/car-hilux.jpg";
import alphard from "@/assets/car-alphard.jpg";
import vezel from "@/assets/car-vezel.jpg";
import cx5 from "@/assets/car-cx5.jpg";

export type Transmission = "Automatic" | "Manual";
export type Fuel = "Petrol" | "Diesel" | "Hybrid";
export type BodyType = "SUV" | "Van" | "Pickup" | "Minivan" | "Sedan" | "Hatchback";
export type Availability = "available" | "reserved" | "sold";

/** Backend-ready vehicle shape. Map database rows to this type. */
export interface Vehicle {
  id: string;
  stockId: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  price: number;
  currency: string;
  mileage: number;
  engine: string;
  transmission: Transmission;
  fuel: Fuel;
  drive: "2WD" | "4WD" | "AWD";
  bodyType: BodyType;
  color: string;
  location: string;
  description: string;
  images: string[];
  featured: boolean;
  availability: Availability;
  chassisNumber: string;
}

const v = (x: Omit<Vehicle, "currency" | "location"> & Partial<Pick<Vehicle, "location">>): Vehicle => ({
  currency: "USD",
  location: "Yokohama, Japan",
  ...x,
});

export const vehicles: Vehicle[] = [
  v({ id: "1", stockId: "AH10241", make: "Toyota", model: "Land Cruiser", variant: "ZX 300 Series", year: 2022, price: 78500, mileage: 18400, engine: "3.3L V6 Twin-Turbo", transmission: "Automatic", fuel: "Diesel", drive: "4WD", bodyType: "SUV", color: "Precious White Pearl", description: "Flagship 300 Series Land Cruiser in ZX trim with leather interior, multi-terrain monitor and adaptive suspension.", images: [landcruiser, hilux, alphard], featured: true, availability: "available", chassisNumber: "FJA300-40xxxx" }),
  v({ id: "2", stockId: "AH10238", make: "Toyota", model: "Hiace", variant: "Super GL Dark Prime II", year: 2021, price: 31200, mileage: 42100, engine: "2.8L Diesel Turbo", transmission: "Automatic", fuel: "Diesel", drive: "2WD", bodyType: "Van", color: "Black Mica", description: "Popular Super GL Dark Prime II with premium interior trim, power sliding door and rear camera.", images: [hiace, landcruiser], featured: true, availability: "available", chassisNumber: "GDH201-10xxxx", location: "Nagoya, Japan" }),
  v({ id: "3", stockId: "AH10233", make: "Toyota", model: "Hilux", variant: "Z Double Cab", year: 2021, price: 33900, mileage: 36800, engine: "2.4L Diesel Turbo", transmission: "Automatic", fuel: "Diesel", drive: "4WD", bodyType: "Pickup", color: "Silver Metallic", description: "Double cab Hilux Z with part-time 4WD, LED headlamps and bed liner.", images: [hilux, hiace], featured: true, availability: "available", chassisNumber: "GUN125-30xxxx", location: "Kobe, Japan" }),
  v({ id: "4", stockId: "AH10229", make: "Toyota", model: "Alphard", variant: "2.5S C Package", year: 2020, price: 39800, mileage: 51200, engine: "2.5L Petrol", transmission: "Automatic", fuel: "Petrol", drive: "2WD", bodyType: "Minivan", color: "White Pearl Crystal Shine", description: "Executive lounge-style minivan with twin sunroof, power ottoman seats and rear entertainment.", images: [alphard, landcruiser], featured: true, availability: "reserved", chassisNumber: "AGH30-09xxxx" }),
  v({ id: "5", stockId: "AH10224", make: "Honda", model: "Vezel", variant: "e:HEV Z", year: 2022, price: 22400, mileage: 21900, engine: "1.5L Hybrid", transmission: "Automatic", fuel: "Hybrid", drive: "2WD", bodyType: "SUV", color: "Premium Midnight Blue", description: "Second-generation Vezel e:HEV Z with Honda Sensing, panoramic roof and hands-free tailgate.", images: [vezel, cx5], featured: true, availability: "available", chassisNumber: "RV5-10xxxx", location: "Osaka, Japan" }),
  v({ id: "6", stockId: "AH10219", make: "Mazda", model: "CX-5", variant: "XD L Package", year: 2020, price: 19800, mileage: 47300, engine: "2.2L SKYACTIV-D", transmission: "Automatic", fuel: "Diesel", drive: "AWD", bodyType: "SUV", color: "Soul Red Crystal", description: "Diesel CX-5 with leather seats, BOSE audio and 360° view monitor.", images: [cx5, vezel], featured: true, availability: "available", chassisNumber: "KF2P-40xxxx" }),
  v({ id: "7", stockId: "AH10212", make: "Toyota", model: "Land Cruiser", variant: "GX 300 Series", year: 2023, price: 72900, mileage: 9800, engine: "3.5L V6 Twin-Turbo", transmission: "Automatic", fuel: "Petrol", drive: "4WD", bodyType: "SUV", color: "Precious White Pearl", description: "Low-mileage GX grade Land Cruiser, ideal for heavy-duty use.", images: [landcruiser, hilux], featured: false, availability: "available", chassisNumber: "VJA300-41xxxx" }),
  v({ id: "8", stockId: "AH10207", make: "Toyota", model: "Hiace", variant: "DX Long", year: 2019, price: 23600, mileage: 88400, engine: "2.8L Diesel Turbo", transmission: "Manual", fuel: "Diesel", drive: "4WD", bodyType: "Van", color: "Black", description: "Workhorse DX long-body Hiace with 4WD and manual transmission.", images: [hiace], featured: false, availability: "available", chassisNumber: "GDH206-20xxxx", location: "Nagoya, Japan" }),
  v({ id: "9", stockId: "AH10201", make: "Toyota", model: "Hilux", variant: "X Double Cab", year: 2019, price: 26500, mileage: 71200, engine: "2.4L Diesel Turbo", transmission: "Manual", fuel: "Diesel", drive: "4WD", bodyType: "Pickup", color: "Silver Metallic", description: "Manual Hilux X grade with 4WD, robust and dealer-favourite spec.", images: [hilux], featured: false, availability: "sold", chassisNumber: "GUN125-20xxxx", location: "Kobe, Japan" }),
  v({ id: "10", stockId: "AH10196", make: "Honda", model: "Vezel", variant: "Hybrid Z", year: 2019, price: 15900, mileage: 58600, engine: "1.5L Hybrid", transmission: "Automatic", fuel: "Hybrid", drive: "2WD", bodyType: "SUV", color: "Midnight Blue", description: "First-generation Vezel Hybrid Z, efficient and well-equipped.", images: [vezel], featured: false, availability: "available", chassisNumber: "RU3-13xxxx", location: "Osaka, Japan" }),
];

export const vehicleSlug = (x: Vehicle) =>
  `${x.make}-${x.model}-${x.year}-stock-${x.stockId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const vehicleName = (x: Vehicle) => `${x.year} ${x.make} ${x.model}`;

/* Data access — swap these for backend queries later. */
export function getVehicles() { return vehicles; }
export function getFeaturedVehicles() { return vehicles.filter((x) => x.featured).slice(0, 6); }
export function getVehicleBySlug(slug: string) { return vehicles.find((x) => vehicleSlug(x) === slug); }

export const makes = [...new Set(vehicles.map((x) => x.make))].sort();
export const modelsByMake = (make?: string) =>
  [...new Set(vehicles.filter((x) => !make || x.make === make).map((x) => x.model))].sort();
export const bodyTypes: BodyType[] = ["SUV", "Van", "Pickup", "Minivan", "Sedan", "Hatchback"];
export const fuels: Fuel[] = ["Petrol", "Diesel", "Hybrid"];
export const transmissions: Transmission[] = ["Automatic", "Manual"];

export interface VehicleFilters {
  q?: string | undefined;
  make?: string | undefined;
  model?: string | undefined;
  minYear?: number | undefined;
  maxPrice?: number | undefined;
  maxMileage?: number | undefined;
  transmission?: string | undefined;
  fuel?: string | undefined;
  body?: string | undefined;
  sort?: "newest" | "price-asc" | "price-desc" | "mileage" | undefined;
}

export function filterVehicles(list: Vehicle[], f: VehicleFilters) {
  const q = f.q?.trim().toLowerCase();
  const out = list.filter((x) =>
    (!q || `${x.make} ${x.model} ${x.stockId}`.toLowerCase().includes(q)) &&
    (!f.make || x.make === f.make) &&
    (!f.model || x.model === f.model) &&
    (!f.minYear || x.year >= f.minYear) &&
    (!f.maxPrice || x.price <= f.maxPrice) &&
    (!f.maxMileage || x.mileage <= f.maxMileage) &&
    (!f.transmission || x.transmission === f.transmission) &&
    (!f.fuel || x.fuel === f.fuel) &&
    (!f.body || x.bodyType === f.body),
  );
  const sorters: Record<string, (a: Vehicle, b: Vehicle) => number> = {
    newest: (a, b) => b.year - a.year,
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    mileage: (a, b) => a.mileage - b.mileage,
  };
  return out.sort(sorters[f.sort ?? "newest"]);
}
