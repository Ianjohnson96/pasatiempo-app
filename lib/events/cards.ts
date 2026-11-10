// Pure text for the events list cards (no database, no React).
import { rosterName } from "./format";
import type { EventRec, Registration, RosterStyle, Slot } from "./types";

// "28 of 36 teams" / "42 of 60 spots" / "42 signed up".
export function fillLabel(
  event: Pick<EventRec, "type">,
  taken: number,
  capacity: number | null,
): string {
  if (capacity == null) return `${taken} signed up`;
  return `${taken} of ${capacity} ${event.type === "tournament" ? "teams" : "spots"}`;
}

// 0-100 for the fill bar; an unlimited event has no bar to fill.
export function fillPercent(taken: number, capacity: number | null): number {
  if (capacity == null || capacity <= 0) return 0;
  return Math.min(100, Math.round((taken / capacity) * 100));
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Month and day for the card's date box, or null ("TBD"). A single-date event
// uses startsAt; a slots event falls back to its first dated slot.
export function dateBoxParts(
  event: Pick<EventRec, "startsAt" | "scheduleMode">,
  slots: Pick<Slot, "date">[],
): { month: string; day: string } | null {
  if (event.scheduleMode !== "slots" && event.startsAt) {
    const d = new Date(event.startsAt);
    if (!Number.isNaN(d.getTime())) {
      return { month: MONTHS[d.getMonth()], day: String(d.getDate()) };
    }
  }
  const dates = slots
    .map((s) => s.date)
    .filter((x): x is string => !!x)
    .sort();
  if (dates[0]) {
    const [, mo, d] = dates[0].split("-").map(Number);
    if (mo >= 1 && mo <= 12 && d) return { month: MONTHS[mo - 1], day: String(d) };
  }
  return null;
}

// Public tournament roster lines, "<member> & <guest>". Confirmed teams only,
// names only: nothing else from a registration is ever read here.
export function teamLines(
  regs: Pick<Registration, "status" | "name" | "players">[],
  style: RosterStyle,
): string[] {
  return regs
    .filter((r) => r.status === "confirmed")
    .map((r) => {
      const member = r.players?.find((p) => p.role === "member")?.name ?? r.name;
      const guest = r.players?.find((p) => p.role === "guest")?.name;
      const m = rosterName(member, style);
      return guest ? `${m} & ${rosterName(guest, style)}` : m;
    });
}
