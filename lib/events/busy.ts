// When a submit button shows its spinner. A quick request never flashes one;
// a slow one shows it after a second and keeps it long enough to be read.

export const SPINNER_DELAY_MS = 1000;
export const SPINNER_MIN_MS = 500;

/** Whether the spinner should be showing `now`, for a request started at `startedAt`. */
export function spinnerVisible(startedAt: number, now: number): boolean {
  return now - startedAt >= SPINNER_DELAY_MS;
}

/** How much longer to keep a spinner that appeared at `shownAt` (0 if it never did). */
export function holdUntil(shownAt: number | null, now: number): number {
  if (shownAt == null) return 0;
  return Math.max(0, shownAt + SPINNER_MIN_MS - now);
}
