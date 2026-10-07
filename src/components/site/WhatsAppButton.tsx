import { MessageCircle } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { whatsappLink } from "@/config/site";
import { getVehicleBySlug, vehicleName } from "@/data/vehicles";

export function vehicleWhatsappMessage(name: string, stockId: string) {
  return `Hello, I am interested in ${name}, Stock ID ${stockId}. Please provide me with the export price and shipping information.`;
}

/** Floating button; pre-fills a vehicle message on vehicle detail pages. */
export function WhatsAppButton() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const m = pathname.match(/^\/vehicles\/([^/]+)$/);
  const v = m ? getVehicleBySlug(m[1]) : undefined;
  const href = whatsappLink(v ? vehicleWhatsappMessage(vehicleName(v), v.stockId) : "Hello, I would like to ask about exporting a vehicle from Japan.");
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
      className="group fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-whatsapp px-4 text-ink shadow-lift transition-transform hover:-translate-y-0.5 md:bottom-8 md:right-8">
      <MessageCircle className="h-6 w-6" />
      <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 group-hover:max-w-40 md:inline">Chat with sales</span>
    </a>
  );
}
