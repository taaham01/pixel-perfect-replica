import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, RefreshCw, Replace, RotateCcw, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { imageUrl, MAX_IMAGES, type VehicleImageRow } from "@/data/vehicles";
import { cn } from "@/lib/utils";
import { processAndUpload, removeStoredFiles, validateImageFile } from "./upload";

interface QueueItem { key: string; file: File; preview: string; status: "queued" | "uploading" | "error"; progress: number; error?: string }
export interface ImageManagerHandle { flush: (vehicleId: string) => Promise<number>; pendingCount: () => number }

/** Multi-image upload, ordering, cover selection, replace and remove for one vehicle. */
export function ImageManager({ vehicleId, handle }: { vehicleId: string | null; handle?: Ref<ImageManagerHandle> }) {
  const [images, setImages] = useState<VehicleImageRow[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<VehicleImageRow | null>(null);
  const nextPos = useRef(0);
  const queueRef = useRef(queue); queueRef.current = queue;

  const load = useCallback(async () => {
    if (!vehicleId) return;
    const { data, error } = await supabase.from("vehicle_images").select("*").eq("vehicle_id", vehicleId).order("position").order("created_at");
    if (error) { toast.error("Could not load photos."); return; }
    setImages(data ?? []);
    nextPos.current = Math.max(nextPos.current, ...(data ?? []).map((i) => i.position + 1), 0);
  }, [vehicleId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => queueRef.current.forEach((q) => URL.revokeObjectURL(q.preview)), []);

  const patch = (key: string, p: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function uploadItem(vid: string, item: QueueItem) {
    patch(item.key, { status: "uploading", progress: 0, error: undefined });
    try {
      const up = await processAndUpload(vid, item.file, (p) => patch(item.key, { progress: p }));
      const position = nextPos.current++;
      const { error } = await supabase.from("vehicle_images").insert({ vehicle_id: vid, ...up, position, original_name: item.file.name.slice(0, 200) });
      if (error) { await removeStoredFiles([up.storage_path, up.thumb_path]); throw new Error("Could not save photo record."); }
      URL.revokeObjectURL(item.preview);
      setQueue((q) => q.filter((x) => x.key !== item.key));
      return true;
    } catch (e) {
      patch(item.key, { status: "error", error: e instanceof Error ? e.message : "Upload failed" });
      return false;
    }
  }

  async function runQueue(vid: string, items: QueueItem[]) {
    let failed = 0;
    const pool = [...items];
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (pool.length) { const it = pool.shift()!; if (!(await uploadItem(vid, it))) failed++; }
    }));
    await (vid === vehicleId ? load() : Promise.resolve());
    return failed;
  }

  useImperativeHandle(handle, () => ({
    flush: (vid) => runQueue(vid, queueRef.current.filter((q) => q.status !== "uploading")),
    pendingCount: () => queueRef.current.length,
  }));

  function addFiles(list: FileList | File[]) {
    const files = [...list];
    const room = MAX_IMAGES - images.length - queue.length;
    if (files.length > room) toast.error(`Maximum ${MAX_IMAGES} photos per vehicle. ${files.length - Math.max(room, 0)} skipped.`);
    const items: QueueItem[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      const err = validateImageFile(file);
      if (err) { toast.error(`${file.name}: ${err}`); continue; }
      items.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: "queued", progress: 0 });
    }
    if (!items.length) return;
    setQueue((q) => [...q, ...items]);
    if (vehicleId) runQueue(vehicleId, items);
  }

  async function persistOrder(next: VehicleImageRow[]) {
    setImages(next);
    const changed = next.map((img, i) => ({ img, i })).filter(({ img, i }) => img.position !== i);
    const results = await Promise.all(changed.map(({ img, i }) => supabase.from("vehicle_images").update({ position: i }).eq("id", img.id)));
    if (results.some((r) => r.error)) toast.error("Could not save the new order.");
    nextPos.current = next.length;
    load();
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images]; const [m] = next.splice(from, 1); next.splice(to, 0, m!); persistOrder(next);
  };

  async function setCover(img: VehicleImageRow) {
    setBusy(img.id);
    const a = await supabase.from("vehicle_images").update({ is_primary: false }).eq("vehicle_id", img.vehicle_id).eq("is_primary", true);
    const b = a.error ? a : await supabase.from("vehicle_images").update({ is_primary: true }).eq("id", img.id);
    setBusy(null);
    if (b.error) toast.error("Could not set cover photo."); else { toast.success("Cover photo updated."); load(); }
  }

  async function remove(img: VehicleImageRow) {
    if (!confirm("Remove this photo permanently?")) return;
    setBusy(img.id);
    const { error } = await supabase.from("vehicle_images").delete().eq("id", img.id);
    if (!error) await removeStoredFiles([img.storage_path, img.thumb_path]);
    setBusy(null);
    if (error) toast.error("Could not remove photo."); else load();
  }

  async function replace(file: File) {
    const img = replaceTarget.current; if (!img) return;
    const err = validateImageFile(file); if (err) { toast.error(err); return; }
    setBusy(img.id);
    try {
      const up = await processAndUpload(img.vehicle_id, file);
      const { error } = await supabase.from("vehicle_images").update({ ...up, original_name: file.name.slice(0, 200) }).eq("id", img.id);
      if (error) { await removeStoredFiles([up.storage_path, up.thumb_path]); throw error; }
      await removeStoredFiles([img.storage_path, img.thumb_path]);
      toast.success("Photo replaced."); load();
    } catch { toast.error("Could not replace photo."); } finally { setBusy(null); }
  }

  const coverId = images.find((i) => i.is_primary)?.id ?? images[0]?.id;

  return (
    <div>
      <div
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); } }}
        onClick={() => fileInput.current?.click()}
        className={cn("flex cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors", dragOver ? "border-crimson bg-crimson/5" : "border-border hover:border-crimson/50")}
      >
        <ImagePlus className="h-8 w-8 text-crimson" />
        <p className="mt-3 font-semibold">Drag photos here or click to choose</p>
        <p className="mt-1 text-sm text-muted-foreground">Select many at once · JPG, PNG or WebP · up to {MAX_IMAGES} photos · images are optimised automatically</p>
        {!vehicleId && queue.length > 0 && <p className="mt-2 text-sm font-medium text-crimson">{queue.length} photo(s) will upload when you save.</p>}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={replaceInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) replace(f); e.target.value = ""; }} />
      </div>

      {(images.length > 0 || queue.length > 0) && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, idx) => (
            <div key={img.id} draggable onDragStart={() => setDragIdx(idx)} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) move(dragIdx, idx); setDragIdx(null); }}
              className={cn("group relative overflow-hidden rounded-sm border bg-muted", img.id === coverId ? "border-crimson ring-2 ring-crimson/30" : "border-border", dragIdx === idx && "opacity-40")}>
              <img src={imageUrl(img.thumb_path ?? img.storage_path)!} alt="" className="aspect-[3/2] w-full cursor-move object-cover" loading="lazy" />
              <span className="absolute left-2 top-2 rounded-sm bg-ink/80 px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-foreground">{idx + 1}</span>
              {img.id === coverId && <span className="absolute right-2 top-2 rounded-sm bg-crimson px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-ink-foreground">Cover</span>}
              {busy === img.id && <div className="absolute inset-0 flex items-center justify-center bg-ink/50"><Loader2 className="h-6 w-6 animate-spin text-ink-foreground" /></div>}
              <div className="flex items-center justify-between gap-1 border-t border-border bg-card p-1.5">
                <IconBtn label="Move left" onClick={() => move(idx, idx - 1)} disabled={idx === 0}><ArrowLeft /></IconBtn>
                <IconBtn label="Set as cover" onClick={() => setCover(img)} disabled={img.id === coverId}><Star /></IconBtn>
                <IconBtn label="Replace photo" onClick={() => { replaceTarget.current = img; replaceInput.current?.click(); }}><Replace /></IconBtn>
                <IconBtn label="Remove photo" onClick={() => remove(img)}><Trash2 /></IconBtn>
                <IconBtn label="Move right" onClick={() => move(idx, idx + 1)} disabled={idx === images.length - 1}><ArrowRight /></IconBtn>
              </div>
            </div>
          ))}
          {queue.map((q) => (
            <div key={q.key} className={cn("relative overflow-hidden rounded-sm border bg-muted", q.status === "error" ? "border-crimson" : "border-border")}>
              <img src={q.preview} alt="" className="aspect-[3/2] w-full object-cover opacity-70" />
              <div className="absolute inset-x-0 bottom-0 bg-card/95 p-2 text-xs">
                {q.status === "error" ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-crimson" title={q.error}>{q.error}</span>
                    <span className="flex gap-1">
                      {vehicleId && <IconBtn label="Retry upload" onClick={() => runQueue(vehicleId, [q])}><RotateCcw /></IconBtn>}
                      <IconBtn label="Discard" onClick={() => { URL.revokeObjectURL(q.preview); setQueue((x) => x.filter((i) => i.key !== q.key)); }}><X /></IconBtn>
                    </span>
                  </div>
                ) : q.status === "uploading" ? (
                  <div><div className="mb-1 flex justify-between"><span>Uploading</span><span>{Math.round(q.progress * 100)}%</span></div><div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-crimson transition-all" style={{ width: `${q.progress * 100}%` }} /></div></div>
                ) : (
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Waiting to upload</span><IconBtn label="Discard" onClick={() => { URL.revokeObjectURL(q.preview); setQueue((x) => x.filter((i) => i.key !== q.key)); }}><X /></IconBtn></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {images.length > 1 && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="h-3 w-3" /> Drag photos (or use the arrows) to reorder. The star sets the cover photo.</p>}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 [&_svg]:h-3.5 [&_svg]:w-3.5">
      {children}
    </button>
  );
}
