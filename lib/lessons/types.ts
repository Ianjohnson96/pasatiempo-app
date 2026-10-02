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
  /** Only on dashboard rows that offer a text. */
  clientPhone?: string | null;
  /** A package Ian sold, or one lesson billed on its own. */
  kind: "package" | "single";
  clientIsMember: boolean;
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
 * A lesson as lesson_numbered returns it: where it sits in its package
 * ("3 of 5"), worked out in SQL so every screen agrees.
 */
export interface NumberedLesson extends LessonRec {
  isMember: boolean;
  packageSize: number | null;
  packageLabel: string | null;
  paymentStatus: PaymentStatus | null;
  /** Position among the package's completed + scheduled lessons. */
  seq: number | null;
  /** What was worked on, in Ian's words. */
  notes: string | null;
  /** "m365" from the calendar, "manual" when added by hand. */
  calendarSource: string | null;
  /** "single" when this lesson is billed on its own. */
  packageKind: "package" | "single" | null;
}

export interface MonthPoint {
  /** "YYYY-MM", Pacific. */
  month: string;
  lessons: number;
  /** Paid packages by the month they were paid in. */
  revenueCents: number;
}

/** Everything the front page shows, from one lesson_dashboard() call. */
export interface DashboardData {
  now: string;
  next: NumberedLesson | null;
  /** The last note on whoever is next, to read before they arrive. */
  nextLastNote: { notes: string; startsAt: string } | null;
  /** Today through the next six days, cancelled left out. */
  week: NumberedLesson[];
  money: {
    owedCents: number;
    pendingCents: number;
    unpaidCount: number;
    pendingCount: number;
    collectedMonthCents: number;
    collectedSeasonCents: number;
    unpriced: number;
  };
  runningOut: PackageRec[];
  /** Collected this season by method; "none" = method not recorded. */
  collectedByMethod: Record<string, number>;
  unpaid: PackageRec[];
  notSeen: { id: string; name: string; lastLessonAt: string }[];
  /** Thirteen months ending this one, oldest first. */
  months: MonthPoint[];
  split: { member: number; guest: number };
  topClients: { id: string; name: string; lessons: number }[];
  sync: { lastSyncedAt: string | null; lastStatus: string | null } | null;
  reviewCount: number;
  /** Package size -> standard price in cents. */
  standardPrices: Record<number, number>;
  /** Single-lesson rates in cents. */
  singleRates: SingleRates;
  /** Taught or booked lessons that are on no bill yet. */
  unbilled: { lessons: number; clients: number };
}

export interface SingleRates {
  member?: number;
  guest?: number;
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
  /** Lessons on no bill yet - neither in a package nor a single. */
  unbilled: number;
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

/** "2:00 PM", Pacific. */
export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    timeZone: COURSE_TZ,
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

/** "Single · Sep 3, 2026" for a single, the label or "5-lesson package" otherwise. */
export function packageTitle(p: PackageRec): string {
  if (p.kind === "single") {
    return p.soldOn ? `Single · ${formatDay(p.soldOn)}` : "Single lesson";
  }
  return p.label || `${p.size}-lesson package`;
}

export function packageProgress(p: PackageRec): string {
  return `${p.used} of ${p.size} used`;
}

/** Nearly finished is Ian's cue to sell the next one. */
export function runningOut(p: PackageRec): boolean {
  return !p.isComplete && p.remaining <= 1;
}

export type PayMethod = "venmo" | "member_charge" | "cash" | "other";

/** One client's row on the Billing screen. */
export interface BillingClient {
  clientId: string;
  name: string;
  isMember: boolean;
  /** Lessons taught or booked that are on no bill yet, oldest first. */
  lessons: { id: string; startsAt: string; status: LessonStatus; titleRaw: string | null }[];
  /** Pre-filled amount (cents) and method - see billingDefaults. */
  defaults: { priceCents: number | null; method: PayMethod };
  /** A package with lessons left: these might belong to it, not be singles. */
  roomIn: { id: string; title: string; left: number }[];
}

export interface BillingData {
  clients: BillingClient[];
  /** Every bill not yet paid (unpaid or pending), oldest first. */
  unpaid: PackageRec[];
}
