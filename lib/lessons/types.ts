// Shapes shared by the lesson book's server and client code.
//
// These mirror the `lessons` schema (supabase/migration-lessons-schema.sql)
// but are deliberately plain: they cross to the browser, so they carry no
// Supabase types and no columns the client has no business seeing.

export type LessonStatus = "scheduled" | "delivered" | "voided" | "removed";

export interface StudentRec {
  id: string;
  name: string;
  aliases: string[];
  email: string | null;
  phone: string | null;
  active: boolean;
  notes: string;
}

export interface LessonRec {
  id: string;
  studentId: string;
  studentName: string;
  eventKey: string;
  /** ISO. Rendered in course time by `formatWhen`, never in the browser's zone. */
  startsAt: string;
  minutes: number;
  title: string;
  calendar: string;
  status: LessonStatus;
  /** null means no price set yet - which the app surfaces as needing attention. */
  amount: number | null;
  paid: boolean;
  paidAt: string | null;
  series: string | null;
  seq: number | null;
  seqOf: number | null;
}

/** A student plus the numbers Ian actually asks about. */
export interface StudentSummary extends StudentRec {
  lessons: number;
  /** Delivered lessons with no price on them yet. */
  unpriced: number;
  /** What they owe: the sum of priced, delivered, unpaid lessons. */
  owed: number;
  paidTotal: number;
  lastLesson: string | null;
}

export interface PendingRec {
  eventKey: string;
  startsAt: string;
  minutes: number;
  title: string;
  calendar: string;
  guess: string | null;
}

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// The course runs on Pacific time. Lesson times are timestamptz and Vercel runs
// in UTC, so anything rendered without this lands seven hours out - which here
// would move an early-morning lesson onto the previous day.
export const COURSE_TZ = "America/Los_Angeles";

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    timeZone: COURSE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: COURSE_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** "3 of 5", "Series 2", or null for a one-off. */
export function seriesLabel(l: {
  series: string | null;
  seq: number | null;
  seqOf: number | null;
}): string | null {
  if (l.seq && l.seqOf) return `${l.seq} of ${l.seqOf}`;
  if (l.seq) return `Lesson ${l.seq}`;
  return l.series || null;
}
