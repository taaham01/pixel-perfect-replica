import { useEffect, useState, type ReactNode } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { AlertTriangle, CheckCircle2, HelpCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { btn } from "./primitives";

/**
 * Site-styled replacement for the browser's confirm() popup.
 *   if (await confirmDialog({ title: "Approve this booking?", confirmLabel: "Approve" })) …
 * Mount <ConfirmDialogHost /> once (done in __root.tsx).
 */
export type ConfirmTone = "primary" | "success" | "danger";
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

type Request = ConfirmOptions & { resolve: (ok: boolean) => void };
let push: ((r: Request) => void) | null = null;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Fallback if the host isn't mounted (should not happen).
  if (!push) return Promise.resolve(typeof window !== "undefined" && window.confirm(options.title));
  return new Promise((resolve) => push!({ ...options, resolve }));
}

const toneStyle: Record<ConfirmTone, { ring: string; icon: LucideIcon; button: string }> = {
  primary: { ring: "bg-champagne/25 text-ink", icon: HelpCircle, button: "" },
  success: { ring: "bg-emerald-600/15 text-emerald-700", icon: CheckCircle2, button: "!bg-emerald-700 hover:!bg-emerald-800" },
  danger: { ring: "bg-crimson/10 text-crimson", icon: AlertTriangle, button: "" },
};

export function ConfirmDialogHost() {
  const [queue, setQueue] = useState<Request[]>([]);
  const current = queue[0];

  useEffect(() => {
    push = (r) => setQueue((q) => [...q, r]);
    return () => { push = null; };
  }, []);

  function close(ok: boolean) {
    current?.resolve(ok);
    setQueue((q) => q.slice(1));
  }

  const tone = current?.tone ?? "primary";
  const style = toneStyle[tone];
  const Icon = current?.icon ?? style.icon;

  return (
    <AlertDialog.Root open={!!current} onOpenChange={(open) => { if (!open) close(false); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[100] bg-ink/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 z-[101] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-sm border border-border bg-card shadow-lift duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {current && (
            <>
              <div className={cn("h-1 w-full", tone === "danger" ? "bg-crimson" : tone === "success" ? "bg-emerald-600" : "bg-champagne")} />
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
                  <AlertDialog.Cancel className={btn({ variant: "outline", size: "sm" })}>{current.cancelLabel ?? "Cancel"}</AlertDialog.Cancel>
                  <AlertDialog.Action onClick={(e) => { e.preventDefault(); close(true); }}
                    className={cn(btn({ variant: tone === "primary" ? "ink" : "primary", size: "sm" }), style.button)}>
                    {current.confirmLabel ?? "Confirm"}
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

