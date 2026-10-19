import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_EMAIL, isOwnerEmail, isPrimaryOwnerEmail } from "@/config/staff";

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

type OwnerLevel = "primary" | "co" | null;

/** "primary" for taaham01@gmail.com, "co" for a second owner, null otherwise. The email must be confirmed. */
async function ownerLevel(userId: string): Promise<OwnerLevel> {
  const admin = await getAdmin();
  const { data } = await admin.auth.admin.getUserById(userId);
  const u = data.user;
  if (!u?.email_confirmed_at) return null;
  return isPrimaryOwnerEmail(u.email) ? "primary" : isOwnerEmail(u.email) ? "co" : null;
}

async function isOwnerUser(userId: string) {
  return (await ownerLevel(userId)) !== null;
}

/** Any owner (primary or second). */
async function assertOwner(ctx: { userId: string }) {
  if (!(await isOwnerUser(ctx.userId))) throw new Error("Only an owner account can do this.");
}

async function rolesOf(userId: string): Promise<Role[]> {
  const admin = await getAdmin();
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as Role);
}

/**
 * Rules for changing someone else's account: the primary owner can never be touched; a second owner only by the primary owner;
 * Super Admins only by an owner.
 */
async function assertCanManage(ctx: { userId: string }, targetId: string) {
  if (targetId === ctx.userId) throw new Error("You cannot change your own access here.");
  const target = await ownerLevel(targetId);
  if (target === "primary") throw new Error("The main owner account cannot be changed.");
  if (target === "co" && (await ownerLevel(ctx.userId)) !== "primary") throw new Error("Only the main owner can change another owner.");
  if ((await rolesOf(targetId)).includes("super_admin")) await assertOwner(ctx);
}

async function log(actorId: string | null, actorEmail: string | null, action: string, entityId: string, details: Record<string, unknown>) {
  const admin = await getAdmin();
  await admin.from("admin_activity").insert({ actor_id: actorId, actor_email: actorEmail, action, entity: "admin", entity_id: entityId, details: details as never });
}

const actorEmail = (claims: unknown) => ((claims as { email?: string })?.email ?? null);

async function requestOrigin() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const fwdHost = req.headers.get("x-forwarded-host");
  if (fwdHost) return `${req.headers.get("x-forwarded-proto") ?? "https"}://${fwdHost}`;
  return new URL(req.url).origin;
}

async function checkAccess(access: string) {
  const { isValidStaffAccess } = await import("@/lib/staff-access.server");
  if (!(await isValidStaffAccess(access))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    throw new Error("Incorrect access password.");
  }
}

type StaffRequest = { role: Role; status: "pending" | "approved"; requested_at: string };
const BAN_FOREVER = "876000h";

/* ───────────── Staff sign-up (password-protected, approved by the owner) ───────────── */

/** Public: checks the access password that unlocks the staff sign-up screen. */
export const checkStaffAccess = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ access: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    await checkAccess(data.access);
    return { ok: true };
  });

/**
 * Public, needs the access password. The owner email gets a confirmation email and becomes the owner Super Admin once confirmed.
 * Anyone else gets a locked account that the owner must approve; the owner is emailed a sign-in link to review it.
 */
export const requestStaffSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ access: z.string().max(200), email: emailSchema, password: passwordSchema, role: roleSchema }).parse(d))
  .handler(async ({ data }) => {
    await checkAccess(data.access);
    const origin = await requestOrigin();
    const { publicClient } = await import("@/lib/supabase-public.server");

    if (isOwnerEmail(data.email)) {
      const { data: res, error } = await publicClient().auth.signUp({ email: data.email, password: data.password, options: { emailRedirectTo: `${origin}/admin/login` } });
      if (error) throw new Error(error.message);
      // Supabase hides existing accounts by returning a user with no identities.
      if (!res.user || (res.user.identities?.length ?? 0) === 0) throw new Error("The owner account already exists. Sign in on the staff sign-in page.");
      return { kind: "owner_confirm" as const };
    }

    const admin = await getAdmin();
    const request: StaffRequest = { role: data.role, status: "pending", requested_at: new Date().toISOString() };
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true, ban_duration: BAN_FOREVER,
      app_metadata: { staff_request: request },
    });
    if (error || !created.user) throw new Error(error?.message?.toLowerCase().includes("already") ? "An account with this email already exists." : (error?.message ?? "Could not create the account."));
    await log(created.user.id, data.email, "staff.signup_requested", created.user.id, { email: data.email, role: data.role });

    // Email the owner a sign-in link that opens the approvals list. Requests also show on the Staff page, so a failed email is not fatal.
    let notified = true;
    const { error: mailErr } = await publicClient().auth.signInWithOtp({
      email: OWNER_EMAIL,
      options: { shouldCreateUser: false, emailRedirectTo: `${origin}/admin/login?redirect=${encodeURIComponent("/admin/admins")}` },
    });
    if (mailErr) notified = false;
    return { kind: "pending" as const, notified };
  });

