import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, MessageCircle, Phone, Building2 } from "lucide-react";
import { site, whatsappLink } from "@/config/site";
import { PageHero, btn } from "@/components/site/primitives";
import { ContactForm } from "@/components/site/forms";

const t = `Contact Our Export Team — ${site.name}`;
const d = "Contact our Japanese vehicle export team by WhatsApp, email or phone for quotations and shipping information.";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ContactPage,
});

function ContactPage() {
  const c = site.contact;
  const items = [
    { icon: Mail, label: "Email", value: c.email, href: `mailto:${c.email}` },
    { icon: Phone, label: "Phone", value: c.phone, href: `tel:${c.phone}` },
    { icon: Building2, label: "Office", value: c.office },
    { icon: Clock, label: "Business Hours", value: c.hours },
    { icon: MapPin, label: "Location", value: c.location },
  ];
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to our export team." subtitle="Quotations, shipping questions or sourcing requests — we respond quickly." />
      <section className="container-x grid gap-12 py-16 md:py-24 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <a href={whatsappLink()} target="_blank" rel="noreferrer" className="group block rounded-sm bg-ink p-8 text-ink-foreground transition-transform hover:-translate-y-1">
            <MessageCircle className="h-8 w-8 text-whatsapp" />
            <p className="eyebrow mt-6 text-ink-muted">Fastest response</p>
            <p className="mt-2 text-2xl font-bold">WhatsApp {c.whatsappDisplay}</p>
            <span className={btn({ variant: "whatsapp", className: "mt-6" })}>Start a chat</span>
          </a>
          <ul className="divide-y divide-border rounded-sm border border-border">
            {items.map((i) => (
              <li key={i.label} className="flex items-start gap-4 p-5">
                <i.icon className="mt-0.5 h-5 w-5 shrink-0 text-crimson" strokeWidth={1.5} />
                <div><p className="eyebrow text-muted-foreground">{i.label}</p>{i.href ? <a href={i.href} className="mt-1 block font-semibold hover:text-crimson">{i.value}</a> : <p className="mt-1 font-semibold">{i.value}</p>}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-sm border border-border bg-card p-6 shadow-card md:p-10 lg:col-span-7">
          <h2 className="mb-6 text-2xl font-bold">Send an inquiry</h2>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
