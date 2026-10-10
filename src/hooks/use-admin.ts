import { useRouteContext } from "@tanstack/react-router";

/** The signed-in admin (id, email, roles) resolved by the protected route gate. */
export function useAdmin() {
  return useRouteContext({ from: "/_authenticated" }).admin;
}
