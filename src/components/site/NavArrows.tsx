import { useEffect, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STORE = "ah-nav-history";

type HistState = { __TSR_index?: number; __TSR_key?: string; key?: string } | null;

/**
 * Keeps a list of the page keys visited in this tab so we know whether "Forward" has somewhere to go
 * (browsers only tell us about going back). Opening a new page after going back drops the forward pages,
 * exactly like the browser's own arrows.
 */
function track(st: HistState): { canBack: boolean; canForward: boolean } {
  if (typeof window === "undefined") return { canBack: false, canForward: false };
  const idx = st?.__TSR_index ?? 0;
  const key = st?.__TSR_key ?? st?.key ?? `idx-${idx}`;
  let keys: string[] = [];
  try { keys = JSON.parse(sessionStorage.getItem(STORE) ?? "[]"); } catch { /* storage unavailable */ }
  if (keys[idx] !== key) { keys = keys.slice(0, idx); keys[idx] = key; }
  try { sessionStorage.setItem(STORE, JSON.stringify(keys)); } catch { /* storage unavailable */ }
  return { canBack: idx > 0, canForward: idx < keys.length - 1 };
}

/** Back / Forward buttons that move through the pages visited in this tab. */
export function NavArrows({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const router = useRouter();
  const href = useRouterState({ select: (s) => s.location.href });
  const [state, setState] = useState({ canBack: false, canForward: false });

  useEffect(() => { setState(track(router.history.location.state as HistState)); }, [href, router]);

  const base = tone === "light"
    ? "border-ink-foreground/25 text-ink-foreground hover:bg-ink-foreground/10"
    : "border-border text-foreground hover:bg-secondary";
  const cls = cn("grid h-8 w-8 place-items-center rounded-sm border transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent", base);

  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label="Page history">
      <button type="button" onClick={() => router.history.back()} disabled={!state.canBack} className={cls} aria-label="Go back to the previous page" title="Back">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => router.history.forward()} disabled={!state.canForward} className={cls} aria-label="Go forward to the next page" title="Forward">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
