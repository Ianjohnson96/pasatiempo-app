// Pure seat math (no database), shared by the public page, admin and actions.
import type { EventRec, Registration } from "./types";

// ---- Seat math (shared by public page and admin) --------------------------

// How many seats a registration holds. A tournament team is one entry however
// many players are on it; everything else counts the party.
export function regWeight(
  event: Pick<EventRec, "type">,
  r: Registration,
): number {
  return event.type === "tournament" ? 1 : Math.max(1, r.partySize);
}

// Seats already taken (confirmed only), optionally for a single slot.
export function takenSeats(
  regs: Registration[],
  slotId: string | null = null,
  event?: Pick<EventRec, "type">,
): number {
  return regs
    .filter((r) => r.status === "confirmed")
    .filter((r) => (slotId == null ? true : r.slotIds.includes(slotId)))
    .reduce((n, r) => n + (event ? regWeight(event, r) : Math.max(1, r.partySize)), 0);
}

// ---- Program roster (unique people across the whole event) ----------------

// Total distinct people on the roster (registrant + guests), de-duped by email
// so signing up for multiple dates still counts once. Confirmed only.
export function rosterCount(regs: Registration[]): number {
  const heads = new Map<string, number>();
  for (const r of regs) {
    if (r.status !== "confirmed") continue;
    const email = r.email.trim().toLowerCase();
    heads.set(email, Math.max(heads.get(email) ?? 0, Math.max(1, r.partySize)));
  }
  let total = 0;
  for (const n of heads.values()) total += n;
  return total;
}

export interface RosterAvailability {
  limit: number | null; // null = no cap
  count: number; // distinct people currently enrolled
  remaining: number | null; // null = no cap
  full: boolean;
}

export function rosterAvailability(
  event: EventRec,
  regs: Registration[],
): RosterAvailability {
  const count = rosterCount(regs);
  if (event.rosterLimit == null)
    return { limit: null, count, remaining: null, full: false };
  const remaining = Math.max(0, event.rosterLimit - count);
  return { limit: event.rosterLimit, count, remaining, full: remaining <= 0 };
}

// True if this email already holds a confirmed roster spot (may keep adding dates).
export function onRoster(regs: Registration[], email: string): boolean {
  const e = email.trim().toLowerCase();
  return regs.some((r) => r.status === "confirmed" && r.email.trim().toLowerCase() === e);
}

export interface Availability {
  capacity: number | null; // null = unlimited
  taken: number;
  remaining: number | null; // null = unlimited
  full: boolean;
}

export function availability(
  event: EventRec,
  regs: Registration[],
  slotId: string | null = null,
): Availability {
  const cap = slotId
    ? (event.slots.find((s) => s.id === slotId)?.capacity ?? null)
    : event.capacity;
  const taken = takenSeats(regs, slotId, event);
  if (cap == null) {
    return { capacity: null, taken, remaining: null, full: false };
  }
  const remaining = Math.max(0, cap - taken);
  return { capacity: cap, taken, remaining, full: remaining <= 0 };
}
