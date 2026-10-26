import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/** Every website form saves into the inquiries table; staff see them in the admin portal (Inquiries). */
export type FormKind = "vehicle-inquiry" | "vehicle-request" | "dealer" | "contact" | "question";

export const formKindLabel: Record<FormKind, string> = {
  "vehicle-inquiry": "Vehicle inquiry",
  "vehicle-request": "Request a car",
  dealer: "Dealer application",
  contact: "Contact form",
  question: "Customer question",
};

/** Hidden field real visitors never fill in; bots usually do. */
export const HONEYPOT = "website";

const take = (data: Record<string, string>, key: string) => {
  const v = (data[key] ?? "").trim();
  delete data[key];
  return v || null;
};

export async function submitForm(kind: FormKind, input: Record<string, string>, extra: { vehicleId?: string } = {}) {
  const data = { ...input };
  if (take(data, HONEYPOT)) return { ok: true as const }; // quietly drop bot submissions

  const name = take(data, "name");
  const email = take(data, "email");
  if (!name || !email) throw new Error("Please fill in your name and email.");
  const phone = take(data, "whatsapp") ?? take(data, "phone");
  const country = take(data, "country");
  const subject = take(data, "subject");
  const message = take(data, "message") ?? take(data, "requirements");
  // Whatever is left (company, budget, make, stock ID…) is kept as extra details.
  const details: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) if (v?.trim()) details[k] = v.trim().slice(0, 500);

  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from("inquiries").insert({
    kind, name: name.slice(0, 120), email: email.slice(0, 254), phone: phone?.slice(0, 40) ?? null,
    country: country?.slice(0, 80) ?? null, subject: subject?.slice(0, 200) ?? null, message: message?.slice(0, 4000) ?? null,
    details: details as Json, vehicle_id: extra.vehicleId ?? null, user_id: session?.user.id ?? null,
  });
  if (error) throw new Error(error.message.includes("Too many") ? "You've sent several messages already. Please wait a few minutes and try again." : "We couldn't send your message.");
  return { ok: true as const };
}

/** A signed-in customer asks a question from their account; it lands in admin Inquiries. */
export async function askQuestion(input: { name: string; email: string; phone?: string; country?: string; subject: string; message: string }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in first.");
  const { error } = await supabase.from("inquiries").insert({
    kind: "question", user_id: session.user.id,
    name: (input.name || input.email).slice(0, 120), email: input.email.slice(0, 254),
    phone: input.phone?.slice(0, 40) || null, country: input.country?.slice(0, 80) || null,
    subject: input.subject.trim().slice(0, 200) || null, message: input.message.trim().slice(0, 4000),
  });
  if (error) throw new Error(error.message.includes("Too many") ? "You've sent several messages already. Please wait a few minutes and try again." : "We couldn't send your question.");
}

/** The signed-in customer's own questions and messages, with the team's replies. */
export async function myQuestions() {
  const { data, error } = await supabase.rpc("my_inquiries");
  if (error) throw new Error("Could not load your questions.");
  return data ?? [];
}
