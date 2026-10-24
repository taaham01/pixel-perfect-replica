import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { navLinks, whatsappLink } from "@/config/site";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { btn } from "./primitives";
import { UserMenu } from "./UserMenu";
import { NavArrows } from "./NavArrows";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const solid = scrolled || open;

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-300", solid ? "border-b border-ink-line bg-ink/95 backdrop-blur-md" : "bg-transparent")}>
      <div className="container-x flex h-18 items-center justify-between gap-6 py-4">
        <div className="flex items-center gap-3 sm:gap-5">
          <Logo tone="light" />
          <NavArrows />
        </div>
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm font-medium text-ink-muted transition-colors hover:text-ink-foreground" activeProps={{ className: "!text-ink-foreground" }}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <a href={whatsappLink()} target="_blank" rel="noreferrer" className={btn({ variant: "ghostLight", size: "sm" })}>
            <MessageCircle className="h-4 w-4" /> WhatsApp Us
          </a>
          <Link to="/vehicles" className={btn({ variant: "primary", size: "sm" })}>Browse Vehicles</Link>
          <UserMenu />
        </div>
        <button onClick={() => setOpen((o) => !o)} className="relative h-10 w-10 lg:hidden" aria-label="Toggle menu" aria-expanded={open}>
          <span className={cn("absolute left-2 right-2 h-0.5 bg-ink-foreground transition-all duration-300", open ? "top-1/2 rotate-45" : "top-[14px]")} />
          <span className={cn("absolute left-2 right-2 top-1/2 h-0.5 bg-ink-foreground transition-opacity", open && "opacity-0")} />
          <span className={cn("absolute left-2 right-2 h-0.5 bg-ink-foreground transition-all duration-300", open ? "top-1/2 -rotate-45" : "bottom-[13px]")} />
        </button>
      </div>
      <div className={cn("grid overflow-hidden transition-all duration-300 lg:hidden", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0">
          <nav className="container-x flex flex-col pb-6" aria-label="Mobile">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} className="border-b border-ink-line py-4 text-lg font-semibold text-ink-foreground">{l.label}</Link>
            ))}
            <UserMenu layout="mobile" />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <a href={whatsappLink()} target="_blank" rel="noreferrer" className={btn({ variant: "whatsapp" })}><MessageCircle className="h-4 w-4" /> WhatsApp</a>
              <Link to="/vehicles" className={btn({ variant: "primary" })}>Browse</Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
