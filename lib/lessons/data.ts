import { lessonBookClient } from "./db";
import { matchExisting } from "./calc";
import type {
  ClientRec,
  ClientSummary,
  DashboardData,
  LessonStatus,
  NumberedLesson,
  PackageRec,
  PaymentStatus,
  ReviewRec,
} from "./types";

// Read-side for the lesson book.
//
// Counts come from the views rather than being recomputed here:
// lesson_package_status already works out used / remaining / booked, and one
// definition of "remaining" owned by the database beats two that disagree.
//
// Every query runs as the signed-in user, so RLS decides what comes back. A
// reader who is not in lesson_owners gets empty arrays, not an error.

type Row = Record<string, unknown>;

const str = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);
const num = (v: unknown): number => Number(v ?? 0);

function toClient(r: Row): ClientRec {
  return {
    id: r.id as string,
    name: r.name as string,
    aliases: (r.aliases as string[] | null) ?? [],
    email: str(r.email),
    phone: str(r.phone),
    memberNumber: str(r.member_number),
    isMember: r.is_member === true,
    active: r.active !== false,
    notes: str(r.notes),
  };
}

/** Built from lesson_package_status, which carries the counts already. */
function toPackage(r: Row): PackageRec {
  return {
    id: r.package_id as string,
    clientId: r.client_id as string,
    clientName: (r.client_name as string) ?? "",
    label: str(r.label),
    size: num(r.size),
    priceCents:
      r.price_cents === null || r.price_cents === undefined
        ? null
        : num(r.price_cents),
    soldOn: str(r.sold_on),
    paymentMethod: str(r.payment_method),
    paymentStatus: ((r.payment_status as string) ?? "unpaid") as PaymentStatus,
    paidOn: str(r.paid_on),
    notes: str(r.notes),
    used: num(r.lessons_used),
    remaining: num(r.lessons_remaining),
    booked: num(r.lessons_booked),
    lastLessonAt: str(r.last_lesson_at),
    isComplete: r.is_complete === true,
  };
}

export async function listClientSummaries(): Promise<ClientSummary[]> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_client_summary")
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    isMember: r.is_member === true,
    active: r.active !== false,
    totalLessons: num(r.total_lessons),
    lastLessonAt: str(r.last_lesson_at),
    packageCount: num(r.package_count),
    owedCents: num(r.owed_cents),
  }));
}

export async function getClient(id: string): Promise<ClientRec | null> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toClient(data) : null;
}

/** Every package, or one client's. Newest first; sold_on can be null. */
export async function listPackages(clientId?: string): Promise<PackageRec[]> {
  const supa = await lessonBookClient();
  let q = supa.from("lesson_package_status").select("*");
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q
    .order("sold_on", { ascending: false, nullsFirst: false })
    .order("client_name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPackage);
}

/** A lesson_numbered row, as the browser sees it. */
function toNumbered(r: Row): NumberedLesson {
  return {
    id: r.id as string,
    clientId: str(r.client_id),
    clientName: (r.client_name as string) ?? "",
    packageId: str(r.package_id),
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    status: ((r.status as string) ?? "completed") as LessonStatus,
    titleRaw: str(r.title_raw),
    calendarUid: str(r.calendar_uid),
    isMember: r.is_member === true,
    packageSize:
      r.package_size === null || r.package_size === undefined
        ? null
        : num(r.package_size),
    packageLabel: str(r.package_label),
    paymentStatus: (str(r.payment_status) as PaymentStatus | null) ?? null,
    seq: r.seq === null || r.seq === undefined ? null : num(r.seq),
  };
}

/**
 * One client's lessons, newest first, each numbered within its package.
 *
 * The name is joined in rather than copied onto the lesson, so a rename shows
 * everywhere at once instead of leaving history behind under the old spelling.
 */
export async function clientLessons(
  clientId: string,
): Promise<NumberedLesson[]> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_numbered")
    .select("*")
    .eq("client_id", clientId)
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toNumbered);
}

/** Every lesson starting in [fromIso, toIso), in time order. */
export async function scheduleLessons(
  fromIso: string,
  toIso: string,
): Promise<NumberedLesson[]> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_numbered")
    .select("*")
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toNumbered);
}

/** jsonb {"5": 50000} -> {5: 50000}, dropping anything that is not a price. */
function toPrices(v: unknown): Record<number, number> {
  const out: Record<number, number> = {};
  if (v && typeof v === "object") {
    for (const [k, c] of Object.entries(v as Record<string, unknown>)) {
      const size = Number(k);
      const cents = Number(c);
      const ok =
        Number.isInteger(size) &&
        size > 0 &&
        Number.isFinite(cents) &&
        cents >= 0;
      if (ok) out[size] = cents;
    }
  }
  return out;
}

