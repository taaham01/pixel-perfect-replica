import { useEffect, useRef, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const btn = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-crimson text-primary-foreground hover:bg-crimson-deep",
        ink: "bg-ink text-ink-foreground hover:bg-ink-soft",
        outline: "border border-foreground/20 text-foreground hover:border-foreground hover:bg-foreground/5",
        ghostLight: "border border-ink-foreground/25 text-ink-foreground hover:bg-ink-foreground/10 hover:border-ink-foreground/60",
        whatsapp: "bg-whatsapp text-ink hover:brightness-95",
        link: "px-0 text-foreground underline-offset-4 hover:text-crimson",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-13 px-7 text-[0.95rem]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
export type BtnProps = VariantProps<typeof btn>;

export function SectionHeader({
  eyebrow, title, subtitle, align = "left", tone = "light", className,
}: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; align?: "left" | "center"; tone?: "light" | "dark"; className?: string }) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <p className={cn("eyebrow mb-4 flex items-center gap-3", align === "center" && "justify-center", tone === "dark" ? "text-champagne" : "text-crimson")}>
          <span className="h-px w-8 bg-current" />
          {eyebrow}
        </p>
      )}
      <h2 className={cn("text-3xl font-bold leading-[1.08] md:text-5xl", tone === "dark" && "text-ink-foreground")}>{title}</h2>
      {subtitle && (
        <p className={cn("mt-5 text-base leading-relaxed md:text-lg", tone === "dark" ? "text-ink-muted" : "text-muted-foreground")}>{subtitle}</p>
      )}
    </div>
  );
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("is-visible"); io.disconnect(); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

export function PageHero({ eyebrow, title, subtitle }: { eyebrow: string; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-ink pb-16 pt-36 text-ink-foreground md:pb-24 md:pt-44">
      <div className="grid-lines absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="container-x relative">
        <p className="eyebrow mb-5 flex items-center gap-3 text-champagne"><span className="h-px w-8 bg-current" />{eyebrow}</p>
        <h1 className="max-w-3xl animate-fade-up text-4xl font-bold leading-[1.04] md:text-6xl">{title}</h1>
        {subtitle && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
    </section>
  );
}