/** Signed-in owner: makes sure the owner account holds the Super Admin role (run after sign-in). */
export const claimOwnerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isOwnerUser(context.userId))) return { owner: false };
    const admin = await getAdmin();
    if (!(await rolesOf(context.userId)).includes("super_admin")) {
      await admin.from("user_roles").insert({ user_id: context.userId, role: "super_admin" });
      await log(context.userId, actorEmail(context.claims), "owner.claimed", context.userId, { role: "super_admin" });
    }
    return { owner: true };
  });

/** Owner: staff sign-ups waiting for approval. */
export const listStaffRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const admin = await getAdmin();
    const out: { id: string; email: string; role: Role; requestedAt: string }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not load sign-up requests.");
      for (const u of data.users) {
        const r = (u.app_metadata as { staff_request?: StaffRequest })?.staff_request;
        if (r?.status === "pending") out.push({ id: u.id, email: u.email ?? "(unknown)", role: r.role, requestedAt: r.requested_at });
      }
      if (data.users.length < 1000) break;
    }
    return out.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  });

/** Owner: approve (unlock + give the requested role) or reject (delete the account) a staff sign-up. */
export const decideStaffRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const admin = await getAdmin();
    const { data: found } = await admin.auth.admin.getUserById(data.userId);
    const u = found.user;
    const req = (u?.app_metadata as { staff_request?: StaffRequest })?.staff_request;
    if (!u || req?.status !== "pending") throw new Error("This request is no longer pending.");
    if (!data.approve) {
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) throw new Error("Could not reject the request.");
      await log(context.userId, actorEmail(context.claims), "staff.signup_rejected", u.id, { email: u.email, role: req.role });
      return { ok: true };
    }
    const { error: rErr } = await admin.from("user_roles").upsert({ user_id: u.id, role: req.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (rErr) throw new Error("Could not assign the role.");
    const { error } = await admin.auth.admin.updateUserById(u.id, { ban_duration: "none", app_metadata: { ...u.app_metadata, staff_request: { ...req, status: "approved" } } });
    if (error) throw new Error("Role given, but the account could not be unlocked.");
    await log(context.userId, actorEmail(context.claims), "staff.signup_approved", u.id, { email: u.email, role: req.role });
    return { ok: true };
  });

/* ───────────── Managing existing staff ───────────── */

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
      const isOwner = !!u?.email_confirmed_at && isOwnerEmail(u?.email);
      const isPrimaryOwner = isOwner && isPrimaryOwnerEmail(u?.email);
      return { id, email: u?.email ?? "(unknown)", roles: rs, active: !banned, lastSignIn: u?.last_sign_in_at ?? null, isSelf: id === context.userId, isOwner, isPrimaryOwner };
    }));
    return out.sort((a, b) => Number(b.isPrimaryOwner) - Number(a.isPrimaryOwner) || Number(b.isOwner) - Number(a.isOwner) || a.email.localeCompare(b.email));
  });

/** Super Admins can create Admins; only the owner can create Super Admins. */
export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: emailSchema, password: passwordSchema, role: roleSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    if (data.role === "super_admin") await assertOwner(context);
    if (isOwnerEmail(data.email)) throw new Error("The owner account is set up from the staff sign-up page.");
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
    await assertCanManage(context, data.userId);
    if (data.role === "super_admin") await assertOwner(context);
    const admin = await getAdmin();
    const { error } = data.grant
      ? await admin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true })
      : await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
    if (error) throw new Error("Could not update the role.");
    await log(context.userId, actorEmail(context.claims), data.grant ? "admin.role_granted" : "admin.role_revoked", data.userId, { role: data.role });
    return { ok: true };
  });

