"use server";

import { revalidatePath } from "next/cache";
import { createHubClient } from "@/lib/supabase/admin";
import { APPS, isRole, SITES, type AppKey, type SiteKey } from "./apps";
import { getPerson, isAppAdmin, type Person } from "./access";
import { forgetSites } from "./sites";
import { logActivity } from "./log";

// People, per-app access and public-site switches. Every action re-checks the
// caller: a super admin can do anything here; an app's admin/owner can add
// people and grant roles in their own app only.

export type Result = { ok: true } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const deny = (error = "You don't have access to do that."): Result => ({ ok: false, error });

function adminApps(p: Person): AppKey[] {
  return (Object.keys(APPS) as AppKey[]).filter((a) => isAppAdmin(p, a));
}

async function target(email: string) {
  const hub = createHubClient();
  const [{ data: person }, { data: access }] = await Promise.all([
    hub.from("people").select("email, name, super_admin, active").eq("email", email).maybeSingle(),
    hub.from("access").select("app, role").eq("email", email),
  ]);
  return { person, apps: (access ?? []).map((a) => a.app as AppKey) };
}

/** May the actor manage this person's sign-in (password)? Only if every app they use is one the actor runs. */
async function mayManageLogin(actor: Person, email: string): Promise<boolean> {
  if (actor.isSuper) return true;
  const t = await target(email);
  if (t.person?.super_admin) return false;
  const mine = new Set(adminApps(actor));
  return t.apps.every((a) => mine.has(a));
}

async function authUserId(email: string): Promise<string | null> {
  const admin = createHubClient().auth.admin;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function setPassword(email: string, password: string): Promise<string | null> {
  const admin = createHubClient().auth.admin;
  const id = await authUserId(email);
  const res = id ? await admin.updateUserById(id, { password }) : await admin.createUser({ email, password, email_confirm: true });
  return res.error ? res.error.message : null;
}

function done(): Result {
  revalidatePath("/admin/people");
  revalidatePath("/admin");
  return { ok: true };
}

/** Add someone (or update their name). Optionally sets their password and first app role. */
export async function addPerson(input: { email: string; name: string; password?: string; app?: AppKey; role?: string }): Promise<Result> {
  const actor = await getPerson();
  if (!actor || (!actor.isSuper && !adminApps(actor).length)) return deny();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 80);
  if (!EMAIL.test(email)) return deny("Enter a valid email address.");
  if (input.app && (!isRole(input.app, input.role) || !isAppAdmin(actor, input.app))) return deny("Pick a role in an app you manage.");
  if (input.password && input.password.length < 8) return deny("Passwords need at least 8 characters.");
  const hub = createHubClient();
  const existing = (await target(email)).person;
  if (existing && !existing.active && !actor.isSuper) return deny("This person was removed. Ask the super admin to restore them.");
  if (input.password && existing && !(await mayManageLogin(actor, email)))
    return deny("Only the super admin can change this person's password.");
  if (!existing) {
    const { error } = await hub.from("people").insert({ email, name, created_by: actor.email });
    if (error) return deny("That didn't save. Try again.");
    await logActivity({ actor: actor.email, app: "hub", action: "person.add", target: email, detail: { name } });
  } else if (name && (actor.isSuper || !existing.name)) {
    await hub.from("people").update({ name }).eq("email", email);
  }
  if (input.password) {
    const err = await setPassword(email, input.password);
    if (err) return deny("The sign-in couldn't be saved: " + err);
    await logActivity({ actor: actor.email, app: "hub", action: "password.set", target: email });
  }
  if (input.app && input.role) {
    const { error } = await hub.from("access").upsert({ email, app: input.app, role: input.role, granted_by: actor.email, granted_at: new Date().toISOString() }, { onConflict: "email,app" });
    if (error) return deny("That didn't save. Try again.");
    await logActivity({ actor: actor.email, app: input.app, action: "access.grant", target: email, detail: { role: input.role } });
  }
  return done();
}

/** Grant, change or remove (role null) someone's role in one app. */
export async function setAccess(email: string, app: AppKey, role: string | null): Promise<Result> {
  const actor = await getPerson();
  if (!actor || !(app in APPS) || !isAppAdmin(actor, app)) return deny();
  email = email.trim().toLowerCase();
  if (email === actor.email && !actor.isSuper) return deny("You can't change your own access. Ask the super admin.");
  if (role !== null && !isRole(app, role)) return deny("Pick a role.");
  const t = await target(email);
  if (!t.person) return deny("Add this person first.");
  if (t.person.super_admin && !actor.isSuper) return deny("Only the super admin can change a super admin's access.");
  const hub = createHubClient();
  const { data: before } = await hub.from("access").select("role").eq("email", email).eq("app", app).maybeSingle();
  const { error } = role === null
    ? await hub.from("access").delete().eq("email", email).eq("app", app)
    : await hub.from("access").upsert({ email, app, role, granted_by: actor.email, granted_at: new Date().toISOString() }, { onConflict: "email,app" });
  if (error) return deny("That didn't save. Try again.");
  await logActivity({
    actor: actor.email,
    app,
    action: role === null ? "access.remove" : before ? "access.change" : "access.grant",
    target: email,
    detail: { role, from: before?.role ?? null },
  });
  return done();
}

/** Set a new password for someone (e.g. they forgot theirs). */
export async function resetPassword(email: string, password: string): Promise<Result> {
  const actor = await getPerson();
  if (!actor) return deny();
  email = email.trim().toLowerCase();
  if (password.length < 8) return deny("Passwords need at least 8 characters.");
  if (!(await target(email)).person) return deny("Add this person first.");
  if (!(await mayManageLogin(actor, email))) return deny("Only the super admin can change this person's password.");
  const err = await setPassword(email, password);
  if (err) return deny("The password couldn't be saved: " + err);
  await logActivity({ actor: actor.email, app: "hub", action: "password.set", target: email });
  return done();
}

/** Super admin only: make someone a super admin, or remove / restore them everywhere. */
export async function setPersonFlags(email: string, flags: { superAdmin?: boolean; active?: boolean }): Promise<Result> {
  const actor = await getPerson();
  if (!actor?.isSuper) return deny();
  email = email.trim().toLowerCase();
  if (email === actor.email && (flags.superAdmin === false || flags.active === false))
    return deny("You can't remove your own super admin access.");
  const patch: Record<string, boolean> = {};
  if (flags.superAdmin !== undefined) patch.super_admin = flags.superAdmin;
  if (flags.active !== undefined) patch.active = flags.active;
  const { error } = await createHubClient().from("people").update(patch).eq("email", email);
  if (error) return deny("That didn't save. Try again.");
  if (flags.superAdmin !== undefined)
    await logActivity({ actor: actor.email, app: "hub", action: flags.superAdmin ? "super.grant" : "super.remove", target: email });
  if (flags.active !== undefined)
    await logActivity({ actor: actor.email, app: "hub", action: flags.active ? "person.restore" : "person.remove", target: email });
  return done();
}

/** Super admin only: switch a public site on or off. */
export async function setSiteEnabled(key: SiteKey, enabled: boolean): Promise<Result> {
  const actor = await getPerson();
  if (!actor?.isSuper) return deny();
  if (!(key in SITES)) return deny("Unknown site.");
  const { error } = await createHubClient()
    .from("sites")
    .update({ enabled, updated_by: actor.email, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) return deny("That didn't save. Try again.");
  forgetSites();
  await logActivity({ actor: actor.email, app: "sites", action: enabled ? "site.on" : "site.off", target: key });
  return done();
}
