import Link from "next/link";
import AppBar from "@/components/events/AppBar";
import EventCard from "@/components/events/EventCard";
import { availability, listEvents, registrationsFor } from "@/lib/events/data";
import { canManageEvent, requireEventsViewer } from "@/lib/events/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const viewer = await requireEventsViewer();
  const all = await listEvents();
  const events = all.filter((e) => canManageEvent(viewer, e));
  const withCounts = await Promise.all(
    events.map(async (e) => {
      const regs = await registrationsFor(e.id);
      return {
        ev: e,
        taken: availability(e, regs).taken,
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
            {withCounts.map(({ ev, taken, waitlist }) => (
              <EventCard key={ev.id} ev={ev} taken={taken} waitlist={waitlist} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
