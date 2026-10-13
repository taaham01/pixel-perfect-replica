import type { ReactNode } from "react";

/** Centered card on the dark site hero, used by the customer sign in / sign up pages. */
export function AuthShell({ eyebrow, title, subtitle, children, footer }: { eyebrow: string; title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-ink px-4 pb-20 pt-32 md:pt-40">
      <div className="grid-lines absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-lg">
        <div className="rounded-sm border border-border bg-card p-8 shadow-lift">
          <p className="eyebrow text-crimson">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>}
      </div>
    </section>
  );
}
