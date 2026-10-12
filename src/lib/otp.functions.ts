import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "Use international format, e.g. +819012345678");

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Sends via Twilio when TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM are set. */
async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) throw new Error("SMS verification is not set up yet. Please contact us on WhatsApp to verify your number.");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) throw new Error("Could not send the SMS. Check the number and try again.");
}

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin.from("phone_otps").select("created_at").eq("user_id", context.userId).maybeSingle();
    if (prev && Date.now() - new Date(prev.created_at).getTime() < 60_000) throw new Error("Please wait a minute before requesting another code.");
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    await sendSms(data.phone, `Your verification code is ${code}`);
    await supabaseAdmin.from("phone_otps").upsert({ user_id: context.userId, phone: data.phone, code_hash: await sha256(context.userId + code), attempts: 0, expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), created_at: new Date().toISOString() });
    return { ok: true };
  });

export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("phone_otps").select("*").eq("user_id", context.userId).maybeSingle();
    if (!row || new Date(row.expires_at) < new Date()) throw new Error("Code expired. Request a new one.");
    if (row.attempts >= 5) throw new Error("Too many attempts. Request a new code.");
    if (row.code_hash !== (await sha256(context.userId + data.code))) {
      await supabaseAdmin.from("phone_otps").update({ attempts: row.attempts + 1 }).eq("user_id", context.userId);
      throw new Error("Incorrect code.");
    }
    await supabaseAdmin.from("profiles").update({ phone: row.phone, phone_verified: true }).eq("id", context.userId);
    await supabaseAdmin.from("phone_otps").delete().eq("user_id", context.userId);
    return { ok: true };
  });
