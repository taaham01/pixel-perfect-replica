import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { commonMakes, type PublishState, type VehicleRow } from "@/data/vehicles";
import { useAdmin } from "@/hooks/use-admin";
import { btn } from "@/components/site/primitives";
import { fieldCls } from "@/components/site/vehicles";
import { cn } from "@/lib/utils";
import { dbErrorMessage, rowToForm, validateVehicle, vehicleFields, type FieldDef } from "./fields";
import { ImageManager, type ImageManagerHandle } from "./ImageManager";
import { removeStoredFiles } from "./upload";
import { confirmDialog } from "@/components/site/ConfirmDialog";

const sections: { title: string; keys: string[] }[] = [
  { title: "Identity", keys: ["stock_id", "make", "model", "variant", "year", "chassis_number", "auction_grade"] },
  { title: "Price & availability", keys: ["price", "currency", "status", "featured"] },
  { title: "Specifications", keys: ["mileage", "mileage_unit", "engine_cc", "transmission", "fuel", "body_type", "drivetrain", "exterior_color", "interior_color"] },
  { title: "Location & description", keys: ["location", "shipping_info", "description"] },
];
const fieldMap = Object.fromEntries(vehicleFields.map((f) => [f.key, f])) as Record<string, FieldDef>;
const stateLabel: Record<PublishState, string> = { draft: "Draft", published: "Published", archived: "Archived" };

