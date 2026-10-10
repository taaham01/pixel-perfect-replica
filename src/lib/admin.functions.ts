import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "super_admin" | "inventory_manager";
const roleSchema = z.enum(["super_admin", "inventory_manager"]);
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(10, "Password must be at least 10 characters").max(128);

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertSuper(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  if (error || !data) throw new Error("Only a Super Admin can do this.");
}

async function log(actorId: string | null, actorEmail: string | null, action: string, entityId: string, details: Record<string, unknown>) {
  const admin = await getAdmin();
  await admin.from("admin_activity").insert({ actor_id: actorId, actor_email: actorEmail, action, entity: "admin", entity_id: entityId, details: details as never });
}

const actorEmail = (claims: unknown) => ((claims as { email?: string })?.email ?? null);

/** Public: tells the setup page whether a first Super Admin still needs creating. Returns only a boolean. */
export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await getAdmin();
  const { count } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
  return { needsSetup: (count ?? 0) === 0 };
});

/** Public, one-time: only works while no Super Admin exists. */
export const createFirstSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: emailSchema, password: passwordSchema }).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { count } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) > 0) throw new Error("Setup is already complete. Please sign in.");
    const { data: created, error } = await admin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create the account.");
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: created.user.id, role: "super_admin" });
    if (rErr) throw new Error("Account created but role assignment failed.");
    await log(created.user.id, data.email, "admin.setup", created.user.id, { role: "super_admin" });
    return { ok: true };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const admin = await getAdmin();
    const { data: roles } = await admin.from("user_roles").select("user_id, role");
    const byUser = new Map<string, Role[]>();
    for (const r of roles ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
    const out = await Promise.all([...byUser.entries()].map(async ([id, rs]) => {
      const { data } = await admin.auth.admin.getUserById(id);
      const u = data.user;
      const banned = !!u?.banned_until && new Date(u.banned_until) > new Date();
      return { id, email: u?.email ?? "(unknown)", roles: rs, active: !banned, lastSignIn: u?.last_sign_in_at ?? null, isSelf: id === context.userId };
    }));
    return out.sort((a, b) => a.email.localeCompare(b.email));
  });

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: emailSchema, password: passwordSchema, role: roleSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const admin = await getAdmin();
    const { data: created, error } = await admin.auth.admin.createUser({ email: data.email, password: data.password, email_confirm: true });
    if (error || !created.user) throw new Error(error?.message?.includes("already") ? "An account with this email already exists." : (error?.message ?? "Could not create the account."));
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (rErr) throw new Error("Account created but role assignment failed.");
    await log(context.userId, actorEmail(context.claims), "admin.created", created.user.id, { email: data.email, role: data.role });
    return { ok: true };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: roleSchema, grant: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    if (!data.grant && data.userId === context.userId && data.role === "super_admin") throw new Error("You cannot remove your own Super Admin role.");
    const admin = await getAdmin();
    const { error } = data.grant
      ? await admin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true })
      : await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    if (error) throw new Error("Could not update the role.");
    await log(context.userId, actorEmail(context.claims), data.grant ? "admin.role_granted" : "admin.role_revoked", data.userId, { role: data.role });
    return { ok: true };
  });

export const setAdminActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    if (data.userId === context.userId) throw new Error("You cannot deactivate your own account.");
    const admin = await getAdmin();
    const { error } = await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
    if (error) throw new Error("Could not update the account.");
    await log(context.userId, actorEmail(context.claims), data.active ? "admin.reactivated" : "admin.deactivated", data.userId, {});
    return { ok: true };
  });
