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

// What Ian already wrote on the calendar.
//
// He has kept the answer in the event title for two years - "lesson 3 of 5",
// "lesson 2 series 5", "lesson 1 of 5 [paid]" - and until now the book threw
// all of it away and asked him again. 135 of 312 titles carry a hint.
//
// Two shapes, because he writes both:
//
//   "lesson 3 of 5"      the 3rd of a five-lesson package
//   "lesson 2 series 5"  the 2nd lesson of his 5th series with that client
//
// They combine ("lesson 4 of 5 series 2"), and the series number also turns up
// bracketed ("lesson 1 of 5 [series 2]"). Only "of N" states the package SIZE;
// a bare series number says which block, not how long it runs.
//
// Nothing here decides anything. It reads a string and reports what it saw, so
// the screen can offer it and Ian can say no.

export interface TitleHints {
  /** Which lesson of the series, 1-based. "lesson 3 of 5" -> 3 */
  index: number | null;
  /** How many lessons the package holds. Only "of N" says this. */
  size: number | null;
  /** Which block of lessons: "series 2" -> 2. Not a size. */
  series: number | null;
  /** The title says the money is in. */
  paid: boolean;
  /** Anything bracketed that was not a payment or series marker. */
  aside: string | null;
}

export const NO_HINTS: TitleHints = {
  index: null,
  size: null,
  series: null,
  paid: false,
  aside: null,
};

/** 1-40. A package of 50 is a typo, and a year is not a lesson count. */
function smallCount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 40 ? n : null;
}

export function readTitle(titleRaw: string | null | undefined): TitleHints {
  const title = (titleRaw ?? "").trim();
  if (!title) return NO_HINTS;

  // "3 of 5", "3 / 5". The word "lesson" need not be in front of it.
  const ofMatch = /\b(\d{1,2})\s*(?:of|\/)\s*(\d{1,2})\b/i.exec(title);
  // Read the series before falling back to a bare index, or "lesson 2
  // series 5" takes the 5 for the position.
  const seriesMatch = /\bseries\s*(\d{1,2})\b/i.exec(title);

  let index = smallCount(ofMatch?.[1]);
  const size = smallCount(ofMatch?.[2]);
  const series = smallCount(seriesMatch?.[1]);

  // "lesson 2 series 5": no "of", so the number after "lesson" is the
  // position. Only trusted when a series number follows, which is the form he
  // actually writes - a bare "lesson 2" is too thin to guess from.
  if (index === null && series !== null) {
    index = smallCount(/\blessons?\s*(\d{1,2})\b/i.exec(title)?.[1]);
  }

  // A package cannot be "7 of 5". When the two disagree keep the size and drop
  // the position: the size is the figure he writes deliberately.
  if (index !== null && size !== null && index > size) index = null;

  // "not paid" is not paid - nameFromTitle has the same ordering trap.
  const paid =
    /\bpaid\b/i.test(title) && !/\b(?:not\s+paid|unpaid|no\s+pay)\b/i.test(title);

  // Bracketed text that is neither the series nor the payment note is
  // something he wanted to remember - usually who was in the group.
  const asides: string[] = [];
  for (const m of title.matchAll(/[[(]([^\])]*)[\])]/g)) {
    const inner = m[1].trim();
    if (!inner) continue;
    if (/^series\s*\d{1,2}$/i.test(inner)) continue;
    if (/^(?:un)?paid\b/i.test(inner)) continue;
    asides.push(inner);
  }

  return {
    index,
    size,
    series,
    paid,
    aside: asides.length ? asides.join("; ") : null,
  };
}

/** "3rd of 5 · series 2 · paid", or null when the title said nothing. */
export function hintSummary(h: TitleHints): string | null {
  const bits: string[] = [];
  if (h.index !== null && h.size !== null) bits.push(`${ordinal(h.index)} of ${h.size}`);
  else if (h.size !== null) bits.push(`${h.size}-pack`);
  else if (h.index !== null) bits.push(`${ordinal(h.index)} lesson`);
  if (h.series !== null) bits.push(`series ${h.series}`);
  if (h.paid) bits.push("paid");
  return bits.length ? bits.join(" · ") : null;
}

function ordinal(n: number): string {
  const teen = n % 100;
  if (teen >= 11 && teen <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
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
 * Deleting a lesson - typically a calendar entry that was never a lesson.
 *
 * A calendar lesson leaves its uid behind as a dismissed Review entry, which
 * planEntry skips forever; deleting the row alone would only last until the
 * next sync. Its own single goes with it unless paid: a paid bill is money
 * received, and deleting it would make that vanish without anyone deciding
 * so. A package just loses the lesson.
 */
export function planDelete(e: {
  calendarUid: string | null;
  bill: { kind: string; status: string } | null;
}):
  | { ok: true; dismissUid: string | null; dropSingle: boolean }
  | { ok: false; error: string } {
  const single = e.bill?.kind === "single";
  if (single && e.bill?.status === "paid") {
    return {
      ok: false,
      error: "Its bill is marked paid. Set the bill to unpaid first, then delete.",
    };
  }
  return { ok: true, dismissUid: e.calendarUid, dropSingle: single };
}

/**
 * Putting a lesson on a package - the series it really belongs to, rather
 * than the single the sync billed it as.
 *
 * Only the student's own packages, and never a paid single left behind: that
 * money would then be counted on the single and again on the package.
 */
export function planMove(e: {
  lessonClientId: string | null;
  bill: { kind: string; status: string } | null;
  target: { clientId: string; kind: string };
}): { ok: true; dropSingle: boolean } | { ok: false; error: string } {
  if (!e.lessonClientId) return { ok: false, error: "Give that lesson a student first." };
  if (e.target.kind !== "package") {
    return { ok: false, error: "Pick a package, not a single lesson's bill." };
  }
  if (e.target.clientId !== e.lessonClientId) {
    return { ok: false, error: "That package belongs to someone else." };
  }
  const single = e.bill?.kind === "single";
  if (single && e.bill?.status === "paid") {
    return {
      ok: false,
      error:
        "This lesson was already paid for on its own. Set that bill to unpaid first, then move it.",
    };
  }
  return { ok: true, dropSingle: single };
}

/**
 * Marking whether a lesson happened. One that did not happen owes nothing,
 * so its own unpaid single goes; a no-show keeps its bill (it may still be
 * charged), and a paid single or a package is never touched.
 */
export function planHappened(
  status: "completed" | "cancelled" | "no_show",
  bill: { kind: string; status: string } | null,
): { dropSingle: boolean } {
  return {
    dropSingle:
      status === "cancelled" && bill?.kind === "single" && bill.status !== "paid",
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