export function VehicleEditor({ vehicle }: { vehicle?: VehicleRow }) {
  const admin = useAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const images = useRef<ImageManagerHandle>(null);
  const [form, setForm] = useState<Record<string, string>>(() => vehicle ? rowToForm(vehicle) : { currency: "USD", status: "available", mileage_unit: "km", location: "Japan" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const current = vehicle?.publish_state;

  const set = (k: string, v: string) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => { const n = { ...e }; delete n[k]; return n; }); };

  async function save(label: string, override: { publish_state?: PublishState; status?: string } = {}) {
    const { value, errors: errs } = validateVehicle({ ...form, ...(override.status ? { status: override.status } : {}) });
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Please fix the highlighted fields."); return; }
    setSaving(label);
    const payload = { ...value, ...(override.publish_state ? { publish_state: override.publish_state } : {}) };
    try {
      if (!vehicle) {
        const { data, error } = await supabase.from("vehicles").insert({ ...payload, publish_state: override.publish_state ?? "draft" }).select("id").single();
        if (error) { toast.error(dbErrorMessage(error)); return; }
        const failed = await images.current?.flush(data.id) ?? 0;
        toast.success(override.publish_state === "published" ? "Vehicle published." : "Draft saved.");
        if (failed) toast.error(`${failed} photo(s) failed to upload — you can retry them on the next screen.`);
        qc.invalidateQueries();
        navigate({ to: "/admin/vehicles/$id/edit", params: { id: data.id }, replace: true });
      } else {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", vehicle.id);
        if (error) { toast.error(dbErrorMessage(error)); return; }
        if (override.status) setForm((f) => ({ ...f, status: override.status! }));
        toast.success("Changes saved.");
        qc.invalidateQueries();
        navigate({ to: ".", replace: true }); // re-run loader for fresh row
      }
    } finally { setSaving(null); }
  }

  async function destroy() {
    if (!vehicle || !(await confirmDialog({ title: `Delete ${vehicle.stock_id}?`, description: "The vehicle and all its photos are deleted permanently. This cannot be undone.", details: [["Vehicle", `${vehicle.year} ${vehicle.make} ${vehicle.model}`], ["Stock ID", vehicle.stock_id]], confirmLabel: "Delete vehicle", tone: "danger" }))) return;
    setSaving("delete");
    const { data: imgs } = await supabase.from("vehicle_images").select("storage_path, thumb_path").eq("vehicle_id", vehicle.id);
    const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
    setSaving(null);
    if (error) { toast.error(dbErrorMessage(error)); return; }
    await removeStoredFiles((imgs ?? []).flatMap((i) => [i.storage_path, i.thumb_path]));
    toast.success("Vehicle deleted."); qc.invalidateQueries();
    navigate({ to: "/admin/vehicles" });
  }

  const B = ({ id, children, variant = "outline", onClick }: { id: string; children: React.ReactNode; variant?: "outline" | "primary" | "ink"; onClick: () => void }) => (
    <button type="button" disabled={!!saving} onClick={onClick} className={cn(btn({ variant, size: "sm" }), "disabled:opacity-50")}>{saving === id && <Loader2 className="h-4 w-4 animate-spin" />}{children}</button>
  );

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-crimson">{vehicle ? `Editing · ${stateLabel[current!]}` : "New vehicle"}</p>
          <h1 className="mt-1 text-2xl font-bold md:text-3xl">{vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "Add a vehicle"}</h1>
          {vehicle && current === "published" && <Link to="/vehicles/$slug" params={{ slug: vehicle.slug! }} target="_blank" className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-crimson">View on website <ExternalLink className="h-3.5 w-3.5" /></Link>}
        </div>
        {vehicle && admin.isSuper && (
          <div className="flex gap-2">
            {current === "archived"
              ? <B id="restore" onClick={() => save("restore", { publish_state: "draft" })}>Restore to draft</B>
              : <B id="archive" onClick={() => save("archive", { publish_state: "archived" })}><Archive className="h-4 w-4" /> Archive</B>}
            <B id="delete" onClick={destroy}><Trash2 className="h-4 w-4" /> Delete</B>
          </div>
        )}
      </div>

      {sections.map((s) => (
        <section key={s.title} className="rounded-sm border border-border bg-card p-5 md:p-6">
          <h2 className="mb-5 font-bold">{s.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.keys.map((k) => <Field key={k} def={fieldMap[k]!} value={form[k] ?? ""} error={errors[k]} onChange={(v) => set(k, v)} />)}
          </div>
        </section>
      ))}

      <section className="rounded-sm border border-border bg-card p-5 md:p-6">
        <h2 className="mb-1 font-bold">Photos</h2>
        <p className="mb-5 text-sm text-muted-foreground">The cover photo is shown on listing cards. Changes to photos save instantly.</p>
        <ImageManager vehicleId={vehicle?.id ?? null} handle={images} />
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:left-64">
        <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 md:px-8">
          {Object.keys(errors).length > 0 && <span className="mr-auto text-sm text-crimson">{Object.keys(errors).length} field(s) need attention</span>}
          {!vehicle ? (
            <>
              <B id="draft" onClick={() => save("draft", { publish_state: "draft" })}>Save as draft</B>
              {admin.perms.publish && <B id="publish" variant="primary" onClick={() => save("publish", { publish_state: "published" })}>Publish</B>}
            </>
          ) : (
            <>
              {form.status !== "sold" && <B id="sold" onClick={() => save("sold", { status: "sold" })}>Mark as sold</B>}
              {admin.perms.publish && current === "published" && <B id="unpub" onClick={() => save("unpub", { publish_state: "draft" })}>Unpublish</B>}
              {admin.perms.publish && current === "draft" && <B id="publish" variant="ink" onClick={() => save("publish", { publish_state: "published" })}>Publish</B>}
              <B id="save" variant="primary" onClick={() => save("save")}>Save changes</B>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ def, value, error, onChange }: { def: FieldDef; value: string; error?: string; onChange: (v: string) => void }) {
  const label = <span className="eyebrow mb-2 block text-muted-foreground">{def.label}{def.required && <span className="text-crimson"> *</span>}</span>;
  const cls = cn(fieldCls, error && "border-crimson");
  const listId = def.suggestions || def.key === "make" ? `dl-${def.key}` : undefined;
  let input: React.ReactNode;
  if (def.type === "longtext") input = <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} maxLength={def.max} className={cn(cls, "h-auto py-2")} />;
  else if (def.type === "enum") input = <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>{!def.required && <option value="">—</option>}{def.options!.map((o) => <option key={o} value={o}>{o[0]!.toUpperCase() + o.slice(1)}</option>)}</select>;
  else if (def.type === "bool") return (
    <label className="flex items-center gap-3 self-end pb-3"><input type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "")} className="h-4 w-4 accent-crimson" /><span className="text-sm font-medium">Feature on home page</span></label>
  );
  else input = <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={def.type === "text" ? undefined : "decimal"} maxLength={def.max} list={listId} className={cls} />;
  return (
    <label className={cn("block", def.type === "longtext" && "sm:col-span-2 lg:col-span-3")}>
      {label}{input}
      {listId && <datalist id={listId}>{(def.suggestions ?? commonMakes).map((o) => <option key={o} value={o} />)}</datalist>}
      {error && <span className="mt-1 block text-xs text-crimson">{error}</span>}
    </label>
  );
}
