import { normName } from "./calc";

// The calendar sync's decisions, kept pure so they can be tested: which
// events are lessons, whose they are, and what to do with each one.

/** Must say "lesson" to count - this is Ian's work calendar, not a teaching one. */
const LESSON_WORD = /\blessons?\b/i;

// Group teaching, billed per head rather than per booking, so it belongs to no
// single client. Out until there is a model for it.
const NOT_BILLABLE = [
  /\bclinic\b/i,
  /\bcamp\b/i,
  /\bacademy\b/i,
  /\bjunior\s+golf\b/i,
];

export function isLessonTitle(subject: string): "lesson" | "group" | "no" {
  if (!subject || !LESSON_WORD.test(subject)) return "no";
  if (NOT_BILLABLE.some((re) => re.test(subject))) return "group";
  return "lesson";
}

/** Strip the scaffolding so "Jon Davies lesson 2 of 5" leaves "jon davies". */
export function nameFromTitle(subject: string): string {
  // Asides first, while the brackets still exist - normName() strips
  // punctuation, and after that "[chrck with ken]" is indistinguishable from
  // a surname. That is how "Patsy leung lesson [chrck with ken]" turned into a
  // client called "Patsy Leung Chrck Ken". First line only, for the same reason.
  const plain = subject
    .split("\n")[0]
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^)]*\)/g, " ");

  let s = normName(plain);
  // "not paid" before bare "paid", or the "not" survives alone and
  // "Jack Hutchinson lesson 2 of 5 not paid" reduces to "jack hutchinson not".
  s = s.replace(/\bnot\s+paid\b|\bunpaid\b|\bno\s+pay\b|\bpaid\b/g, " ");
  s = s.replace(/\blessons?\b/g, " ");
  s = s.replace(
    /\bseries\b|\bsession\b|\bpackage\b|\bpkg\b|\bof\b|\bwith\b|\bfor\b/g,
    " ",
  );
  s = s.replace(/\b\d+\b/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

export type ReviewState = "waiting" | "dismissed" | null;

/**
 * What to do with one lesson event.
 *
 * A waiting Review entry is looked at again on every run: if Ian has since
 * fixed the title in Outlook (or added the spelling as an alias), it books
 * and leaves the queue by itself. A dismissed one stays dismissed - he said
 * it was not a lesson, and a later title edit does not overrule that.
 */
export function planEntry(e: { matched: boolean; review: ReviewState }): {
  action: "book" | "queue" | "skip";
  clearReview: boolean;
} {
  if (e.review === "dismissed") return { action: "skip", clearReview: false };
  if (e.matched) return { action: "book", clearReview: e.review === "waiting" };
  return {
    action: e.review === "waiting" ? "skip" : "queue",
    clearReview: false,
  };
}

/**
 * Should a new calendar lesson be billed as a single?
 *
 * Yes when the client has no package with room left - nothing else it could
 * belong to. No when a package still has room: it might be the next lesson of
 * that series, and which series is Ian's call, not the sync's.
 */
export function needsSingle(
  packages: { kind: string; size: number; counted: number }[],
): boolean {
  return !packages.some((p) => p.kind === "package" && p.size - p.counted > 0);
}