/** Package size -> standard price in cents. Empty until Ian sets them. */
export async function standardPrices(): Promise<Record<number, number>> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_settings")
    .select("standard_prices")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return toPrices(data?.standard_prices);
}

/** The queue of calendar entries the sync would not guess at. */
export async function listReview(): Promise<ReviewRec[]> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_review")
    .select("*")
    .eq("dismissed", false)
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    calendarUid: r.calendar_uid as string,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    titleRaw: (r.title_raw as string) ?? "",
    guessClientId: str(r.guess_client_id),
    guessName: str(r.guess_name),
    seenAt: r.seen_at as string,
  }));
}

/**
 * For each queued entry, the lesson already in the book that it is (if any):
 * calendar uid -> that lesson's client. See matchExisting for the rule.
 */
export async function reviewMatches(
  items: ReviewRec[],
): Promise<Record<string, { lessonId: string; clientId: string; clientName: string }>> {
  if (!items.length) return {};
  const supa = await lessonBookClient();
  const times = [...new Set(items.map((i) => i.startsAt))];
  const { data, error } = await supa
    .from("lesson_numbered")
    .select("id, client_id, client_name, starts_at, calendar_uid")
    .in("starts_at", times);
  if (error) throw new Error(error.message);
  const pool = (data ?? []).map((r) => ({
    id: r.id as string,
    clientId: (r.client_id as string) ?? "",
    clientName: (r.client_name as string) ?? "",
    startsAt: r.starts_at as string,
    calendarUid: (r.calendar_uid as string | null) ?? null,
  }));
  const out: Record<string, { lessonId: string; clientId: string; clientName: string }> = {};
  const claimed = new Set<string>();
  for (const it of items) {
    // A lesson can only be one entry; once claimed it leaves the pool, so
    // two calendar entries at the same moment do not both show as matched.
    const id = matchExisting(
      it,
      pool.filter((p) => !claimed.has(p.id)),
    );
    const hit = id ? pool.find((p) => p.id === id) : undefined;
    if (hit && hit.clientId) {
      claimed.add(hit.id);
      out[it.calendarUid] = {
        lessonId: hit.id,
        clientId: hit.clientId,
        clientName: hit.clientName,
      };
    }
  }
  return out;
}

/** Badge count for the Review tab. A head request - no rows come back. */
export async function reviewCount(): Promise<number> {
  const supa = await lessonBookClient();
  const { count, error } = await supa
    .from("lesson_review")
    .select("calendar_uid", { count: "exact", head: true })
    .eq("dismissed", false);
  // A badge is not worth failing a page render over.
  if (error) return 0;
  return count ?? 0;
}

/**
 * The front page, in one round trip.
 *
 * lesson_dashboard() works out every number in SQL - Pacific day, week,
 * month and season boundaries included - because doing it here took five
 * queries one after another and was most of why the book felt slow.
 */
export async function dashboardData(): Promise<DashboardData> {
  const supa = await lessonBookClient();
  const { data, error } = await supa.rpc("lesson_dashboard");
  if (error) throw new Error(error.message);
  const d = (data ?? {}) as Row;
  const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
  const m = (d.money ?? {}) as Row;
  const split = (d.split ?? {}) as Row;
  const sync = d.sync as Row | null;

  return {
    now: (d.now as string) ?? new Date().toISOString(),
    next: d.next ? toNumbered(d.next as Row) : null,
    week: rows(d.week).map(toNumbered),
    money: {
      owedCents: num(m.owed_cents),
      pendingCents: num(m.pending_cents),
      unpaidCount: num(m.unpaid_count),
      pendingCount: num(m.pending_count),
      collectedMonthCents: num(m.collected_month_cents),
      collectedSeasonCents: num(m.collected_season_cents),
      unpriced: num(m.unpriced),
    },
    runningOut: rows(d.running_out).map(toPackage),
    unpaid: rows(d.unpaid).map(toPackage),
    notSeen: rows(d.not_seen).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      lastLessonAt: r.last_lesson_at as string,
    })),
    months: rows(d.months).map((r) => ({
      month: r.month as string,
      lessons: num(r.lessons),
      revenueCents: num(r.revenue_cents),
    })),
    split: { member: num(split.member), guest: num(split.guest) },
    topClients: rows(d.top_clients).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      lessons: num(r.lessons),
    })),
    sync: sync
      ? {
          lastSyncedAt: str(sync.last_synced_at),
          lastStatus: str(sync.last_status),
        }
      : null,
    reviewCount: num(d.review_count),
    standardPrices: toPrices(d.standard_prices),
  };
}
