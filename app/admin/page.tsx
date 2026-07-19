import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/events/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Unified admin dashboard — one home for every section. Access is gated by the
// proxy (signed-in Supabase user) and re-checked here via getViewer().
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

export default async function AdminHome() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const [ev, mhi] = await Promise.all([eventsStats(), mhiStats()]);

  return (
    <>
      <div className="appbar">
        <div className="appbar-inner">
          <Link href="/admin" className="brand">
            <span className="mark">P</span> Pasatiempo Admin
          </Link>
          <span className="spacer" />
          <span className="navlink">{viewer.email}</span>
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
            <div className="sub">Manage every Pasatiempo section from one place.</div>
          </div>
        </div>

        <div className="evlist">
          {/* Event Planner */}
          <div className="evrow">
            <div className="ev-main">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="ev-title">Event Planner</span>
                <span className="badge open">live</span>
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
            <Link href="/admin/events" className="btn secondary small">
              Manage
            </Link>
          </div>

          {/* Marion Hollins Invitational */}
          <div className="evrow">
            <div className="ev-main">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="ev-title">Marion Hollins Invitational</span>
                <span className="badge gray">display</span>
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
            <a
              href="/mhi"
              target="_blank"
              rel="noopener noreferrer"
              className="btn secondary small"
            >
              View site ↗
            </a>
          </div>

          {/* El Sombrero (static info page — nothing to manage) */}
          <div className="evrow">
            <div className="ev-main">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="ev-title">El Sombrero</span>
                <span className="badge gray">static</span>
              </div>
              <div className="ev-meta">
                <span>Men&apos;s Club info page</span>
                <span>edited in code (app/sombrero)</span>
              </div>
            </div>
            <a
              href="/sombrero"
              target="_blank"
              rel="noopener noreferrer"
              className="btn secondary small"
            >
              View site ↗
            </a>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 22, fontSize: 13 }}>
          More sections can be added here as they&apos;re built — each stays isolated
          in its own schema.
        </p>
      </main>
    </>
  );
}
