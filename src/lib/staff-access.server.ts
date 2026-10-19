// Server only: never imported by browser code, so the access password is not shipped to visitors.

/** Password that unlocks the staff sign-up screen. Can be overridden with the STAFF_SIGNUP_PASSWORD environment variable. */
const STAFF_SIGNUP_PASSWORD = process.env["STAFF_SIGNUP_PASSWORD"] || "Cbe13mfc1221!";

async function digest(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}

/** Constant-time check of the staff sign-up access password. */
export async function isValidStaffAccess(input: string) {
  const [a, b] = await Promise.all([digest(input), digest(STAFF_SIGNUP_PASSWORD)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
