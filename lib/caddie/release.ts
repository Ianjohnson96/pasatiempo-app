import { addDays, zonedTime } from "./data";
import type { JobRelease } from "./types";

// When a job on the open board becomes visible to caddies.
//
// A loop the shop posts is not shown to anyone until it has been "announced",
// and it is announced at exactly one point: once its release time has passed,
// it is inside the horizon, and nobody next-up is still holding first refusal
// on it. Keeping that decision in one pure function means the board, the claim
// check and the notification can never disagree about what is open.
//
// Split out of the sweep so it can be tested. Every rule here is about a clock
// — release times, DST, "at least 48 hours away" — and clocks are where the
// bugs that only show up one night a year live.

/** The course-local calendar date an instant falls on. */
function courseDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * When a loop's job is released: `daysBefore` its day, at the release time,
 * course-local. -Infinity when release is off, so it is always "released".
 */
export function releaseAtMs(teeTimeIso: string, rules: JobRelease, tz: string): number {
  if (!rules.enabled) return Number.NEGATIVE_INFINITY;
  const day = addDays(courseDate(teeTimeIso, tz), -rules.daysBefore);
  return zonedTime(day, rules.time, tz).getTime();
}

/** Inside the horizon: caddies can see it. Always true with no horizon set. */
export function withinHorizon(teeTimeIso: string, rules: JobRelease, nowMs: number): boolean {
  if (rules.horizonDays <= 0) return true;
  return new Date(teeTimeIso).getTime() - nowMs <= rules.horizonDays * 86_400_000;
}

export type BoardStep =
  /** Not yet: before release, beyond the horizon, or next-up still deciding. */
  | "wait"
  /** Give whoever is next up first refusal before anyone else sees it. */
  | "priority"
  /** Open it to everyone. */
  | "announce";

/** What the board should do right now with one posted, unannounced loop. */
export function nextBoardStep(input: {
  teeTimeIso: string;
  /** When the shop put it on the board — a release never runs before that. */
  postedAtIso: string;
  /** First refusal already given (taken, declined, or ran out — it is not given twice). */
  priorityOffered: boolean;
  /** A first-refusal offer is out and has not run out yet. */
  priorityPending: boolean;
  nowMs: number;
  rules: JobRelease;
  tz: string;
}): BoardStep {
  const { rules, nowMs } = input;

  const opensAt = Math.max(
    releaseAtMs(input.teeTimeIso, rules, input.tz),
    new Date(input.postedAtIso).getTime(),
  );
  if (nowMs < opensAt) return "wait";
  if (!withinHorizon(input.teeTimeIso, rules, nowMs)) return "wait";

  if (rules.priorityEnabled) {
    if (input.priorityPending) return "wait";
    if (!input.priorityOffered) {
      const hoursAway = (new Date(input.teeTimeIso).getTime() - nowMs) / 3_600_000;
      // Only for work booked well ahead. A loop needed in two hours goes to
      // everyone at once: first refusal is a courtesy, not a reason to leave a
      // member without a caddie.
      if (hoursAway >= rules.priorityMinLeadHours) return "priority";
    }
  }

  return "announce";
}
