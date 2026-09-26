import type { LoopType, RateCard } from "./types";
import { rateFor } from "./types";

// What each caddie has actually had, and how they have behaved getting it.
//
// A caddie who does not get a loop will ask why, and on a roster this size
// "the algorithm" is not an answer anyone accepts. So this counts plain things
// a person can argue with: loops worked, money earned, offers answered, loops
// handed back. No score, no weighting nobody can see.
//
// Loops and money are both kept because neither alone is fair. Balance the
// count and three single bags look the same as three forecaddies for four;
// balance the money and a man who takes every short loop looks idle. The shop
// reads both and decides — which is what a caddie master does anyway.

/** How late a hand-back was, measured against the tee time it was for. */
export type DropLateness = "early" | "late" | "same day";

/** Inside this many hours of the tee time, a hand-back is hard to refill. */
export const LATE_DROP_HOURS = 24;
/** Inside this many, the shop is unlikely to fill it at all. */
export const SAME_DAY_DROP_HOURS = 4;

export function dropLateness(
  droppedAt: string | null,
  teeTime: string,
): DropLateness | null {
  if (!droppedAt) return null;
  const hours =
    (new Date(teeTime).getTime() - new Date(droppedAt).getTime()) / 3_600_000;
  if (hours <= SAME_DAY_DROP_HOURS) return "same day";
  if (hours <= LATE_DROP_HOURS) return "late";
  return "early";
}

/** One assignment, flattened for counting. */
export interface LedgerEvent {
  caddieId: string;
  status: string;
  loopType: LoopType;
  teeTime: string;
  loopStatus: string;
  droppedAt: string | null;
}

export interface LedgerRow {
  caddieId: string;
  loopsWorked: number;
  earnedCents: number;
  offered: number;
  accepted: number;
  declined: number;
  /** Offers that simply ran out. Silence stalls the waterfall for everyone. */
  ignored: number;
  dropped: number;
  droppedLate: number;
  noShows: number;
}

const blank = (caddieId: string): LedgerRow => ({
  caddieId,
  loopsWorked: 0,
  earnedCents: 0,
  offered: 0,
  accepted: 0,
  declined: 0,
  ignored: 0,
  dropped: 0,
  droppedLate: 0,
  noShows: 0,
});

/**
 * Fold assignment history into one row per caddie.
 *
 * Only loops that actually happened count as worked. An accepted loop for next
 * Tuesday is a commitment, not a day's pay, and counting it would let someone
 * climb the fairness order by booking work they have not done yet.
 */
export function summariseLedger(
  events: LedgerEvent[],
  rates: RateCard,
): Map<string, LedgerRow> {
  const out = new Map<string, LedgerRow>();

  for (const e of events) {
    const row = out.get(e.caddieId) ?? blank(e.caddieId);

    // Every assignment began as an offer, however it ended.
    row.offered += 1;

    switch (e.status) {
      case "Accepted":
        row.accepted += 1;
        if (e.loopStatus === "Completed") {
          row.loopsWorked += 1;
          row.earnedCents += rateFor(rates, e.loopType) ?? 0;
        }
        break;
      case "Declined":
        row.declined += 1;
        break;
      case "Expired":
        row.ignored += 1;
        break;
      case "Dropped":
        row.dropped += 1;
        if (dropLateness(e.droppedAt, e.teeTime) !== "early") {
          row.droppedLate += 1;
        }
        break;
      case "No Show":
        row.noShows += 1;
        break;
      // Withdrawn is the shop's own doing, so it counts against nobody.
    }

    out.set(e.caddieId, row);
  }

  return out;
}

/**
 * Who is furthest behind, and therefore next up.
 *
 * Ordered on money rather than loop count: caddies compare pay, and an hour
 * forecaddying for four is not the hour spent carrying one bag. Ties go to
 * whoever has worked fewer loops, so the order never depends on who happens to
 * be holding a phone.
 */
export function nextUpOrder(
  rows: Map<string, LedgerRow>,
  caddieIds: string[],
): string[] {
  return [...caddieIds].sort((a, b) => {
    const ra = rows.get(a) ?? blank(a);
    const rb = rows.get(b) ?? blank(b);
    return ra.earnedCents - rb.earnedCents || ra.loopsWorked - rb.loopsWorked;
  });
}
