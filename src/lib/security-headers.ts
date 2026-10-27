/**
 * Browser security headers added to every page the site serves.
 *
 * - Strict-Transport-Security: browsers only ever talk to the site over encrypted HTTPS
 *   (TLS), for two years, including subdomains.
 * - Content-Security-Policy (safe subset): no plugins, no <base> hijacking, forms only post
 *   to this site, any http:// link is upgraded to https://, and only this site and the
 *   Lovable editor may show it inside a frame (blocks click-jacking).
 * - nosniff, a strict referrer and switched-off camera/mic/location/payment APIs.
 */
const FRAME_ANCESTORS = "'self' https://lovable.dev https://*.lovable.dev";

export const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    `frame-ancestors ${FRAME_ANCESTORS}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "X-Permitted-Cross-Domain-Policies": "none",
};

/** Returns the response with the security headers added (keeps any header the app already set). */
export function withSecurityHeaders(response: Response): Response {
  if (response.status < 200) return response;
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  // Pages showing account data must never be stored in shared caches.
  if ((headers.get("content-type") ?? "").includes("text/html") && !headers.has("Cache-Control")) {
    headers.set("Cache-Control", "private, no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
