import { useEffect, useState, type ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";

/**
 * The site's own message box, used instead of the browser's confirm() / alert() popups.
 *   if (await confirmDialog({ title: "Approve this booking?", confirmLabel: "Approve" })) …   // two buttons
 *   await messageBox({ title: "Saved", description: "Your details were saved.", tone: "success" }) // one OK button
 * Mounted once as <ConfirmDialogHost /> in __root.tsx.
 */
export type ConfirmTone = "primary" | "success" | "danger" | "warning" | "info";
export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  /** Small label/value rows shown in a box, e.g. [["Car", "2020 Mazda CX-5"], ["Customer", "Ali"]]. */
  details?: [string, ReactNode][];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: LucideIcon;
};
export type MessageOptions = Omit<ConfirmOptions, "cancelLabel"> & {
  /** Close by itself after this many milliseconds (a bar shows the time left). */
  autoCloseMs?: number;
};

type Request = ConfirmOptions & { kind: "confirm" | "message"; autoCloseMs?: number; key: number; resolve: (ok: boolean) => void };
let push: ((r: Request) => void) | null = null;
let nextKey = 1;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!push) return Promise.resolve(typeof window !== "undefined" && window.confirm(options.title)); // host not mounted yet
  return new Promise((resolve) => push!({ ...options, kind: "confirm", key: nextKey++, resolve }));
}

export function messageBox(options: MessageOptions): Promise<void> {
  if (!push) return Promise.resolve();
  return new Promise((resolve) => push!({ ...options, kind: "message", key: nextKey++, resolve: () => resolve() }));
}

const toneStyle: Record<ConfirmTone, { ring: string; bar: string; icon: LucideIcon; button: string }> = {
  primary: { ring: "bg-champagne/25 text-ink", bar: "bg-champagne", icon: HelpCircle, button: "" },
  success: { ring: "bg-emerald-600/15 text-emerald-700", bar: "bg-emerald-600", icon: CheckCircle2, button: "!bg-emerald-700 hover:!bg-emerald-800" },
  danger: { ring: "bg-crimson/10 text-crimson", bar: "bg-crimson", icon: AlertTriangle, button: "" },
  warning: { ring: "bg-amber-500/15 text-amber-600", bar: "bg-amber-500", icon: AlertTriangle, button: "" },
  info: { ring: "bg-champagne/25 text-ink", bar: "bg-champagne", icon: Info, button: "" },
};

/** Thin bar that empties over `ms`, showing when an auto-closing message will disappear. */
function TimeBar({ ms, className }: { ms: number; className: string }) {
  const [go, setGo] = useState(false);
  useEffect(() => { const f = requestAnimationFrame(() => setGo(true)); return () => cancelAnimationFrame(f); }, []);
  return (
    <div className="h-1 w-full bg-secondary" aria-hidden>
      <div className={cn("h-full", className)} style={{ width: go ? "0%" : "100%", transition: `width ${ms}ms linear` }} />
    </div>
  );
}

export function ConfirmDialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const current = queue[0];

  useEffect(() => {
    push = (r) => setQueue((q) => {
      // Don't stack the same message twice (e.g. one error repeated by a retry).
      if (r.kind === "message" && q.some((x) => x.kind === "message" && x.title === r.title && x.description === r.description)) {
        queueMicrotask(() => r.resolve(true));
        return q;
      }
      return [...q, r];
    });
    return () => { push = null; };
  }, []);

  function close(ok: boolean) {
    current?.resolve(ok);
    setQueue((q) => q.slice(1));
  }

  // Auto-close for short success messages.
  useEffect(() => {
    if (!current?.autoCloseMs) return;
    const t = window.setTimeout(() => close(true), current.autoCloseMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key]);

  const tone = current?.tone ?? (current?.kind === "message" ? "info" : "primary");
  const style = toneStyle[tone];
  const Icon = current?.icon ?? style.icon;
  const isMessage = current?.kind === "message";

  return (
    <AlertDialog.Root open={!!current} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[100] bg-ink/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content
          key={current?.key}
          className="fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-sm border border-border bg-card shadow-lift duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {current && (
            <>
              {current.autoCloseMs ? <TimeBar ms={current.autoCloseMs} className={style.bar} /> : <div className={cn("h-1 w-full", style.bar)} />}
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", style.ring)}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 pt-0.5">
                    <AlertDialog.Title className="text-lg font-bold leading-snug">{current.title}</AlertDialog.Title>
                    {current.description
                      ? <AlertDialog.Description className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{current.description}</AlertDialog.Description>
                      : <AlertDialog.Description className="sr-only">{current.title}</AlertDialog.Description>}
                  </div>
                </div>
                {!!current.details?.length && (
                  <dl className="mt-5 divide-y divide-border rounded-sm border border-border bg-secondary/40 text-sm">
                    {current.details.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 px-3 py-2">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-right font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {!isMessage && <AlertDialog.Cancel className={btn({ variant: "outline", size: "sm" })}>{current.cancelLabel ?? "Cancel"}</AlertDialog.Cancel>}
                  <AlertDialog.Action onClick={(e) => { e.preventDefault(); close(true); }}
                    className={cn(btn({ variant: isMessage ? "ink" : tone === "primary" ? "ink" : "primary", size: "sm" }), !isMessage && style.button, isMessage && "sm:min-w-24")}>
                    {current.confirmLabel ?? (isMessage ? "OK" : "Confirm")}
                  </AlertDialog.Action>
                </div>
              </div>
            </>
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
