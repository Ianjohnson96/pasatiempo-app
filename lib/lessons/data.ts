import { lessonBookClient } from "./db";
import { billingDefaults, courseDay, matchExisting } from "./calc";
import { catchUpGaps, paidTotals } from "./catchup";
import { hintSummary, readTitle } from "./sync-plan";
import { packageTitle } from "./types";
import type {
  BillingClient,
  BillingData,
  ClientRec,
  ClientSummary,
  DashboardData,
  LedgerCandidate,
  LedgerData,
  LedgerRow,
  LessonStatus,
  NumberedLesson,
  PackageRec,
  PayMethod,
  PaymentStatus,
  ReviewRec,
  SingleRates,
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
    clientPhone: str(r.client_phone),
    kind: r.kind === "single" ? "single" : "package",
    clientIsMember: r.client_is_member === true,
  };
}

export async function listClientSummaries(): Promise<ClientSummary[]> {
  const supa = await lessonBookClient();
  // The summary view only knows what is owed; money taken in is added up from
  // the bills themselves, by the same rule the client page uses.
  const [{ data, error }, bills] = await Promise.all([
    supa.from("lesson_client_summary").select("*").order("name"),
    supa
      .from("lesson_packages")
      .select("client_id, price_cents, payment_status, payment_method"),
  ]);
  if (error) throw new Error(error.message);
  if (bills.error) throw new Error(bills.error.message);
  const byClient = new Map<string, Parameters<typeof paidTotals>[0]>();
  for (const b of bills.data ?? []) {
    const id = b.client_id as string;
    const list = byClient.get(id) ?? [];
    list.push({
      paymentStatus: ((b.payment_status as string) ?? "unpaid") as PaymentStatus,
      priceCents: b.price_cents === null ? null : num(b.price_cents),
      paymentMethod: str(b.payment_method),
    });
    byClient.set(id, list);
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    isMember: r.is_member === true,
    active: r.active !== false,
    totalLessons: num(r.total_lessons),
    lastLessonAt: str(r.last_lesson_at),
    packageCount: num(r.package_count),
    owedCents: num(r.owed_cents),
    paidCents: paidTotals(byClient.get(r.id as string) ?? []).totalCents,
    unbilled: num(r.unbilled_lessons),
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
    notes: str(r.notes),
    calendarSource: str(r.calendar_source),
    packageKind:
      r.package_kind === "single"
        ? "single"
        : r.package_kind === "package"
          ? "package"
          : null,
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

/** {"member": cents, "guest": cents}, keeping only real prices. */
function toRates(v: unknown): SingleRates {
  const out: SingleRates = {};
  const r = (v ?? {}) as Row;
  for (const k of ["member", "guest"] as const) {
    const c = Number(r[k]);
    if (r[k] !== null && r[k] !== undefined && Number.isFinite(c) && c >= 0) {
      out[k] = c;
    }
  }
  return out;
}

/** Single-lesson rates. Empty until Ian sets them. */
export async function singleRates(): Promise<SingleRates> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_settings")
    .select("single_rates")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return toRates(data?.single_rates);
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
    nextLastNote: d.next_last_note
      ? {
          notes: String((d.next_last_note as Row).notes ?? ""),
          startsAt: String((d.next_last_note as Row).starts_at ?? ""),
        }
      : null,
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
    collectedByMethod: Object.fromEntries(
      Object.entries((d.collected_by_method ?? {}) as Row).map(([k, v]) => [
        k,
        num(v),
      ]),
    ),
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
    singleRates: toRates(d.single_rates),
    unbilled: {
      lessons: num((d.unbilled as Row | null)?.lessons),
      clients: num((d.unbilled as Row | null)?.clients),
    },
  };
}

/**
 * The Billing screen: every lesson on no bill yet, grouped by client, with
 * what to pre-fill, plus every bill still waiting for money. Four reads,
 * all at once.
 */