/** Takes away all staff access. Admins: any Super Admin. Super Admins: owner only. The owner can never be removed. */
export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    await assertCanManage(context, data.userId);
    const admin = await getAdmin();
    const { error } = await admin.from("user_roles").delete().eq("user_id", data.userId);
    if (error) throw new Error("Could not remove this staff member.");
    await admin.from("staff_permissions").delete().eq("user_id", data.userId);
    await log(context.userId, actorEmail(context.claims), "admin.removed", data.userId, {});
    return { ok: true };
  });

export const setAdminActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    await assertCanManage(context, data.userId);
    const admin = await getAdmin();
    const { error } = await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : BAN_FOREVER });
    if (error) throw new Error("Could not update the account.");
    await log(context.userId, actorEmail(context.claims), data.active ? "admin.reactivated" : "admin.deactivated", data.userId, {});
    return { ok: true };
  });

/** Owners only: permanently delete any account (staff or customer) and its bookings. The main owner can never be deleted. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    await assertCanManage(context, data.userId);
    const admin = await getAdmin();
    const { data: found } = await admin.auth.admin.getUserById(data.userId);
    await admin.from("bookings").delete().eq("user_id", data.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Could not delete the account.");
    await log(context.userId, actorEmail(context.claims), "account.deleted", data.userId, { email: found.user?.email ?? null });
    return { ok: true };
  });

const permSchema = z.object({ can_publish: z.boolean(), can_manage_bookings: z.boolean(), can_view_customers: z.boolean() });

export const listStaffPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuper(context);
    const { data } = await context.supabase.from("staff_permissions").select("*");
    return data ?? [];
  });

export const setStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), perms: permSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const admin = await getAdmin();
    const { error } = await admin.from("staff_permissions").upsert({ user_id: data.userId, ...data.perms, updated_at: new Date().toISOString() });
    if (error) throw new Error("Could not save permissions.");
    await log(context.userId, actorEmail(context.claims), "admin.permissions_changed", data.userId, data.perms);
    return { ok: true };
  });

/** Customers = accounts with a profile and no staff role. Needs Super Admin or "view customers" permission. Phone numbers are returned for Super Admins only. */
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await context.supabase.rpc("has_perm", { _user_id: context.userId, _perm: "customers" });
    if (!ok) throw new Error("You do not have permission to view customers.");
    // Phone numbers are not selectable through the API; only Super Admins can fetch them (via get_customer_phones).
    const { data: profiles } = await context.supabase.from("profiles")
      .select("id, full_name, country, phone_verified, customer_number, created_at, updated_at")
      .order("created_at", { ascending: false });
    const admin = await getAdmin();
    const { data: roles } = await admin.from("user_roles").select("user_id");
    const staff = new Set((roles ?? []).map((r) => r.user_id));
    const rows = (profiles ?? []).filter((p) => !staff.has(p.id));
    const { data: isSuper } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    const { data: phones } = isSuper && rows.length
      ? await context.supabase.rpc("get_customer_phones", { _user_ids: rows.map((r) => r.id) })
      : { data: [] as { user_id: string; phone: string }[] };
    const phoneById = new Map((phones ?? []).map((x) => [x.user_id, x.phone]));
    return Promise.all(rows.map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id);
      const u = data.user;
      return { ...p, phone: phoneById.get(p.id) ?? null, email: u?.email ?? "", active: !(u?.banned_until && new Date(u.banned_until) > new Date()) };
    }));
  });

/** Super Admin: suspend/reactivate a customer, or manually mark their phone verified. */
export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean().optional(), phoneVerified: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuper(context);
    const admin = await getAdmin();
    const { count } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("user_id", data.userId);
    if ((count ?? 0) > 0) throw new Error("Use Manage staff for staff accounts.");
    if (data.active !== undefined) {
      const { error } = await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.active ? "none" : "876000h" });
      if (error) throw new Error("Could not update the account.");
    }
    if (data.phoneVerified !== undefined) await admin.from("profiles").update({ phone_verified: data.phoneVerified }).eq("id", data.userId);
    await log(context.userId, actorEmail(context.claims), "customer.updated", data.userId, data);
    return { ok: true };
  });
