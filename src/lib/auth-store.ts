import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * One shared view of "who is signed in" for the whole site.
 *
 * Why: asking Supabase for the session can hang for a long time when a saved login has expired
 * and the login server is slow to refresh it. Before, every navbar menu, car card and server
 * request waited on that, so links froze and "Sign In" never appeared. Now every wait is capped,
 * and the site carries on as signed-out until the session arrives.
 */
const SESSION_TIMEOUT_MS = 3000;

type AuthState = { ready: boolean; user: User | null };
let state: AuthState = { ready: false, user: null };
const listeners = new Set<() => void>();
let started = false;

function emit(next: AuthState) {
  if (next.ready === state.ready && next.user === state.user) return;
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => emit({ ready: true, user: session?.user ?? null }));
  // If Supabase hasn't answered in time, show the site as signed out instead of waiting forever.
  window.setTimeout(() => { if (!state.ready) emit({ ready: true, user: null }); }, SESSION_TIMEOUT_MS);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const serverState: AuthState = { ready: false, user: null };

/** The signed-in user, shared by every component (one Supabase listener for the whole page). */
export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => serverState);
}

/** The current session, but never waits more than `ms` (returns null if Supabase is slow). */
export async function getSessionFast(ms = SESSION_TIMEOUT_MS): Promise<Session | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); });
  try {
    const result = await Promise.race([
      supabase.auth.getSession().then(({ data }) => data.session).catch(() => null),
      timeout,
    ]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
