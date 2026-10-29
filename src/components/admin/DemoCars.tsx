import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/lib/notify";
import { btn } from "@/components/site/primitives";
import { countDemoCars, loadDemoCars, removeDemoCars } from "@/lib/demo-inventory";
import { confirmDialog } from "@/components/site/ConfirmDialog";

/** Super Admin tool on the Inventory page: add or remove a set of test cars (stock IDs starting with DEMO-). */
export function DemoCars() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"load" | "remove" | null>(null);
  const [step, setStep] = useState("");
  const count = useQuery({ queryKey: ["admin", "demo-count"], queryFn: countDemoCars });

  async function run(kind: "load" | "remove") {
    if (kind === "remove" && !(await confirmDialog({ title: "Delete all demo cars?", description: "All DEMO- test cars, their photos and any bookings made on them will be deleted.", confirmLabel: "Delete demo cars", tone: "danger" }))) return;
    setBusy(kind);
    try {
      if (kind === "load") {
        const n = await loadDemoCars(setStep);
        toast.success(n ? `Added ${n} test car${n === 1 ? "" : "s"}.` : "The test cars are already there.");
      } else {
        const n = await removeDemoCars();
        toast.success(`Removed ${n} test car${n === 1 ? "" : "s"}.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null); setStep("");
      void qc.invalidateQueries();
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-dashed border-border bg-secondary/40 p-4 text-sm">
      <p className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-crimson" />
        <span><span className="font-semibold">Test cars</span> <span className="text-muted-foreground">· {busy ? step || "Working…" : `${count.data ?? 0} on the site (stock IDs start with DEMO-)`}</span></span>
      </p>
      <span className="flex gap-2">
        <button onClick={() => run("load")} disabled={!!busy} className={btn({ variant: "outline", size: "sm" })}>{busy === "load" && <Loader2 className="h-4 w-4 animate-spin" />} Load test cars</button>
        {!!count.data && <button onClick={() => run("remove")} disabled={!!busy} className={btn({ variant: "outline", size: "sm" })}>{busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove test cars</button>}
      </span>
    </div>
  );
}
