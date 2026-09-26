import Link from "next/link";
import { createAdminClient, createHubClient } from "@/lib/supabase/admin";
import { getPerson, hasApp, isAppAdmin, roleIn, signedInEmail } from "@/lib/hub/access";
import { APPS, type AppKey, type SiteKey } from "@/lib/hub/apps";
import SiteSwitch from "@/components/hub/SiteSwitch";

// Staff dashboard — one home for every Pasatiempo app. The proxy makes sure
// someone is signed in; each row below appears only for people with access to
// that app (lib/hub/access.ts). The super admin also sees the public-site
// switches and People & access.
export const dynamic = "force-dynamic";

async function eventsStats() {
  try {
    const s = createAdminClient("events");
    const [{ count: events }, { count: regs }] = await Promise.all([
      s.from("events").select("*", { count: "exact", head: true }),
      s.from("registrations").select("*", { count: "exact", head: true }),
    ]);
    return { events: events ?? 0, regs: regs ?? 0, ok: true };
  } catch {
    return { events: 0, regs: 0, ok: false };
  }
}

async function mhiStats() {
  try {
    const s = createAdminClient("mhi");
    const [{ count: teams }, { count: players }] = await Promise.all([
      s.from("teams").select("*", { count: "exact", head: true }),
      s.from("team_players").select("*", { count: "exact", head: true }),
    ]);
    return { teams: teams ?? 0, players: players ?? 0, ok: true };
  } catch {
    return { teams: 0, players: 0, ok: false };
  }
}

async function caddieStats() {
  try {
    const s = createAdminClient("caddie");
    const [{ count: caddies }, { count: open }] = await Promise.all([
      s
        .from("caddies")
        .select("*", { count: "exact", head: true })
        .eq("status", "Active"),
      s
        .from("loops")
        .select("*", { count: "exact", head: true })
        .in("status", ["Unassigned", "Partially Assigned"]),
    ]);
    return { caddies: caddies ?? 0, open: open ?? 0, ok: true };
  } catch {
    return { caddies: 0, open: 0, ok: false };
  }
}

async function siteSwitches(): Promise<Record<string, boolean>> {
  const { data } = await createHubClient().from("sites").select("key, enabled");
  return Object.fromEntries((data ?? []).map((s) => [s.key, s.enabled]));
}

const DENIED: Record<string, string> = {
  events: "You don't have access to the Event Planner.",
  caddie: "You don't have access to the Caddie Program.",
  merch: "You don't have access to the Merchandise Program.",
  super: "That page is for the super admin.",
  people: "Managing people is for app admins.",
};

