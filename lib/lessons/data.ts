import { lessonBookClient } from "./db";
import type {
  ClientRec,
  ClientSummary,
  LessonRec,
  LessonStatus,
  PackageRec,
  PaymentStatus,
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

/**
 * One client's lessons, newest first.
 *
 * The name is joined in rather than copied onto the lesson, so a rename shows
 * everywhere at once instead of leaving history behind under the old spelling.
 */
export async function clientLessons(clientId: string): Promise<LessonRec[]> {
  const supa = await lessonBookClient();
  const { data, error } = await supa
    .from("lessons")
    .select("*, lesson_clients(name)")
    .eq("client_id", clientId)
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    clientId: str(r.client_id),
    clientName:
      ((r.lesson_clients as { name?: string } | null)?.name as string) ?? "",
    packageId: str(r.package_id),
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    status: ((r.status as string) ?? "completed") as LessonStatus,
    titleRaw: str(r.title_raw),
    calendarUid: str(r.calendar_uid),
  }));
}

export interface Dashboard {
  owedCents: number;
  unpaidPackages: number;
  pendingPackages: number;
  activeClients: number;
  lessonsThisMonth: number;
  upcoming: number;
  chase: PackageRec[];
  runningOut: PackageRec[];
  unpriced: number;
}

/**
 * The front page: who owes money, and whose package is about to run out.
 *
 * Those are the two things that cost Ian if he misses them - an unpaid package
 * is income not collected, and a finished one is the moment to sell the next.
 */
export async function dashboard(): Promise<Dashboard> {
  const supa = await lessonBookClient();
  const [packages, summaries] = await Promise.all([
    listPackages(),
    listClientSummaries(),
  ]);

  // Month boundary in course time, not the server's: on Vercel (UTC) the first
  // of the month starts seven hours early and drags in the previous month.
  const now = new Date();
  const ym = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  const monthStart = `${ym}-01T00:00:00`;

  const [{ count: thisMonth }, { count: upcoming }] = await Promise.all([
    supa
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", monthStart)
      .lte("starts_at", now.toISOString()),
    supa
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .gt("starts_at", now.toISOString()),
  ]);

  const owing = packages.filter((p) => p.paymentStatus !== "paid");

  return {
    owedCents: owing.reduce((t, p) => t + (p.priceCents ?? 0), 0),
    unpaidPackages: packages.filter((p) => p.paymentStatus === "unpaid").length,
    pendingPackages: packages.filter((p) => p.paymentStatus === "pending")
      .length,
    activeClients: summaries.filter((s) => s.active).length,
    lessonsThisMonth: thisMonth ?? 0,
    upcoming: upcoming ?? 0,
    // Biggest debts first. A package with no price recorded sorts last rather
    // than counting as zero, which would make it look settled.
    chase: owing
      .slice()
      .sort((a, b) => (b.priceCents ?? -1) - (a.priceCents ?? -1))
      .slice(0, 12),
    runningOut: packages
      .filter((p) => !p.isComplete && p.remaining <= 1)
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 12),
    // The reconciliation backlog, stated plainly rather than buried in a total.
    unpriced: packages.filter((p) => p.priceCents === null).length,
  };
}
