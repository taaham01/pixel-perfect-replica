import { supabase } from "@/integrations/supabase/client";
import { getSessionFast } from "@/lib/auth-store";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const BUCKET = "vehicle-images";

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Only JPG, PNG or WebP images are allowed.";
  if (file.size > MAX_INPUT_BYTES) return "Image is larger than 25 MB.";
  return null;
}

/** Resize in the browser and re-encode as WebP so stored files are small and fast. */
async function resize(file: Blob, max: number, quality: number) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not process image"))), "image/webp", quality));
  return { blob, width, height };
}

function putWithProgress(path: string, blob: Blob, token: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("content-type", blob.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 403 ? "You are not allowed to upload images." : `Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });
}

export interface UploadedImage { storage_path: string; thumb_path: string; width: number; height: number; size_bytes: number }

/** Creates an optimised full-size image and a thumbnail, uploads both, returns their storage paths. */
export async function processAndUpload(vehicleId: string, file: Blob, onProgress: (p: number) => void = () => {}): Promise<UploadedImage> {
  const session = await getSessionFast();
  if (!session) throw new Error("Your session has expired. Please sign in again.");
  const [full, thumb] = await Promise.all([resize(file, 1920, 0.85), resize(file, 640, 0.78)]);
  const base = `vehicles/${vehicleId}/${crypto.randomUUID()}`;
  await putWithProgress(`${base}.webp`, full.blob, session.access_token, (p) => onProgress(p * 0.85));
  await putWithProgress(`${base}_thumb.webp`, thumb.blob, session.access_token, (p) => onProgress(0.85 + p * 0.15));
  onProgress(1);
  return { storage_path: `${base}.webp`, thumb_path: `${base}_thumb.webp`, width: full.width, height: full.height, size_bytes: full.blob.size };
}

export async function removeStoredFiles(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await supabase.storage.from(BUCKET).remove(list);
}
