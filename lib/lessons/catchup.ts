// Money taken in, and the bills that still stop it adding up.
//
// Pure, so the Clients screens and the Billing catch-up agree on what "paid"
// means. A bill is paid once its status says so; pending is a member charge
// in flight, counted as neither taken in nor owed.

interface Billish {
  paymentStatus: "unpaid" | "pending" | "paid";
  priceCents: number | null;
  paymentMethod: string | null;
}

/** "none" = paid, but how was never recorded. */
export type MethodKey = "venmo" | "member_charge" | "cash" | "other" | "none";

export function paidTotals(bills: Billish[]): {
  totalCents: number;
  byMethod: Partial<Record<MethodKey, number>>;
} {
  const byMethod: Partial<Record<MethodKey, number>> = {};
  let totalCents = 0;
  for (const b of bills) {
    // A paid bill with no price is a gap on the catch-up list, not $0 earned.
    if (b.paymentStatus !== "paid" || b.priceCents === null) continue;
    const key = (b.paymentMethod ?? "none") as MethodKey;
    byMethod[key] = (byMethod[key] ?? 0) + b.priceCents;
    totalCents += b.priceCents;
  }
  return { totalCents, byMethod };
}

export type CatchUpGap = "unpaid" | "pending" | "no price" | "no type";

/** Why a bill is on the catch-up list; empty means it is settled. */
export function catchUpGaps(b: Billish): CatchUpGap[] {
  const gaps: CatchUpGap[] = [];
  if (b.paymentStatus === "unpaid") gaps.push("unpaid");
  if (b.paymentStatus === "pending") gaps.push("pending");
  if (b.priceCents === null) gaps.push("no price");
  // Only money that arrived has a "how".
  if (b.paymentStatus === "paid" && !b.paymentMethod) gaps.push("no type");
  return gaps;
}

/**
 * The day a bill counts as paid, for income by month.
 *
 * A series is paid up front, so it is dated by its first lesson rather than
 * the day it was entered - entering last spring's packages today must not
 * put last spring's money in November. A date already recorded wins.
 */
/**
 * The day to record when a bill is marked paid with one tap.
 *
 * Marking paid is usually catching up, not money arriving that minute, so
 * "today" is the last resort: a bill already paid keeps its day, then the
 * day its Venmo payment landed, then its first lesson, then when it was sold.
 */
export function markPaidOn(e: {
  alreadyPaidOn: string | null;
  venmoOn: string | null;
  firstLessonOn: string | null;
  soldOn: string | null;
  today: string;
}): string {
  return e.alreadyPaidOn ?? e.venmoOn ?? e.firstLessonOn ?? e.soldOn ?? e.today;
}

export function seriesPaidOn(
  p: { kind: "package" | "single"; soldOn: string | null; paidOn: string | null },
  firstLessonOn: string | null,
): string | null {
  return p.paidOn ?? firstLessonOn ?? p.soldOn ?? null;
}
