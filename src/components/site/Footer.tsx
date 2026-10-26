import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { navLinks, site, whatsappLink } from "@/config/site";
import { bodyTypes } from "@/data/vehicles";
import { Logo } from "./Logo";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="container-x grid gap-12 py-20 md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Logo tone="light" />
          <p className="mt-6 max-w-xs text-2xl font-semibold leading-snug">{site.tagline}</p>
          <div className="mt-8 flex gap-3">
            {[[Facebook, site.social.facebook, "Facebook"], [Instagram, site.social.instagram, "Instagram"], [Youtube, site.social.youtube, "YouTube"], [Linkedin, site.social.linkedin, "LinkedIn"]].map(([Icon, href, label]) => {
              const I = Icon as typeof Facebook;
              return <a key={label as string} href={href as string} aria-label={label as string} className="grid h-10 w-10 place-items-center rounded-sm border border-ink-line text-ink-muted transition-colors hover:border-champagne hover:text-champagne"><I className="h-4 w-4" /></a>;
            })}
          </div>
        </div>
        <FooterCol title="Company">
          {navLinks.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
          <Link to="/how-it-works">How It Works</Link>
        </FooterCol>
        <FooterCol title="Vehicles">
          {bodyTypes.slice(0, 5).map((b) => <Link key={b} to="/vehicles" search={{ body: b }}>{b}</Link>)}
        </FooterCol>
        <FooterCol title="Customers">
          <Link to="/request-a-car">Request a Car</Link>
          <Link to="/how-it-works">Export Process</Link>
          <Link to="/dealers">Dealer Partnership</Link>
          <Link to="/contact">Get a Quote</Link>
        </FooterCol>
        <FooterCol title="Contact" span>
          <a href={whatsappLink()} target="_blank" rel="noreferrer" className="!text-whatsapp">WhatsApp {site.contact.whatsappDisplay}</a>
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
          <a href={`tel:${site.contact.phone}`}>{site.contact.phone}</a>
          <span>{site.contact.hours}</span>
        </FooterCol>
      </div>
      <div className="border-t border-ink-line">
        <div className="container-x flex flex-col gap-4 py-6 text-sm text-ink-muted md:flex-row md:items-center md:justify-between">
          <p>© {year} {site.name}. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-ink-foreground">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-ink-foreground">Terms & Conditions</Link>
            <Link to="/terms" hash="shipping" className="hover:text-ink-foreground">Shipping Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children, span }: { title: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={span ? "lg:col-span-2" : "lg:col-span-2"}>
      <p className="eyebrow mb-5 text-champagne">{title}</p>
      <div className="flex flex-col gap-3 text-sm text-ink-muted [&_a:hover]:text-ink-foreground [&_a]:transition-colors">{children}</div>
    </div>
  );
}
