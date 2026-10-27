import { z } from "zod";

/**
 * One strong-password rule for every account on the site (customers and staff).
 * Passwords are never stored as text: Supabase keeps only a bcrypt hash of each one.
 * Existing passwords keep working; this applies when a password is created or changed.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const PASSWORD_HINT = `At least ${PASSWORD_MIN} characters, with upper- and lower-case letters, a number and a symbol.`;

const COMMON = [
  "password", "passw0rd", "qwerty", "123456", "12345678", "letmein", "welcome", "admin", "iloveyou",
  "abc123", "monkey", "dragon", "football", "baseball", "sunshine", "princess", "master", "login",
  "alhasan", "alhassan", "hasanmotors", "motors", "japan", "toyota", "honda", "nissan",
];

/** Returns why a password is too weak, or null when it is strong enough. */
export function passwordProblem(password: string, email?: string | null): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  if (!/[a-z]/.test(password)) return "Add at least one lower-case letter.";
  if (!/[A-Z]/.test(password)) return "Add at least one upper-case letter.";
  if (!/[0-9]/.test(password)) return "Add at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one symbol, like ! @ # or ?.";
  if (/(.)\1{3,}/.test(password)) return "Don't repeat the same character 4 or more times in a row.";
  const lower = password.toLowerCase();
  const name = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
  if (name.length >= 4 && lower.includes(name)) return "Don't include your email name in your password.";
  if (COMMON.some((w) => lower.includes(w))) return "That password is too easy to guess. Avoid common words and names.";
  return null;
}

/** Zod version of the same rule, for server-side checks. */
export const strongPasswordSchema = z.string().max(PASSWORD_MAX).superRefine((pw, ctx) => {
  const problem = passwordProblem(pw);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});