export async function billingData(): Promise<BillingData> {
  const supa = await lessonBookClient();
  const [lessonsRes, clientsRes, packages, rates, billedRes] = await Promise.all([
    supa
      .from("lesson_numbered")
      .select("id, client_id, starts_at, status, title_raw")
      .is("package_id", null)
      .not("client_id", "is", null)
      .in("status", ["completed", "scheduled"])
      .order("starts_at"),
    supa.from("lesson_clients").select("id, name, is_member"),
    listPackages(),
    singleRates(),
    // When each bill's lessons start: a series counts as paid on its first.
    supa
      .from("lessons")
      .select("package_id, starts_at")
      .not("package_id", "is", null)
      .neq("status", "cancelled"),
  ]);
  if (lessonsRes.error) throw new Error(lessonsRes.error.message);
  if (clientsRes.error) throw new Error(clientsRes.error.message);
  if (billedRes.error) throw new Error(billedRes.error.message);

  const firstLesson = new Map<string, string>();
  for (const l of billedRes.data ?? []) {
    const id = l.package_id as string;
    const at = l.starts_at as string;
    const seen = firstLesson.get(id);
    if (!seen || at < seen) firstLesson.set(id, at);
  }

  const client = new Map(
    (clientsRes.data ?? []).map((c) => [
      c.id as string,
      { name: c.name as string, isMember: c.is_member === true },
    ]),
  );

  // The most recent priced single per client: "what they paid last time".
  const lastSingle = new Map<string, { priceCents: number | null; method: PayMethod | null }>();
  for (const p of [...packages]
    .filter((p) => p.kind === "single" && p.priceCents !== null)
    .sort((a, b) => (a.soldOn ?? "").localeCompare(b.soldOn ?? ""))) {
    lastSingle.set(p.clientId, {
      priceCents: p.priceCents,
      method: (p.paymentMethod as PayMethod | null) ?? null,
    });
  }

  const byClient = new Map<string, BillingClient>();
  for (const l of lessonsRes.data ?? []) {
    const id = l.client_id as string;
    const who = client.get(id);
    if (!who) continue;
    let row = byClient.get(id);
    if (!row) {
      row = {
        clientId: id,
        name: who.name,
        isMember: who.isMember,
        lessons: [],
        defaults: billingDefaults({
          isMember: who.isMember,
          last: lastSingle.get(id) ?? null,
          rates,
        }),
        roomIn: packages
          .filter((p) => p.clientId === id && p.kind === "package")
          .map((p) => ({ id: p.id, title: packageTitle(p), left: p.size - p.used - p.booked }))
          .filter((p) => p.left > 0),
      };
      byClient.set(id, row);
    }
    row.lessons.push({
      id: l.id as string,
      startsAt: l.starts_at as string,
      status: ((l.status as string) ?? "completed") as LessonStatus,
      titleRaw: str(l.title_raw),
    });
  }

  return {
    // Most to bill first: that is where one tap saves the most.
    clients: [...byClient.values()].sort(
      (a, b) => b.lessons.length - a.lessons.length || a.name.localeCompare(b.name),
    ),
    catchUp: packages
      .map((p) => {
        const first = firstLesson.get(p.id);
        return {
          ...p,
          firstLessonOn: first ? courseDay(first) : null,
          gaps: catchUpGaps(p),
        };
      })
      .filter((p) => p.gaps.length > 0)
      .sort((a, b) =>
        (a.firstLessonOn ?? a.soldOn ?? "").localeCompare(
          b.firstLessonOn ?? b.soldOn ?? "",
        ),
      ),
  };
}

/**
 * Every lesson in date order, with whatever is known about the money on it.
 *
 * Built in one pass over four tables rather than per-row queries: 311 lessons
 * against 151 loose payments is nothing in memory, and 311 round trips is not.
 *
 * The matching is deliberately generous. It offers; it never decides. A
 * payment is a candidate when the payer's name shares a distinguishing word
 * with the client's and the money moved anywhere near the lesson - wide,
 * because "Joseph Wold" paying for "Aiden wold" is the normal case rather
 * than the exception, and a candidate Ian rejects costs him a glance while
 * one that was never offered costs him the afternoon.
 */
