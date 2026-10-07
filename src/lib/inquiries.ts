/**
 * Submission layer for all forms. Currently simulated; replace the body of
 * `submitForm` with a backend call (e.g. insert into an inquiries table).
 */
export type FormKind = "vehicle-inquiry" | "vehicle-request" | "dealer" | "contact";

export async function submitForm(kind: FormKind, data: Record<string, string>) {
  await new Promise((r) => setTimeout(r, 600));
  if (import.meta.env.DEV) console.info("[form]", kind, data);
  return { ok: true as const };
}
