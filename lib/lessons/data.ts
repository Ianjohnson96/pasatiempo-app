import { createLessonsClient } from "@/lib/supabase/admin";
import type {
  LessonRec,
  LessonStatus,
  PendingRec,
  StudentRec,
  StudentSummary,
} from "./types";

// Read-side queries for the lesson book. Server components call these; every
// one runs through the schema-pinned service_role client, so the browser never
// touches these tables directly.
//
// The money model is PER LESSON. What a student owes is the sum of their
// priced, delivered, unpaid lessons - it is never derived from the payments
// log, which exists only to reconcile against what Venmo actually received.

function rowToStudent(r: Record<string, unknown>): StudentRec {
  return {
    id: r.id as string,
    name: r.name as string,
    aliases: (r.aliases as string[] | null) ?? [],
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    active: r.active !== false,
    notes: (r.notes as string | null) ?? "",
  };
}

function rowToLesson(
  r: Record<string, unknown>,
  nameFor: (id: string) => string,
): LessonRec {
  const sid = r.student_id as string;
  return {
    id: r.id as string,
    studentId: sid,
    studentName: nameFor(sid),
    eventKey: r.event_key as string,
    startsAt: r.starts_at as string,
    minutes: (r.minutes as number) ?? 0,
    title: (r.title as string | null) ?? "",
    calendar: (r.calendar as string | null) ?? "",
    status: ((r.status as string) ?? "delivered") as LessonStatus,
    // numeric(10,2) arrives from PostgREST as a string, so it has to be parsed:
    // left alone it would concatenate rather than add in every total below.
    amount: r.amount === null || r.amount === undefined ? null : Number(r.amount),
    paid: r.paid === true,
    paidAt: (r.paid_at as string | null) ?? null,
    series: (r.series as string | null) ?? null,
    seq: (r.seq as number | null) ?? null,
    seqOf: (r.seq_of as number | null) ?? null,
  };
}

export async function listStudents(): Promise<StudentRec[]> {
  const supa = createLessonsClient();
  const { data, error } = await supa.from("students").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToStudent);
}

/**
 * Every lesson, newest first, with the student's name attached.
 *
 * `voided` and `removed` rows are excluded by default: they are history, not
 * teaching, and counting them would inflate both the lesson count and the
 * amount owed.
 */
export async function listLessons(opts?: {
  studentId?: string;
  includeVoided?: boolean;
  limit?: number;
}): Promise<LessonRec[]> {
  const supa = createLessonsClient();
  const students = await listStudents();
  const names = new Map(students.map((s) => [s.id, s.name]));

  let q = supa.from("lessons").select("*").order("starts_at", { ascending: false });
  if (opts?.studentId) q = q.eq("student_id", opts.studentId);
  if (!opts?.includeVoided) q = q.in("status", ["scheduled", "delivered"]);
  if (opts?.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToLesson(r, (id) => names.get(id) ?? "Unknown"));
}

/**
 * The roster with the numbers Ian asks about: how many lessons, how many still
 * need a price, and what is owed.
 *
 * Totalled in one pass here rather than per student in SQL - the book is a few
 * hundred lessons, and a round trip per student would cost far more than the
 * single scan.
 */
export async function studentSummaries(): Promise<StudentSummary[]> {
  const [students, lessons] = await Promise.all([listStudents(), listLessons()]);

  const blank = () => ({
    lessons: 0,
    unpriced: 0,
    owed: 0,
    paidTotal: 0,
    lastLesson: null as string | null,
  });
  const totals = new Map(students.map((s) => [s.id, blank()]));

  for (const l of lessons) {
    const t = totals.get(l.studentId);
    if (!t) continue;
    t.lessons += 1;
    // A lesson not yet taught is neither owed nor missing a price.
    if (l.status === "delivered") {
      if (l.amount === null) t.unpriced += 1;
      else if (l.paid) t.paidTotal += l.amount;
      else t.owed += l.amount;
    }
    // listLessons returns newest first, so the first one seen is the latest.
    if (!t.lastLesson) t.lastLesson = l.startsAt;
  }

  return students.map((s) => ({ ...s, ...(totals.get(s.id) ?? blank()) }));
}

/** The confirm queue: calendar events that might be lessons. */
export async function listPending(): Promise<PendingRec[]> {
  const supa = createLessonsClient();
  const { data, error } = await supa
    .from("pending")
    .select("*")
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    eventKey: r.event_key as string,
    startsAt: r.starts_at as string,
    minutes: (r.minutes as number) ?? 0,
    title: (r.title as string) ?? "",
    calendar: (r.calendar as string | null) ?? "",
    guess: (r.guess as string | null) ?? null,
  }));
}

/** Badge count for the Confirm tab. Cheap: a head request, no rows returned. */
export async function pendingCount(): Promise<number> {
  const supa = createLessonsClient();
  const { count, error } = await supa
    .from("pending")
    .select("event_key", { count: "exact", head: true });
  // A badge is not worth failing a page render over.
  if (error) return 0;
  return count ?? 0;
}

/** Top-line numbers for the header strip. */
export async function bookTotals(): Promise<{
  lessons: number;
  unpriced: number;
  owed: number;
  paidTotal: number;
}> {
  const lessons = await listLessons();
  let unpriced = 0;
  let owed = 0;
  let paidTotal = 0;
  let delivered = 0;
  for (const l of lessons) {
    if (l.status !== "delivered") continue;
    delivered += 1;
    if (l.amount === null) unpriced += 1;
    else if (l.paid) paidTotal += l.amount;
    else owed += l.amount;
  }
  return { lessons: delivered, unpriced, owed, paidTotal };
}
