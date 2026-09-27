import "../hub.css";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient, createHubClient } from "@/lib/supabase/admin";
import { getPerson, hasApp, isAppAdmin, roleIn, signedInEmail } from "@/lib/hub/access";
import { APPS, type AppKey, type SiteKey } from "@/lib/hub/apps";
import HubTile from "@/components/hub/HubTile";
import SiteSwitch from "@/components/hub/SiteSwitch";
import { reportStatus } from "@/lib/merch/reminders";
import { pacificToday } from "@/lib/merch/schedule";

// Staff dashboard — one home for every Pasatiempo app. The proxy makes sure
// someone is signed in; each tile below appears only for people with access to
// that app (lib/hub/access.ts). The super admin also sees the public-site
// switches and People & access.
//
// Every tile carries a photograph of the course rather than an icon. The club
// is the brand, and a hub that looks like any other dashboard tells staff
// nothing about where they are.
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

// The Pro Shop's reporting calendar: what's due or overdue right now (lib/merch/schedule.ts).
async function merchReports() {
  try {
    const open = await reportStatus(pacificToday());
    return open.filter((r) => r.status === "due" || r.status === "overdue");
  } catch {
    return [];
  }
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
  // The proxy already sends signed-out visitors to /login; this keeps the page safe on its own.
  if (!email) redirect("/login");
  const see = (app: AppKey) => hasApp(person, app);
  const isSuper = !!person?.isSuper;
  const managesPeople = !!person && (isSuper || (Object.keys(APPS) as AppKey[]).some((a) => isAppAdmin(person, a)));

  const [ev, mhi, cad, sites, reports] = await Promise.all([
    see("events") ? eventsStats() : null,
    isSuper ? mhiStats() : null,
    see("caddie") ? caddieStats() : null,
    isSuper ? siteSwitches() : Promise.resolve({} as Record<string, boolean>),
    see("merch") ? merchReports() : Promise.resolve([]),
  ]);
  const reportsLate = reports.some((r) => r.status === "overdue");
  const role = (app: AppKey) => {
    const r = roleIn(person, app);
    return r ? <span className="badge gray">{isSuper ? "super admin" : ROLE_LABEL[r]}</span> : null;
  };
  const siteSwitch = (key: SiteKey) => (isSuper ? <SiteSwitch site={key} enabled={sites[key] !== false} /> : null);
  const nothing = !see("events") && !see("caddie") && !see("merch") && !isSuper;

  // Stagger index, counted over the tiles actually shown so the arrival
  // animation never pauses for one this person cannot see.
  let order = 0;

  return (
    <div className="hub">
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
          {isSuper && (
            <Link href="/admin/activity" className="navlink">
              Activity
            </Link>
          )}
          <Link href="/account/password" className="navlink">
            Password
          </Link>
          <span className="navlink">{email}</span>
          <form action="/auth/signout" method="post" style={{ margin: 0 }}>
            <button className="btn secondary small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <header className="hub-hero">
        <Image
          src="/sombrero/email/horserace.jpg"
          alt="Morning light across a green at Pasatiempo"
          fill
          priority
          sizes="100vw"
          className="hub-hero-img"
        />
        <div className="hub-hero-inner">
          <div className="hub-crest">
            <Image src="/logo-mark.png" alt="" width={56} height={56} />
          </div>
          <div>
            <p className="hub-eyebrow">Pasatiempo Golf Club</p>
            <h1 className="hub-title">Club Hub</h1>
            <p className="hub-sub">
              {isSuper
                ? "Super admin — every Pasatiempo app, the public sites, and who can use what."
                : "The Pasatiempo apps you have access to."}
            </p>
          </div>
        </div>
      </header>

      <main className="hub-main">
        {denied && DENIED[denied] && <div className="notice hub-notice">{DENIED[denied]}</div>}
        {nothing && (
          <div className="notice hub-notice">
            You&apos;re signed in, but no app has been shared with you yet. Ask the person who runs the app to add you.
          </div>
        )}

        {!nothing && <h2 className="hub-section-label">Your apps</h2>}

        <div className="hub-grid">
          {ev && (
            <HubTile
              index={order++}
              href="/admin/events"
              title="Event Planner"
              desc="Club events and clinics — registrations, rosters and financials."
              tag="Members"
              img="/sombrero/img/course-green.jpg"
              focus="center 60%"
              badge={role("events")}
              stats={[
                { num: ev.events, lbl: "events" },
                { num: ev.regs, lbl: "signups" },
              ]}
              meta={!ev.ok ? <span className="warn">⚠︎ Couldn&apos;t reach the database</span> : null}
              cta="Manage"
              controls={siteSwitch("events")}
            />
          )}

          {cad && (
            <HubTile
              index={order++}
              href="/admin/caddie"
              title="Caddie Program"
              desc="Post loops, reach the roster and see who is free — without ringing round."
              tag="Staff"
              staffTag
              img="/sombrero/img/course-bunkers.jpg"
              focus="center 45%"
              badge={role("caddie")}
              stats={[
                { num: cad.caddies, lbl: "caddies" },
                { num: cad.open, lbl: "open loops" },
              ]}
              meta={
                <>
                  <span>Caddies sign in separately at /caddie</span>
                  {!cad.ok && <span className="warn">⚠︎ Couldn&apos;t reach the database</span>}
                </>
              }
              cta="Manage"
            />
          )}

          {see("merch") && (
            <HubTile
              index={order++}
              // A full page load rather than a client-side hop: the
              // Merchandise Program is its own app with its own styles.
              hard
              href={reports.length ? "/merch#reports" : "/merch"}
              title="Merchandise Program"
              desc="Forecast, open-to-buy, orders and the brand scorecard."
              tag="Pro Shop"
              // The clubhouse — where the shop is.
              img="/sombrero/img/course-wide.jpg"
              focus="center 48%"
              badge={
                <>
                  {role("merch")}
                  {!!reports.length && (
                    <span className={"badge " + (reportsLate ? "closed" : "full")}>
                      {reportsLate ? "reports overdue" : "reports due"}
                    </span>
                  )}
                </>
              }
              meta={
                reports.length
                  ? reports.map((r) => (
                      <span key={r.period.key}>
                        {r.period.label}: {r.left} left
                      </span>
                    ))
                  : null
              }
              cta={reports.length ? "Open reports" : "Open"}
            />
          )}

          {mhi && (
            <HubTile
              index={order++}
              external
              href="/mhi"
              title="Marion Hollins Invitational"
              desc="The tournament site — schedule, flights, formats and the Horse Race."
              tag="Public site"
              // Hollins herself rather than another fairway: the event carries
              // her name, and the only black-and-white photo on the page marks
              // it as the heritage one. Portrait, so the crop sits high.
              img="/mhi/images/mh-swing.avif"
              focus="center 18%"
              stats={[
                { num: mhi.teams, lbl: "teams" },
                { num: mhi.players, lbl: "players" },
              ]}
              meta={
                <>
                  <span>Roster edited in Supabase for now</span>
                  {!mhi.ok && <span className="warn">⚠︎ Couldn&apos;t reach the database</span>}
                </>
              }
              cta="View site"
              controls={siteSwitch("mhi")}
            />
          )}

          {isSuper && (
            <HubTile
              index={order++}
              external
              href="/sombrero"
              title="El Sombrero"
              desc="The Men’s Club event page — schedule, format and details."
              tag="Public site"
              img="/sombrero/email/altshot.jpg"
              focus="center 55%"
              meta={<span>Edited in code (app/sombrero)</span>}
              cta="View site"
              controls={siteSwitch("sombrero")}
            />
          )}
        </div>

        {isSuper && (
          <p className="hub-footnote">
            A public site that&apos;s switched off shows visitors a &ldquo;not available&rdquo; page. You still see it, so you can check it before switching it back on.
          </p>
        )}

        <footer className="hub-foot">
          <span className="hub-foot-note">
            <span className="hub-dot" aria-hidden />
            Pasatiempo Golf Club · Santa Cruz, California
          </span>
        </footer>
      </main>
    </div>
  );
}
