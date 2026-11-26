import { factDate, factTime, formatSlot, formatWhen } from "@/lib/events/format";
import { priceFact } from "@/lib/events/public-page";
import type { EventRec } from "@/lib/events/types";

export interface Fact {
  lbl: string;
  val: string;
}
export interface Meter {
  text: string;
  pct: number | null;
  full?: boolean;
}

/** The hero's date line: one date, one session, or "<n> sessions". */
export function whenLineFor(event: EventRec): string {
  if (event.scheduleMode === "slots")
    return event.slots.length === 1
      ? formatSlot(event.slots[0])
      : `${event.slots.length} sessions`;
  return formatWhen(event.startsAt, event.endsAt);
}

/** The key facts under the hero: when, where and (if published) price. */
export function factsFor(event: EventRec): Fact[] {
  const facts: Fact[] = [];
  if (event.scheduleMode === "slots") {
    facts.push({ lbl: "Sessions", val: `${event.slots.length} dates` });
    const firstDated = event.slots.find((s) => s.date);
    if (firstDated) facts.push({ lbl: "Starts", val: formatSlot(firstDated) });
  } else if (event.startsAt) {
    facts.push({ lbl: "Date", val: factDate(event.startsAt) });
    facts.push({ lbl: "Time", val: factTime(event.startsAt, event.endsAt) });
  }
  if (event.location) facts.push({ lbl: "Where", val: event.location });
  const price = priceFact(event);
  if (price) facts.push({ lbl: "Price", val: price });
  return facts;
}

/** Spots left for a single-date event (slots show theirs in the schedule). */
export function spotsMeter(
  event: EventRec,
  avail: { taken: number; remaining: number | null; full: boolean },
): Meter | null {
  if (event.scheduleMode === "slots") return null;
  if (event.capacity == null) return { text: "Open registration", pct: null };
  const pct = Math.min(100, Math.round((avail.taken / event.capacity) * 100));
  // A tournament's capacity is in teams, not people.
  const text =
    event.type === "tournament"
      ? avail.full
        ? "Full"
        : `${avail.remaining} of ${event.capacity} teams left`
      : avail.full
        ? event.waitlistEnabled
          ? "Full — waitlist open"
          : "Full"
        : `${avail.remaining} of ${event.capacity} spots left`;
  return { text, pct };
}

/** The program roster's meter, when the event caps its roster. */
export function rosterMeter(
  event: EventRec,
  roster: { count: number; remaining: number | null; full: boolean },
): Meter | null {
  if (event.rosterLimit == null) return null;
  return {
    text: roster.full
      ? "Roster full"
      : `${roster.remaining} of ${event.rosterLimit} spots open`,
    pct: Math.min(100, Math.round((roster.count / event.rosterLimit) * 100)),
    full: roster.full,
  };
}

export default function FactsStrip({
  facts,
  spots,
  roster,
}: {
  facts: Fact[];
  spots: Meter | null;
  roster: Meter | null;
}) {
  if (facts.length === 0) return null;
  return (
    <div className="facts reveal">
      {facts.map((f, i) => (
        <div className="fact" key={i}>
          <div className="lbl">{f.lbl}</div>
          <div className="val">{f.val}</div>
        </div>
      ))}
      {spots && (
        <div className="fact">
          <div className="lbl">Availability</div>
          <div className="val">
            <small>{spots.text}</small>
          </div>
          {spots.pct != null && (
            <div className="spots-bar">
              <span style={{ width: `${spots.pct}%` }} />
            </div>
          )}
        </div>
      )}
      {roster && (
        <div className="fact">
          <div className="lbl">Program roster</div>
          <div className="val">
            <small style={roster.full ? { color: "var(--danger)" } : undefined}>
              {roster.text}
            </small>
          </div>
          <div className="spots-bar">
            <span style={{ width: `${roster.pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
