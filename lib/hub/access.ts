import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createHubClient } from "@/lib/supabase/admin";
import { APPS, isRole, topRole, type AppKey, type AppRole } from "./apps";

// ===========================================================================
// Who can use which app.
//
// Everyone signs in once with Supabase Auth. What they can open is granted per
// app in hub.access (see supabase/migration-hub-access.sql):
//   events : admin | manager      caddie : admin | staff      merch : owner | staff | viewer
// A super admin (hub.people.super_admin) has every app at its top role.
//
// Pages call requireApp(); server actions and API routes call assertApp().
// Never trust the page alone — server actions are public endpoints.
// ===========================================================================

export interface Person {
  email: string;
  name: string;
  isSuper: boolean;
  /** Explicit grants. Use roleIn() — it also accounts for super admins. */
  grants: Partial<Record<AppKey, string>>;
}

export class AccessError extends Error {
  constructor(message = "You don't have access to do that.") {
    super(message);
  }
}

/** Email of whoever is signed in to Supabase Auth, or null. */
export const signedInEmail = cache(async (): Promise<string | null> => {
  try {
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    return user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
});

/** The signed-in person and their grants, or null (signed out, unknown or removed). One lookup per request. */
export const getPerson = cache(async (): Promise<Person | null> => {
  const email = await signedInEmail();
  if (!email) return null;
  const hub = createHubClient();
  const [{ data: p }, { data: rows }] = await Promise.all([
    hub.from("people").select("email, name, super_admin, active").eq("email", email).maybeSingle(),
    hub.from("access").select("app, role").eq("email", email),
  ]);
  if (!p || !p.active) return null;
  const grants: Person["grants"] = {};
  for (const r of rows ?? []) if (r.app in APPS && isRole(r.app as AppKey, r.role)) grants[r.app as AppKey] = r.role;
  return { email: p.email, name: p.name, isSuper: !!p.super_admin, grants };
});

/** The person's role in an app (a super admin gets the top role), or null. */
export function roleIn<A extends AppKey>(p: Person | null, app: A): AppRole<A> | null {
  if (!p) return null;
  if (p.isSuper) return topRole(app);
  const r = p.grants[app];
  return r && isRole(app, r) ? r : null;
}

export function hasApp<A extends AppKey>(p: Person | null, app: A, allowed?: readonly AppRole<A>[]): boolean {
  const r = roleIn(p, app);
  return !!r && (!allowed || allowed.includes(r));
}

/** Runs the app: its top role, or super admin. Can manage the app's people. */
export function isAppAdmin(p: Person | null, app: AppKey): boolean {
  return roleIn(p, app) === topRole(app);
}

/** For pages: signed-out people go to sign in; people without the role go to the dashboard. */
export async function requireApp<A extends AppKey>(app: A, allowed?: readonly AppRole<A>[]): Promise<Person> {
  const p = await getPerson();
  if (!p) redirect((await signedInEmail()) ? `/admin?denied=${app}` : "/login");
  if (!hasApp(p, app, allowed)) redirect(`/admin?denied=${app}`);
  return p;
}

/** For server actions and API routes: throws AccessError unless the role is held. */
export async function assertApp<A extends AppKey>(app: A, allowed?: readonly AppRole<A>[]): Promise<Person> {
  const p = await getPerson();
  if (!hasApp(p, app, allowed)) throw new AccessError();
  return p!;
}

export async function requireSuper(): Promise<Person> {
  const p = await getPerson();
  if (!p) redirect("/login");
  if (!p.isSuper) redirect("/admin?denied=super");
  return p;
}
