import { COURSE_TZ } from "./types";

// Pure date and number helpers for the lesson book.
//
// A "day" here is always a Pacific calendar date as "YYYY-MM-DD". Lessons
// are stored as instants and the server runs UTC, so anything that buckets
// lessons by day has to go through courseDay(), or an evening lesson lands
// on tomorrow. Day arithmetic is done on the bare date (in UTC, where no
// day is ever 23 or 25 hours long), never on a lesson's instant.

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(day: string): [number, number, number] {
  const m = DAY_RE.exec(day);
  if (!m) throw new Error(`Not a day: ${day}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isDay(s: string | undefined): s is string {
  if (!s || !DAY_RE.test(s)) return false;
  const [y, m, d] = parts(s);
  // A sane window: the book starts in 2025, and a month step from 9999-12
  // would walk into year 10000, which no longer formats as "YYYY".
  if (y < 2000 || y > 2100) return false;
  // Round-trip catches Feb 31 and friends, which Date.UTC silently rolls over.
  return fromUtc(Date.UTC(y, m - 1, d)) === s;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed id, so a mangled URL can 404 instead of erroring. */
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/**
 * A typed price, as cents. Blank is "no price" (null), never $0; negative or
 * non-numeric is refused rather than stored.
 */
export function parseDollars(
  v: string | number | null | undefined,
): { ok: true; cents: number | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, cents: null };
  if (typeof v === "string" && v.trim() === "") return { ok: true, cents: null };
  const n = typeof v === "number" ? v : Number(v.trim());
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, cents: Math.round(n * 100) };
}

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: COURSE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Pacific calendar date an instant falls on. */
export function courseDay(iso: string): string {
  return dayFmt.format(new Date(iso));
}

const wallFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: COURSE_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
});

/** Pacific wall clock minus UTC at an instant, in ms (negative: -7h / -8h). */
function offsetAt(ms: number): number {
  const p = Object.fromEntries(
    wallFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  const wall = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
  );
  return wall - ms;
}

/** The UTC instant of Pacific midnight at the start of `day`, as ISO. */
export function courseMidnightIso(day: string): string {
  const [y, m, d] = parts(day);
  const local = Date.UTC(y, m - 1, d);
  // First guess from the offset at midday, then re-read the offset at the
  // guess itself: on the day DST changes, midday and midnight differ by the
  // hour that changed at 2am.
  const guess = local - offsetAt(Date.UTC(y, m - 1, d, 12));
  return new Date(local - offsetAt(guess)).toISOString();
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parts(day);
  return fromUtc(Date.UTC(y, m - 1, d + n));
}

/** Monday to Sunday containing `day`. `to` is exclusive (next Monday). */
export function weekRange(day: string): {
  from: string;
  to: string;
  days: string[];
} {
  const [y, m, d] = parts(day);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const from = addDays(day, -((dow + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return { from, to: addDays(from, 7), days };
}

/** First of the month to first of the next. `to` is exclusive. */
export function monthRange(day: string): { from: string; to: string } {
  const [y, m] = parts(day);
  return {
    from: fromUtc(Date.UTC(y, m - 1, 1)),
    to: fromUtc(Date.UTC(y, m, 1)),
  };
}

/** Step the schedule back or forward. A month step lands on the 1st. */
export function shiftAnchor(
  day: string,
  view: "week" | "month",
  dir: -1 | 1,
): string {
  if (view === "week") return addDays(day, 7 * dir);
  const [y, m] = parts(day);
  return fromUtc(Date.UTC(y, m - 1 + dir, 1));
}

/** Schedule URL params, with anything malformed falling back to this week. */
export function parseScheduleParams(
  p: { view?: string; d?: string },
  today: string,
): { view: "week" | "month"; day: string } {
  return {
    view: p.view === "month" ? "month" : "week",
    day: isDay(p.d) ? p.d : today,
  };
}

/** Lessons bucketed by Pacific day, days and lessons both in time order. */
export function groupByDay<T extends { startsAt: string }>(
  items: T[],
): { day: string; items: T[] }[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const out: { day: string; items: T[] }[] = [];
  for (const it of sorted) {
    const day = courseDay(it.startsAt);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(it);
    else out.push({ day, items: [it] });
  }
  return out;
}

/**
 * "3 of 5", "one-off", or nothing for a lesson that did not happen.
 *
 * A number past the package size ("6 of 5") is shown as-is: it means the
 * package was overbooked or mis-assigned, and hiding it would hide that.
 */
export function seqLabel(l: {
  seq: number | null;
  packageSize: number | null;
  packageId: string | null;
  status: string;
}): string {
  if (l.status === "cancelled" || l.status === "no_show") return "";
  if (!l.packageId) return "one-off";
  if (l.seq === null) return "";
  return `${l.seq} of ${l.packageSize ?? "?"}`;
}

/** Bar heights relative to the tallest. All zeros stays all zeros. */
export function scaleBars(values: number[], height: number): number[] {
  const max = Math.max(0, ...values);
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => (Math.max(0, v) / max) * height);
}

/** Change from `prev` to `cur`; no percentage when there is nothing to compare. */
export function delta(
  cur: number,
  prev: number,
): { diff: number; pct: number | null } {
  const diff = cur - prev;
  return { diff, pct: prev > 0 ? Math.round((diff / prev) * 100) : null };
}

const COUNTED = new Set(["completed", "scheduled"]);

/**
 * Which unassigned lessons most likely belong to a package: the oldest ones
 * from the day it was sold (or, with no sale date, from its first lesson), up
 * to the room it has left.
 *
 * Only a suggestion - the client screen pre-ticks these and Ian confirms.
 * Cancelled lessons never use up a package, so they are never suggested.
 */
export function suggestForPackage(
  pkg: { id: string; size: number; soldOn: string | null },
  lessons: {
    id: string;
    startsAt: string;
    status: string;
    packageId: string | null;
  }[],
): string[] {
  const mine = lessons.filter(
    (l) => l.packageId === pkg.id && COUNTED.has(l.status),
  );
  const room = pkg.size - mine.length;
  if (room <= 0) return [];
  // From the sale date; failing that (every seeded package), from the
  // package's own first lesson; failing that, from the beginning.
  const from =
    pkg.soldOn ??
    (mine.length
      ? courseDay(
          mine.reduce((a, b) =>
            new Date(a.startsAt) <= new Date(b.startsAt) ? a : b,
          ).startsAt,
        )
      : null);
  return lessons
    .filter(
      (l) =>
        l.packageId === null &&
        COUNTED.has(l.status) &&
        (!from || courseDay(l.startsAt) >= from),
    )
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
    .slice(0, room)
    .map((l) => l.id);
}

/** Compare names the way a person would: case and punctuation are not identity. */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The lesson already in the book that a queued calendar entry is, if any.
 *
 * The seeded lessons carry no calendar link, so the sync could not recognise
 * them and queued their calendar entries as strangers. A lesson at the same
 * instant with no link of its own is that entry. When two share the instant,
 * the one whose client is named in the title wins; when the title does not
 * settle it, no guess - billing the wrong person is worse than asking.
 */
export function matchExisting(
  entry: { startsAt: string; titleRaw: string },
  lessons: {
    id: string;
    clientName: string;
    startsAt: string;
    calendarUid: string | null;
  }[],
): string | null {
  const t = new Date(entry.startsAt).getTime();
  const free = lessons.filter(
    (l) => !l.calendarUid && new Date(l.startsAt).getTime() === t,
  );
  if (free.length === 1) return free[0].id;
  if (free.length === 0) return null;
  const title = normName(entry.titleRaw);
  const named = free
    .filter((l) => l.clientName && title.includes(normName(l.clientName)))
    .sort((a, b) => b.clientName.length - a.clientName.length);
  if (named.length === 1) return named[0].id;
  if (named.length > 1 && named[0].clientName.length > named[1].clientName.length) {
    return named[0].id;
  }
  return null;
}

/** A Pacific wall-clock date and "HH:MM" as a UTC ISO instant. */
export function courseLocalIso(day: string, time: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    throw new Error(`Not a time: ${time}`);
  }
  const [y, mo, d] = parts(day);
  const local = Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2]));
  // Same two-step as courseMidnightIso: guess with the offset at the wall
  // time read as UTC, then re-read the offset at the guess.
  const guess = local - offsetAt(local);
  return new Date(local - offsetAt(guess)).toISOString();
}

/** Other spellings, tidied: trimmed, no blanks, no repeats, not the name itself. */
export function cleanAliases(input: string[], ownName: string): string[] {
  const seen = new Set([normName(ownName)]);
  const out: string[] = [];
  for (const raw of input) {
    const a = raw.trim();
    const k = normName(a);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

/**
 * Why these spellings cannot be added, or null if they can.
 *
 * The sync looks clients up by name or spelling; two clients sharing one
 * would make it file lessons under whichever it met last.
 */
export function aliasClash(
  aliases: string[],
  clientId: string,
  others: { id: string; name: string; aliases: string[] }[],
): string | null {
  const owner = new Map<string, string>();
  for (const o of others) {
    if (o.id === clientId) continue;
    for (const n of [o.name, ...o.aliases]) owner.set(normName(n), o.name);
  }
  for (const a of aliases) {
    const who = owner.get(normName(a));
    if (who) return `"${a.trim()}" already points to ${who}.`;
  }
  return null;
}
