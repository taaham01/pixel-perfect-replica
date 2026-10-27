import { createMiddleware } from "@tanstack/react-start";
import { getSessionFast } from "./auth-store";

/**
 * Adds the signed-in user's token to server requests. Same job as the generated
 * attachSupabaseAuth, but it never blocks: if the session can't be read quickly the request
 * goes out without a token, so public pages (Vehicles, Sold Cars) still load.
 */
export const attachSupabaseAuthFast = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const session = typeof window === "undefined" ? null : await getSessionFast();
  const token = session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
