import Link from "next/link";
import PrintButton from "@/components/events/PrintButton";
import { formatWhen } from "@/lib/events/format";
import type { EventRec, Player, Registration } from "@/lib/events/types";

// Printable tournament field: one row per team, waitlist below.
export default function TournamentRoster({
  event,
  regs,
}: {
  event: EventRec;
  regs: Registration[];
}) {
  // registrationsFor() returns entry order, which numbers the teams.
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const waitlist = regs.filter((r) => r.status === "waitlist");

  return (
    <main className="roster-print">
      <div
        className="no-print"
        style={{ padding: "18px 20px 0", maxWidth: 920, margin: "0 auto" }}
      >
        <Link
          href={`/admin/events/${event.id}`}
          className="navlink"
          style={{ color: "var(--green)" }}
        >
          ← Back to event
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <PrintButton />
        </div>
        <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid var(--line)" }} />
      </div>

      <section className="day-sheet">
        <header className="rs-head">
          <div>
            <h1>{event.title}</h1>
            <div className="rs-when">
              {formatWhen(event.startsAt, event.endsAt) || "Tournament field"}
            </div>
          </div>
          <div className="rs-count">
            <div className="n">{confirmed.length}</div>
            <div className="l">
              {event.capacity ? `of ${event.capacity} teams` : "teams"}
            </div>
          </div>
        </header>

        <h2 className="rs-h2">
          Field &middot; {confirmed.length}{" "}
          {confirmed.length === 1 ? "team" : "teams"}
        </h2>
        {confirmed.length === 0 ? (
          <p className="rs-empty">No teams are entered yet.</p>
        ) : (
          <TeamTable regs={confirmed} numbered />
        )}

        {waitlist.length > 0 && (
          <>
            <h2 className="rs-h2 rs-away">Waitlist &middot; {waitlist.length}</h2>
            <TeamTable regs={waitlist} muted />
          </>
        )}

        <footer className="rs-foot">
          Pasatiempo Golf Club &middot; {event.location || "Pasatiempo"}
        </footer>
      </section>
    </main>
  );
}

function TeamTable({
  regs,
  numbered = false,
  muted = false,
}: {
  regs: Registration[];
  numbered?: boolean;
  muted?: boolean;
}) {
  return (
    <table className={`rs-table rs-teams${muted ? " rs-muted" : ""}`}>
      <thead>
        <tr>
          <th className="rs-num">{numbered ? "Team #" : "#"}</th>
          <th>Member</th>
          <th>Guest</th>
          <th>Contact</th>
        </tr>
      </thead>
      <tbody>
        {regs.map((r, i) => {
          const member = playerFor(r, "member");
          const guest = playerFor(r, "guest");
          return (
            <tr key={r.id}>
              <td className="rs-num">{i + 1}</td>
              <td>
                <PlayerCell p={member} />
              </td>
              <td>
                <PlayerCell p={guest} />
              </td>
              <td className="rs-contact">
                {member?.email || r.email}
                {r.phone ? ` · ${r.phone}` : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function playerFor(r: Registration, role: Player["role"]): Player | undefined {
  const p = r.players?.find((x) => x.role === role);
  if (p) return p;
  // An entry without players (should not happen) still shows its name.
  if (role === "member")
    return { role, name: r.name, email: r.email, ghin: "", answers: {} };
  return undefined;
}

function PlayerCell({ p }: { p: Player | undefined }) {
  if (!p) return <span className="rs-contact">—</span>;
  return (
    <>
      <strong>{p.name}</strong>
      {p.ghin && <span className="rs-ghin"> · {p.ghin}</span>}
    </>
  );
}
