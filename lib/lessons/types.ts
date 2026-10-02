// Shapes for the lesson book. These mirror public.lesson_* and the three
// views, but stay plain: they cross to the browser, so no Supabase types.
//
// THE BILLING UNIT IS THE PACKAGE, not the lesson. Ian sells 3, 5 or 10
// lessons and is paid once, up front. A lesson with no package_id is a genuine
// one-off. Money therefore lives on the package and never on the lesson - the
// earlier per-lesson model was wrong about how he actually works.

/** Submitted-but-not-posted member charges are real, so this is not a boolean. */
export type PaymentStatus = "unpaid" | "pending" | "paid";

export type LessonStatus = "completed" | "scheduled" | "cancelled" | "no_show";

export interface ClientRec {
  id: string;
  name: string;
  /** Other spellings seen on the calendar; how the sync keeps matching. */
  aliases: string[];
  email: string | null;
  phone: string | null;
  memberNumber: string | null;
  isMember: boolean;
  active: boolean;
  notes: string | null;
}

export interface PackageRec {
  id: string;
  clientId: string;
  clientName: string;
  label: string | null;
  size: number;
  /** Integer cents, or null when the price was never recorded. */
  priceCents: number | null;
  soldOn: string | null;
  paymentMethod: string | null;
  paymentStatus: PaymentStatus;
  paidOn: string | null;
  notes: string | null;
  used: number;
  remaining: number;
  booked: number;
  lastLessonAt: string | null;
  isComplete: boolean;
}

export interface LessonRec {
  id: string;
  clientId: string | null;
  clientName: string;
  packageId: string | null;
  startsAt: string;
  endsAt: string;
  status: LessonStatus;
  titleRaw: string | null;
  calendarUid: string | null;
}

/**
 * A calendar entry the sync could not place.
 *
 * Counted nowhere until Ian answers it. The sync offers `guessName` - what it
 * stripped the title down to - but never acts on it, because "Adrian Moreno
 * wife" might be Adrian's lesson or his wife's, and billing the wrong one is
 * the kind of error nobody ever notices.
 */
export interface ReviewRec {
  calendarUid: string;
  startsAt: string;
  endsAt: string;
  titleRaw: string;
  guessClientId: string | null;
  guessName: string | null;
  seenAt: string;
}

/** One row of lesson_client_summary - the roster screen. */
export interface ClientSummary {
  id: string;
  name: string;
  isMember: boolean;
  active: boolean;
  totalLessons: number;
  lastLessonAt: string | null;
  packageCount: number;
  owedCents: number;
}

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// Pacific. Lesson times are timestamptz and Vercel runs UTC, so anything
// rendered without this lands seven hours out - which moves an early lesson
// onto the previous day.
export const COURSE_TZ = "America/Los_Angeles";

export function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    timeZone: COURSE_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(iso: string | null): string {
  if (!iso) return "";
  // A bare date (sold_on, paid_on) carries no timezone; pushing it through
  // Date() and back can shift it a day, so take it apart instead.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (bare) {
    return new Date(
      Number(bare[1]),
      Number(bare[2]) - 1,
      Number(bare[3]),
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: COURSE_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Cents in, dollars out. Prices are integers so they never drift. */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Pending",
  paid: "Paid",
};

/** Maps onto badge classes already in globals.css. */
export const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  unpaid: "badge closed",
  pending: "badge draft",
  paid: "badge full",
};

export function packageProgress(p: PackageRec): string {
  return `${p.used} of ${p.size} used`;
}

/** Nearly finished is Ian's cue to sell the next one. */
export function runningOut(p: PackageRec): boolean {
  return !p.isComplete && p.remaining <= 1;
}
