import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEvent, registrationsFor } from "@/lib/events/data";
import { canManageEvent, getViewer } from "@/lib/events/auth";
import { formatSlot, formatSlotShort, formatWhen } from "@/lib/events/format";
import type { Registration } from "@/lib/events/types";
import PrintButton from "@/components/events/PrintButton";

export const dynamic = "force-dynamic";

// Printable day roster: for each date, who's coming — and who on the program
// roster is NOT coming that day. `?slot=<id>` prints a single date.
export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await params;
  const { slot: slotFilter } = await searchParams;
  const event = await getEvent(id);
  if (!event) notFound();
  if (!canManageEvent(viewer, event)) redirect("/admin");

  const regs = await registrationsFor(id);
  const confirmed = regs.filter((r) => r.status === "confirmed");
  const waitlist = regs.filter((r) => r.status === "waitlist");

  const heads = (r: Registration) => Math.max(1, r.partySize);
  const byName = (a: Registration, b: Registration) =>
    a.name.localeCompare(b.name);

  // Which dates to print. Single-date events get one pseudo-slot.
  const slots =
    event.slots.length > 0
      ? event.slots.filter((s) => !slotFilter || s.id === slotFilter)
      : [];

  const days =
    slots.length > 0
      ? slots.map((s) => {
          const attending = confirmed
            .filter((r) => r.slotIds.includes(s.id))
            .sort(byName);
          const away = confirmed
            .filter((r) => !r.slotIds.includes(s.id))
            .sort(byName);
          return {
            key: s.id,
            label: formatSlot(s),
            note: s.note,
            capacity: s.capacity,
            attending,
            away,
          };
        })
      : [
          {
            key: "single",
            label: formatWhen(event.startsAt, event.endsAt) || "All attendees",
            note: "",
            capacity: event.capacity,
            attending: [...confirmed].sort(byName),
            away: [] as Registration[],
          },
        ];

  return (
    <main className="roster-print">
      <div className="no-print" style={{ padding: "18px 20px 0", maxWidth: 920, margin: "0 auto" }}>
        <Link href={`/admin/events/${event.id}`} className="navlink" style={{ color: "var(--green)" }}>
          ← Back to event
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
          <PrintButton />
        </div>
        {event.slots.length > 0 && (
          <div className="roster-picker">
            <span className="rp-label">Print:</span>
            <Link
              className={`rp-day${!slotFilter ? " on" : ""}`}
              href={`/admin/events/${event.id}/roster`}
            >
              All
            </Link>
            {event.slots.map((s) => (
              <Link
                key={s.id}
                className={`rp-day${slotFilter === s.id ? " on" : ""}`}
                href={`/admin/events/${event.id}/roster?slot=${s.id}`}
                title={formatSlot(s)}
              >
                {formatSlotShort(s)}
              </Link>
            ))}
          </div>
        )}
        <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid var(--line)" }} />
      </div>

      {days.map((d, i) => (
        <section className="day-sheet" key={d.key} style={i > 0 ? { pageBreakBefore: "always" } : undefined}>
          <header className="rs-head">
            <div>
              <h1>{event.title}</h1>
              <div className="rs-when">{d.label}</div>
              {d.note && <div className="rs-note">{d.note}</div>}
            </div>
            <div className="rs-count">
              <div className="n">{d.attending.reduce((n, r) => n + heads(r), 0)}</div>
              <div className="l">{d.capacity ? `of ${d.capacity}` : "attending"}</div>
            </div>
          </header>

          <h2 className="rs-h2">
            Attending &middot; {d.attending.length}{" "}
            {d.attending.length === 1 ? "sign-up" : "sign-ups"}
          </h2>
          {d.attending.length === 0 ? (
            <p className="rs-empty">No one is signed up for this date.</p>
          ) : (
            <table className="rs-table">
              <thead>
                <tr>
                  <th className="rs-chk"></th>
                  <th>Name</th>
                  <th>Guests</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {d.attending.map((r) => (
                  <tr key={r.id}>
                    <td className="rs-chk">☐</td>
                    <td>
                      <strong>{r.name}</strong>
                      {r.partySize > 1 && <span className="rs-party"> +{r.partySize - 1}</span>}
                    </td>
                    <td>{r.guestNames.join(", ")}</td>
                    <td className="rs-contact">
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {d.away.length > 0 && (
            <>
              <h2 className="rs-h2 rs-away">Not coming this date &middot; {d.away.length}</h2>
              <table className="rs-table rs-muted">
                <tbody>
                  {d.away.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.name}
                        {r.partySize > 1 && <span className="rs-party"> +{r.partySize - 1}</span>}
                      </td>
                      <td className="rs-contact">{r.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {waitlist.length > 0 && (
            <>
              <h2 className="rs-h2 rs-away">Waitlist &middot; {waitlist.length}</h2>
              <table className="rs-table rs-muted">
                <tbody>
                  {waitlist.sort(byName).map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="rs-contact">
                        {r.email}
                        {r.phone ? ` · ${r.phone}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <footer className="rs-foot">
            Pasatiempo Golf Club &middot; {event.location || "Pasatiempo"}
          </footer>
        </section>
      ))}
    </main>
  );
}