const ROLE_LABEL: Record<string, string> = { admin: "admin", manager: "manager", staff: "staff", owner: "owner", viewer: "viewer" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const person = await getPerson();
  const email = person?.email ?? (await signedInEmail());
  const see = (app: AppKey) => hasApp(person, app);
  const isSuper = !!person?.isSuper;
  const managesPeople = !!person && (isSuper || (Object.keys(APPS) as AppKey[]).some((a) => isAppAdmin(person, a)));

  const [ev, mhi, cad, sites] = await Promise.all([
    see("events") ? eventsStats() : null,
    isSuper ? mhiStats() : null,
    see("caddie") ? caddieStats() : null,
    isSuper ? siteSwitches() : Promise.resolve({} as Record<string, boolean>),
  ]);
  const role = (app: AppKey) => {
    const r = roleIn(person, app);
    return r ? <span className="badge gray">{isSuper ? "super admin" : ROLE_LABEL[r]}</span> : null;
  };
  const siteSwitch = (key: SiteKey) => (isSuper ? <SiteSwitch site={key} enabled={sites[key] !== false} /> : null);
  const nothing = !see("events") && !see("caddie") && !see("merch") && !isSuper;

  return (
    <>
      <div className="appbar">
        <div className="appbar-inner">
          <Link href="/admin" className="brand">
            <span className="mark">P</span> Pasatiempo Admin
          </Link>
          <span className="spacer" />
          {managesPeople && (
            <Link href="/admin/people" className="navlink">
              People &amp; access
            </Link>
          )}
          <span className="navlink">{email}</span>
          <form action="/auth/signout" method="post" style={{ margin: 0 }}>
            <button className="btn secondary small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <main className="container">
        <div className="page-head">
          <div>
            <h1>Dashboard</h1>
            <div className="sub">
              {isSuper ? "Super admin — every Pasatiempo app, the public sites, and who can use what." : "The Pasatiempo apps you have access to."}
            </div>
          </div>
        </div>

        {denied && DENIED[denied] && <div className="notice" style={{ marginBottom: 16 }}>{DENIED[denied]}</div>}
        {nothing && (
          <div className="notice" style={{ marginBottom: 16 }}>
            You&apos;re signed in, but no app has been shared with you yet. Ask the person who runs the app to add you.
          </div>
        )}

        <div className="evlist">
          {ev && (
            <div className="evrow">
              <div className="ev-main">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="ev-title">Event Planner</span>
                  {role("events")}
                </div>
                <div className="ev-meta">
                  <span>schema: events</span>
                  {!ev.ok && <span style={{ color: "var(--danger)" }}>⚠︎ unreachable</span>}
                </div>
              </div>
              <div className="ev-count">
                <div className="num">{ev.events}</div>
                <div className="lbl">events</div>
              </div>
              <div className="ev-count">
                <div className="num">{ev.regs}</div>
                <div className="lbl">signups</div>
              </div>
              {siteSwitch("events")}
              <Link href="/admin/events" className="btn secondary small">
                Manage
              </Link>
            </div>
          )}

          {cad && (
            <div className="evrow">
              <div className="ev-main">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="ev-title">Caddie Program</span>
                  {role("caddie")}
                </div>
                <div className="ev-meta">
                  <span>schema: caddie</span>
                  <span>caddies sign in separately at /caddie</span>
                  {!cad.ok && <span style={{ color: "var(--danger)" }}>⚠︎ unreachable</span>}
                </div>
              </div>
              <div className="ev-count">
                <div className="num">{cad.caddies}</div>
                <div className="lbl">caddies</div>
              </div>
              <div className="ev-count">
                <div className="num">{cad.open}</div>
                <div className="lbl">open loops</div>
              </div>
              <Link href="/admin/caddie" className="btn secondary small">
                Manage
              </Link>
            </div>
          )}

          {see("merch") && (
            <div className="evrow">
              <div className="ev-main">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="ev-title">Merchandise Program</span>
                  {role("merch")}
                </div>
                <div className="ev-meta">
                  <span>schema: merch</span>
                  <span>forecast, open-to-buy, orders, brand scorecard</span>
                </div>
              </div>
              <a href="/merch" className="btn secondary small">
                Open
              </a>
            </div>
          )}

          {mhi && (
            <div className="evrow">
              <div className="ev-main">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="ev-title">Marion Hollins Invitational</span>
                  <span className="badge gray">public site</span>
                </div>
                <div className="ev-meta">
                  <span>schema: mhi</span>
                  <span>roster edited in Supabase for now</span>
                  {!mhi.ok && <span style={{ color: "var(--danger)" }}>⚠︎ unreachable</span>}
                </div>
              </div>
              <div className="ev-count">
                <div className="num">{mhi.teams}</div>
                <div className="lbl">teams</div>
              </div>
              <div className="ev-count">
                <div className="num">{mhi.players}</div>
                <div className="lbl">players</div>
              </div>
              {siteSwitch("mhi")}
              <a href="/mhi" target="_blank" rel="noopener noreferrer" className="btn secondary small">
                View site ↗
              </a>
            </div>
          )}

          {isSuper && (
            <div className="evrow">
              <div className="ev-main">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="ev-title">El Sombrero</span>
                  <span className="badge gray">public site</span>
                </div>
                <div className="ev-meta">
                  <span>Men&apos;s Club info page</span>
                  <span>edited in code (app/sombrero)</span>
                </div>
              </div>
              {siteSwitch("sombrero")}
              <a href="/sombrero" target="_blank" rel="noopener noreferrer" className="btn secondary small">
                View site ↗
              </a>
            </div>
          )}
        </div>

        {isSuper && (
          <p className="muted" style={{ marginTop: 22, fontSize: 13 }}>
            A public site that&apos;s switched off shows visitors a &ldquo;not available&rdquo; page. You still see it, so you can check it before switching it back on.
          </p>
        )}
      </main>
    </>
  );
}
