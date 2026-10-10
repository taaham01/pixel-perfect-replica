import type { ReactNode } from "react";
import { Logo } from "@/components/site/Logo";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo tone="light" /></div>
        <div className="rounded-sm border border-border bg-card p-8 shadow-lift">
          <p className="eyebrow text-crimson">Admin</p>
          <h1 className="mt-2 text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
