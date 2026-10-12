import { useRouteContext } from "@tanstack/react-router";

/** The signed-in staff member (id, email, roles, permissions) resolved by the admin route gate. */
export function useAdmin() {
  return useRouteContext({ from: "/_authenticated/admin" }).admin;
}
