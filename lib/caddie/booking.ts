import { TEE_INTERVAL_MINUTES, type GroupNeed, type LoopType } from "./types";

// Turning one phone call into rows on the tee sheet.
//
// The call is never "four identical groups". It is a foursome wanting a double
// bag and a single, or two double bags off the same tee, or sixteen players
// across four groups where only the first and the fourth want anybody. Each
// need becomes its own loop so it can be offered, accepted and paid on its
// own, which is how the work is actually done.
//
// Split out of the server action so the numbering can be tested. Getting "4 of
// 4" wrong on a sheet the caddie reads at 6am is not a bug anyone catches in
// review.

export interface PlannedLoop {
  /** ISO instant. */
  teeTime: string;
  playerName: string;
  loopType: LoopType;
  caddiesRequired: number;
}

export function planBooking(input: {
  /** Instant of the FIRST tee time, in ms. */
  startMs: number;
  name: string;
  /** One entry per tee time, in order. Empty means that group wants nobody. */
  groups: GroupNeed[][];
  intervalMinutes?: number;
}): PlannedLoop[] {
  const interval = input.intervalMinutes ?? TEE_INTERVAL_MINUTES;
  const total = input.groups.length;

  return input.groups.flatMap((needs, i) =>
    needs
      .filter((n) => n.count > 0)
      .map((need) => ({
        // Minutes added to the instant directly: a daylight saving change
        // never lands inside a single morning's tee sheet.
        teeTime: new Date(input.startMs + i * interval * 60_000).toISOString(),
        // Numbered by position on the sheet, not by how many loops came out of
        // it. The fourth tee time is "4 of 4" even when the second and third
        // wanted nobody — that is what the caller said, and it is what the
        // group will answer to at the first tee.
        playerName:
          total > 1 ? `${input.name} (${i + 1} of ${total})` : input.name,
        loopType: need.loopType,
        caddiesRequired: Math.min(8, Math.max(1, Math.round(need.count))),
      })),
  );
}
