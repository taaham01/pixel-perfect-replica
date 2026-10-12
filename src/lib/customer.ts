import { z } from "zod";

/** Phone numbers: digits with an optional leading +, spaces, dashes, dots and brackets. */
export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Enter a valid phone number")
  .max(30, "Enter a valid phone number")
  .regex(/^\+?[0-9 ().-]+$/, "Use digits only, with an optional leading +")
  .refine((v) => v.replace(/\D/g, "").length >= 6, "Enter a valid phone number");

export const detailsSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name").max(120),
  country: z.string().trim().min(1, "Select your country").max(80),
  phone: phoneSchema,
});

export const signupSchema = detailsSchema.extend({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

/** Only follow redirects that stay on this site. */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("banned")) return "This account has been deactivated.";
  if (m.includes("already") && m.includes("registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("password") && (m.includes("weak") || m.includes("pwned") || m.includes("known"))) {
    return "That password is too easy to guess. Please choose a stronger one.";
  }
  if (m.includes("rate") || m.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("invalid login")) return "Incorrect email or password.";
  return "Something went wrong. Please try again.";
}
