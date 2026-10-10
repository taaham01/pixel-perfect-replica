/**
 * Central business configuration. Change company details here only.
 * Values marked [PLACEHOLDER] must be replaced with real information.
 */
export const site = {
  name: "AL-HASSAN MOTORS JAPAN",
  shortName: "AL-HASSAN",
  subName: "MOTORS JAPAN",
  tagline: "Japanese vehicles. Delivered worldwide.",
  url: "https://example.com", // [PLACEHOLDER] production domain
  contact: {
    whatsapp: "810000000000", // [PLACEHOLDER] international format, digits only
    whatsappDisplay: "+81 00-0000-0000",
    phone: "+81 00-0000-0000",
    email: "sales@example.com",
    office: "[Office address — to be confirmed]",
    location: "Japan",
    hours: "Mon – Sat, 9:00 – 18:00 JST",
  },
  currency: { code: "USD", locale: "en-US" },
  social: {
    facebook: "#",
    instagram: "#",
    youtube: "#",
    linkedin: "#",
  },
} as const;

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function formatPrice(amount: number, currency: string = site.currency.code) {
  return new Intl.NumberFormat(site.currency.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatKm(km: number) {
  return `${new Intl.NumberFormat("en-US").format(km)} km`;
}

export const navLinks = [
  { to: "/vehicles", label: "Vehicles" },
  { to: "/sold-cars", label: "Sold Cars" },
  { to: "/request-a-car", label: "Request a Car" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/dealers", label: "For Dealers" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export const countries = [
  "Kenya", "Tanzania", "Uganda", "Zambia", "Mozambique", "Zimbabwe", "Malawi", "Nigeria", "Ghana",
  "South Africa", "United Arab Emirates", "Saudi Arabia", "Oman", "Pakistan", "Bangladesh", "Sri Lanka",
  "Jamaica", "Trinidad and Tobago", "Guyana", "Bahamas", "Australia", "New Zealand", "Fiji",
  "Chile", "Mongolia", "Russia", "United Kingdom", "Ireland", "Other",
];