export async function lessonLedger(): Promise<LedgerData> {
  const supa = await lessonBookClient();
  const [lessonsRes, clientsRes, packagesRes, paymentsRes] = await Promise.all([
    supa
      .from("lessons")
      .select("id, client_id, package_id, starts_at, status, title_raw")
      .order("starts_at", { ascending: false }),
    supa.from("lesson_clients").select("id, name, is_member"),
    supa
      .from("lesson_packages")
      .select(
        "id, client_id, kind, size, price_cents, payment_status, payment_method, sold_on, paid_on",
      ),
    supa
      .from("lesson_payments")
      .select("id, payer_name, note, amount_cents, paid_on, package_id, lesson_id, kind"),
  ]);
  for (const r of [lessonsRes, clientsRes, packagesRes, paymentsRes]) {
    if (r.error) throw new Error(r.error.message);
  }
  const lessons = lessonsRes.data ?? [];
  const client = new Map(
    (clientsRes.data ?? []).map((c) => [
      c.id as string,
      { name: c.name as string, isMember: c.is_member === true },
    ]),
  );
  const pkg = new Map((packagesRes.data ?? []).map((p) => [p.id as string, p as Row]));

  // Lessons taught against each package. A cancelled one does not count,
  // which is the whole point of marking it rather than deleting it.
  const usedBy = new Map<string, number>();
  for (const l of lessons) {
    const id = l.package_id as string | null;
    if (!id) continue;
    if (l.status !== "completed" && l.status !== "scheduled") continue;
    usedBy.set(id, (usedBy.get(id) ?? 0) + 1);
  }

  // What each client paid last time, to fill the form in: the most recent
  // single that actually carries a price.
  const last = new Map<string, { priceCents: number; method: PayMethod | null }>();
  for (const p of [...(packagesRes.data ?? [])]
    .filter((p) => p.kind === "single" && p.price_cents != null)
    .sort((a, b) => String(a.sold_on ?? "").localeCompare(String(b.sold_on ?? "")))) {
    last.set(p.client_id as string, {
      priceCents: num(p.price_cents),
      method: (p.payment_method as PayMethod | null) ?? null,
    });
  }

  // Payments attached to nothing yet. One already ruled "not a lesson" is
  // left out; an unclassified one is offered, because unclassified means
  // nobody has looked, not that it was judged irrelevant.
  const loose = (paymentsRes.data ?? []).filter(
    (p) => !p.package_id && !p.lesson_id && p.kind !== "not_lesson",
  );

  // Words that actually tell one client from another. "Sprague" is useless
  // when the book holds "Calli Sprague- weston Sprague"; a word only one
  // client uses is worth trusting.
  const owners = new Map<string, Set<string>>();
  for (const [id, c] of client) {
    for (const w of nameWords(c.name)) {
      if (!owners.has(w)) owners.set(w, new Set());
      owners.get(w)!.add(id);
    }
  }

  const gapDays = (paidOn: string, startsAt: string) =>
    Math.round(
      (new Date(paidOn).getTime() - new Date(startsAt).getTime()) / 86400000,
    );

  const toCandidate = (p: Row, startsAt: string, why: string): LedgerCandidate => ({
    id: p.id as string,
    payerName: (p.payer_name as string) ?? "",
    note: (p.note as string) ?? "",
    amountCents: num(p.amount_cents),
    paidOn: String(p.paid_on),
    dayGap: gapDays(String(p.paid_on), startsAt),
    why,
  });

  // Two lessons for one client at one moment: nobody is on the tee twice.
  const seenSlot = new Map<string, string>();

  const rows: LedgerRow[] = lessons.map((l) => {
    const clientId = (l.client_id as string | null) ?? null;
    const who = clientId ? client.get(clientId) : undefined;
    const startsAt = l.starts_at as string;
    const raw = l.package_id ? pkg.get(l.package_id as string) : undefined;
    const hints = readTitle(l.title_raw as string | null);

    const slot = `${clientId ?? "?"}|${startsAt}`;
    const duplicateOf = seenSlot.get(slot) ?? null;
    if (!duplicateOf) seenSlot.set(slot, l.id as string);

    let candidates: LedgerCandidate[] = [];
    if (clientId && who && !raw) {
      const telling = nameWords(who.name).filter((w) => owners.get(w)?.size === 1);
      const any = new Set(nameWords(who.name));
      candidates = loose
        .map((p) => {
          const payer = new Set([...nameWords(p.payer_name), ...nameWords(p.note)]);
          const strong = telling.some((w) => payer.has(w));
          const weak = [...any].some((w) => payer.has(w));
          if (!strong && !weak) return null;
          const gap = gapDays(String(p.paid_on), startsAt);
          // Up to two months early (a package bought in advance) or three
          // weeks late (he had to chase it).
          if (gap < -62 || gap > 21) return null;
          const when =
            gap === 0
              ? "same day"
              : `${Math.abs(gap)} day${Math.abs(gap) === 1 ? "" : "s"} ${gap < 0 ? "before" : "after"}`;
          return {
            cand: toCandidate(p, startsAt, strong ? `${when}, name matches` : when),
            score: (strong ? 0 : 1000) + Math.abs(gap),
          };
        })
        .filter((x): x is { cand: LedgerCandidate; score: number } => x !== null)
        .sort((a, b) => a.score - b.score)
        .slice(0, 4)
        .map((x) => x.cand);
    }

    const size = raw ? num(raw.size) : 0;
    const used = raw ? (usedBy.get(raw.id as string) ?? 0) : 0;
    const prior = clientId ? last.get(clientId) : undefined;
    return {
      id: l.id as string,
      startsAt,
      status: ((l.status as string) ?? "completed") as LessonStatus,
      titleRaw: str(l.title_raw),
      clientId,
      clientName: who?.name ?? "(no client)",
      isMember: who?.isMember ?? false,
      pack: raw
        ? {
            id: raw.id as string,
            kind: ((raw.kind as string) ?? "package") as "package" | "single",
            size,
            used,
            left: Math.max(0, size - used),
            priceCents: raw.price_cents == null ? null : num(raw.price_cents),
            paymentStatus: ((raw.payment_status as string) ?? "unpaid") as PaymentStatus,
            paymentMethod: str(raw.payment_method),
            soldOn: str(raw.sold_on),
            paidOn: str(raw.paid_on),
          }
        : null,
      hint: hintSummary(hints),
      hintSize: hints.size,
      hintPaid: hints.paid,
      candidates,
      lastPriceCents: prior?.priceCents ?? null,
      lastMethod: prior?.method ?? null,
      duplicateOf,
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  return {
    rows,
    unbilledCount: rows.filter(
      (r) => !r.pack && r.startsAt.slice(0, 10) <= today && r.status !== "cancelled",
    ).length,
    loose: loose
      .slice()
      .sort((a, b) => String(b.paid_on).localeCompare(String(a.paid_on)))
      .map((p) => toCandidate(p, now, "")),
  };
}

/** Lower-case words of three letters or more: the parts worth matching on. */
function nameWords(s: unknown): string[] {
  return String(s ?? "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2);
}

/**
 * Venmo payments, newest first.
 *
 * Unanswered ones come first regardless of date: the list exists to be worked
 * through, and burying the undecided rows among months of settled history is
 * how a reconciliation never gets finished.
 */
export async function listPayments(): Promise<import("./types").PaymentRec[]> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lesson_payments")
    .select("*, lesson_clients(name)")
    .order("paid_on", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => ({
    id: r.id as string,
    paidOn: r.paid_on as string,
    payerName: (r.payer_name as string) ?? "",
    note: (r.note as string) ?? "",
    amountCents: Number(r.amount_cents ?? 0),
    kind: ((r.kind as string) ?? "unclassified") as import("./types").PaymentKind,
    clientId: str(r.client_id),
    clientName: ((r.lesson_clients as { name?: string } | null)?.name as string) ?? null,
    packageId: str(r.package_id),
    lessonId: str(r.lesson_id),
    decidedBy: ((r.decided_by as string) ?? "auto") as "auto" | "ian",
  }));

  return rows.sort((a, b) => {
    const aTodo = a.decidedBy === "auto" ? 0 : 1;
    const bTodo = b.decidedBy === "auto" ? 0 : 1;
    if (aTodo !== bTodo) return aTodo - bTodo;
    return b.paidOn.localeCompare(a.paidOn);
  });
}

/**
 * Every package, with the span of lessons inside it, for the screen that
 * puts Venmo payments against bills.
 *
 * All of them, not just the unpaid ones: a package can be marked paid from
 * the shop and still be the thing a Venmo payment belongs to, and hiding it
 * would leave Ian unable to say so.
 */
export async function listPackageOptions(): Promise<
  import("./types").PackageOption[]
> {
  const supa = await lessonBookClient();
  const [{ data: pkgs, error: pErr }, { data: lessons, error: lErr }] =
    await Promise.all([
      supa
        .from("lesson_packages")
        .select("id, client_id, kind, size, price_cents, payment_status, sold_on"),
      supa
        .from("lessons")
        .select("package_id, starts_at, status")
        .not("package_id", "is", null),
    ]);
  if (pErr) throw new Error(pErr.message);
  if (lErr) throw new Error(lErr.message);

  const span = new Map<string, { first: string; last: string; used: number }>();
  for (const l of lessons ?? []) {
    const id = l.package_id as string;
    const at = l.starts_at as string;
    const s = span.get(id);
    if (!s) span.set(id, { first: at, last: at, used: 0 });
    else {
      if (at < s.first) s.first = at;
      if (at > s.last) s.last = at;
    }
    // A cancelled lesson still sits in the series but was never taught.
    if (l.status === "completed" || l.status === "scheduled") {
      span.get(id)!.used += 1;
    }
  }

  return (pkgs ?? []).map((p) => {
    const s = span.get(p.id as string);
    return {
      id: p.id as string,
      clientId: p.client_id as string,
      kind: ((p.kind as string) ?? "package") as "package" | "single",
      size: Number(p.size ?? 1),
      priceCents: p.price_cents == null ? null : Number(p.price_cents),
      paymentStatus: ((p.payment_status as string) ??
        "unpaid") as import("./types").PaymentStatus,
      soldOn: str(p.sold_on),
      used: s?.used ?? 0,
      firstLessonAt: s?.first ?? null,
      lastLessonAt: s?.last ?? null,
    };
  });
}
