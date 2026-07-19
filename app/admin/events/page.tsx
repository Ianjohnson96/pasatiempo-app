import Link from "next/link";
import { redirect } from "next/navigation";
import AppBar from "@/components/events/AppBar";
import CopyLink from "@/components/events/CopyLink";
import { listEvents, registrationsFor, takenSeats } from "@/lib/events/data";
import { canManageEvent, getViewer } from "@/lib/events/auth";
import { formatWhen, TYPE_LABEL } from "@/lib/events/format";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const all = await listEvents();
  const events = all.filter((e) => canManageEvent(viewer, e));
  const withCounts = await Promise.all(
    events.map(async (e) => {
      const regs = await registrationsFor(e.id);
      return {
        ev: e,
        confirmed: takenSeats(regs),
        waitlist: regs.filter((r) => r.status === "waitlist").length,
      };
    }),
  );

  return (
    <>
      <AppBar admin email={viewer.email} />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>Events</h1>
            <div className="sub">
              Create an event, then copy its private link to send out.
            </div>
          </div>
          <span className="spacer" />
          <Link href="/admin/events/new" className="btn">
            + New event
          </Link>
        </div>

        {withCounts.length === 0 ? (
          <div className="card empty">
            <p style={{ fontSize: 17, marginBottom: 6 }}>No events yet.</p>
            <p className="muted" style={{ marginBottom: 18 }}>
              Your first event takes about a minute to set up.
            </p>
            <Link href="/admin/events/new" className="btn">
              + Create your first event
            </Link>
          </div>
        ) : (
          <div className="evlist">
            {withCounts.map(({ ev, confirmed, waitlist }) => (
              <div className="evrow" key={ev.id}>
                <div className="ev-main">
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Link
                      href={`/admin/events/${ev.id}`}
                      className="ev-title"
                      style={{ color: "var(--ink)" }}
                    >
                      {ev.title}
                    </Link>
                    <span className={`badge ${ev.status}`}>{ev.status}</span>
                  </div>
                  <div className="ev-meta">
                    <span>{TYPE_LABEL[ev.type]}</span>
                    <span>{formatWhen(ev.startsAt, ev.endsAt)}</span>
                    {ev.location && <span>📍 {ev.location}</span>}
                    {ev.inviteOnly && <span>🔒 Invite-only</span>}
                  </div>
                  <div style={{ marginTop: 10, maxWidth: 460 }}>
                    <CopyLink slug={ev.slug} compact />
                  </div>
                </div>
                <div className="ev-count">
                  <div className="num">{confirmed}</div>
                  <div className="lbl">
                    {ev.capacity ? `of ${ev.capacity}` : "signed up"}
                  </div>
                </div>
                {waitlist > 0 && (
                  <div className="ev-count">
                    <div className="num" style={{ color: "var(--warn)" }}>
                      {waitlist}
                    </div>
                    <div className="lbl">waitlist</div>
                  </div>
                )}
                <a
                  href={`/events/e/${ev.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn secondary small"
                >
                  View ↗
                </a>
                <Link
                  href={`/admin/events/${ev.id}`}
                  className="btn secondary small"
                >
                  Manage
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
