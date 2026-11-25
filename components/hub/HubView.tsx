import Image from "next/image";
import Link from "next/link";
import HubTile from "@/components/hub/HubTile";
import SiteSwitch from "@/components/hub/SiteSwitch";
import type { AppKey, SiteKey } from "@/lib/hub/apps";

// The club hub's markup (app/admin/page.tsx fetches its data and passes it in). Kept apart from the fetching so the
// page can be rendered with sample data to check its layout, phone width included.

export interface HubData {
  email: string;
  isSuper: boolean;
  managesPeople: boolean;
  denied?: string;
  /** The apps this person can open. */
  apps: Partial<Record<AppKey, boolean>>;
  /** Their role in each app ("admin", "staff"…), for the badge. */
  roles: Partial<Record<AppKey, string>>;
  ev: { events: number; regs: number; ok: boolean } | null;
  mhi: { teams: number; players: number; ok: boolean } | null;
  cad: { caddies: number; open: number; ok: boolean } | null;
  sites: Record<string, boolean>;
  reports: { period: { key: string; label: string }; left: number; status: string }[];
  lsn: { clients: number; unpaid: number; pending: number; runningOut: number; ok: boolean } | null;
}

const DENIED: Record<string, string> = {
  events: "You don't have access to the Event Planner.",
  caddie: "You don't have access to the Caddie Program.",
  merch: "You don't have access to the Merchandise Program.",
  lessons: "The Lesson Book is the teaching pro's own.",
  super: "That page is for the super admin.",
  people: "Managing people is for app admins.",
};

const ROLE_LABEL: Record<string, string> = { admin: "admin", manager: "manager", staff: "staff", owner: "owner", viewer: "viewer" };

export default function HubView({ email, isSuper, managesPeople, denied, apps, roles, ev, mhi, cad, sites, reports, lsn }: HubData) {
  const see = (app: AppKey) => !!apps[app];
  const reportsLate = reports.some((r) => r.status === "overdue");
  const role = (app: AppKey) => {
    const r = roles[app];
    return r ? <span className="badge gray">{isSuper ? "super admin" : ROLE_LABEL[r] ?? r}</span> : null;
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
          {/* Wide screens: the links in a row. */}
          <nav className="hub-nav" aria-label="Account">
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
          </nav>
          {/* Phones: the same links behind a Menu button (a plain <details>, no script), so the bar never runs off
              the screen and makes the phone zoom the whole page out. */}
          <details className="hub-menu">
            <summary>Menu</summary>
            <div className="hub-menu-pop">
              <span className="hub-menu-who">{email}</span>
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
              <form action="/auth/signout" method="post" style={{ margin: 0 }}>
                <button className="btn secondary small" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </details>
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

          {lsn && (
            <HubTile
              index={order++}
              href="/lessons"
              title="Lesson Book"
              desc="Who you taught, what it cost, and who still owes you."
              tag="Teaching"
              staffTag
              // The 16th from above - the other three tiles have the green,
              // the bunkers and the clubhouse, so this one needs its own view.
              img="/sombrero/email/altshot.jpg"
              focus="center 55%"
              badge={
                <>
                  {role("lessons")}
                  {lsn.unpaid > 0 && (
                    <span className="badge open">{lsn.unpaid} unpaid</span>
                  )}
                </>
              }
              stats={[
                { num: lsn.unpaid, lbl: "unpaid" },
                { num: lsn.clients, lbl: "clients" },
              ]}
              meta={
                <>
                  {lsn.pending > 0 && <span>{lsn.pending} charges pending</span>}
                  {lsn.runningOut > 0 && (
                    <span>{lsn.runningOut} running out</span>
                  )}
                  {!lsn.ok && <span className="warn">⚠︎ Couldn&apos;t reach the database</span>}
                </>
              }
              cta="Open"
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

          {isSuper && (
            <HubTile
              index={order++}
              external
              href="/invitational"
              title="Men’s Club Invitational"
              desc="The Invitational’s event page — schedule, flights, the field and prizes."
              tag="Public site"
              // Morning down the fairway toward the bay: the page's own hero.
              img="/invitational/img/hero.avif"
              focus="center 55%"
              meta={<span>Edited in code (components/invitational/content.ts)</span>}
              cta="View site"
              controls={siteSwitch("invitational")}
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
