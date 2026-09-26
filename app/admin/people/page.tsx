import Link from "next/link";
import { redirect } from "next/navigation";
import { createHubClient } from "@/lib/supabase/admin";
import { getPerson, isAppAdmin } from "@/lib/hub/access";
import { APP_KEYS, type AppKey } from "@/lib/hub/apps";
import PeopleManager, { type PersonRow } from "@/components/hub/PeopleManager";

export const dynamic = "force-dynamic";

// Who can use which app. The super admin manages everyone and every app; an
// app's admin/owner manages that app's column only.
export default async function PeoplePage() {
  const me = await getPerson();
  if (!me) redirect("/login");
  const apps: AppKey[] = APP_KEYS.filter((a) => isAppAdmin(me, a));
  if (!me.isSuper && !apps.length) redirect("/admin?denied=people");

  const hub = createHubClient();
  const [{ data: people, error: e1 }, { data: access, error: e2 }] = await Promise.all([
    hub.from("people").select("email, name, super_admin, active").order("name"),
    hub.from("access").select("email, app, role"),
  ]);
  // Without the grants we can't tell whose people are whose, so show nothing rather than everyone.
  if (e1 || e2) throw new Error("Couldn't load people and access. Reload the page to try again.");
  const grants = new Map<string, Record<string, string>>();
  for (const a of access ?? []) grants.set(a.email, { ...(grants.get(a.email) ?? {}), [a.app]: a.role });
  let rows: PersonRow[] = (people ?? []).map((p) => ({
    email: p.email,
    name: p.name,
    isSuper: p.super_admin,
    active: p.active,
    grants: grants.get(p.email) ?? {},
  }));
  // App admins see the people in their apps (and anyone not yet in any app, so they can add them).
  // An app admin sees only the apps they run: other apps' roles aren't sent to the page.
  if (!me.isSuper)
    rows = rows
      .filter((r) => r.active && (apps.some((a) => r.grants[a]) || !Object.keys(r.grants).length) && !r.isSuper)
      .map((r) => ({ ...r, grants: Object.fromEntries(apps.filter((a) => r.grants[a]).map((a) => [a, r.grants[a]])) }));

  return (
    <>
      <div className="appbar">
        <div className="appbar-inner">
          <Link href="/admin" className="brand">
            <span className="mark">P</span> Pasatiempo Admin
          </Link>
          <span className="spacer" />
          <Link href="/admin" className="navlink">
            Dashboard
          </Link>
          <span className="navlink">{me.email}</span>
        </div>
      </div>
      <main className="container">
        <div className="page-head">
          <div>
            <h1>People &amp; access</h1>
            <div className="sub">
              {me.isSuper
                ? "Everyone signs in once. Give each person a role in the apps they use; leave the rest blank."
                : "Add people to the apps you run and set their role."}
            </div>
          </div>
        </div>
        <PeopleManager me={me.email} isSuper={me.isSuper} apps={me.isSuper ? APP_KEYS : apps} rows={rows} />
      </main>
    </>
  );
}
