// Server only: never imported by browser code.
//
// The staff sign-up access password is NOT stored in the code (this repository is public).
// Preferred: set a secret named STAFF_SIGNUP_PASSWORD in Lovable (Cloud → Secrets) or on the server.
// Fallback: a salted PBKDF2-SHA256 hash (100,000 rounds) of the current access password, so the
// password itself can't be read from the code.
const FALLBACK = {
  salt: "hpgodXestSh0FG9SEEikQw==",
  iterations: 100_000,
  hash: "Ce8PLFNDD99qjjaYj3I5SyMF8TA4m+78Qk+qvKZ1xYM=",
};

const enc = new TextEncoder();
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

async function sha256(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** The password the owner set in Settings (stored as a bcrypt hash). null = none set, or the database can't be asked. */
async function checkOwnerSetPassword(input: string): Promise<boolean | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("verify_staff_access", { _input: input });
    if (error) return null;
    return typeof data === "boolean" ? data : null;
  } catch {
    return null;
  }
}

/** Check of the staff sign-up access password. The owner's Settings password wins; then the secret; then the built-in hash. */
export async function isValidStaffAccess(input: string) {
  const ownerSet = await checkOwnerSetPassword(input);
  if (ownerSet !== null) return ownerSet;
  const secret = process.env["STAFF_SIGNUP_PASSWORD"];
  if (secret) {
    const [a, b] = await Promise.all([sha256(input), sha256(secret)]);
    return sameBytes(a, b);
  }
  const derived = await pbkdf2(input, fromB64(FALLBACK.salt), FALLBACK.iterations);
  return sameBytes(derived, fromB64(FALLBACK.hash));
}
