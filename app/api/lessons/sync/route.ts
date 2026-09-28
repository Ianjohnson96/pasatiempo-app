import { NextResponse, type NextRequest } from "next/server";
import { createLessonsClient } from "@/lib/supabase/admin";

// Ingest for the lesson book. An Apps Script bound to Ian's Google account
// reads his calendar (and Venmo receipt emails) and POSTs the result here.
//
// Why a script rather than a cron in this app: reading Google Calendar needs
// Google OAuth, and the Apps Script already has it - it runs as Ian, for free,
// with no tokens to store or refresh. This endpoint is the only thing that
// knows about that arrangement; everything downstream just reads Postgres.
//
// The money fields are NEVER written here. `amount` and `paid` are Ian's, and
// the calendar knows nothing about them - a sync that overwrote them would
// silently wipe a day's pricing.
//
// Idempotent: lessons upsert on `event_key` (calendar event id + start time),
// so re-running changes nothing the second time.

export const dynamic = "force-dynamic";

// Same shape as the caddie/merch crons: a bearer secret, and closed by default
// when the secret is unset rather than open to anyone who finds the URL.
function authorised(request: NextRequest): boolean {
  const secret = process.env.LESSONS_SYNC_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

interface InStudent {
  name: string;
  aliases?: string[];
  email?: string | null;
  active?: boolean;
}

interface InLesson {
  student: string;
  event_key: string;
  starts_at: string;
  minutes: number;
  title?: string;
  calendar?: string;
  status?: "scheduled" | "delivered" | "voided" | "removed";
  series?: string | null;
  seq?: number | null;
  seq_of?: number | null;
}

interface InPending {
  event_key: string;
  starts_at: string;
  minutes: number;
  title: string;
  calendar?: string;
  guess?: string | null;
}

interface Payload {
  students?: InStudent[];
  lessons?: InLesson[];
  pending?: InPending[];
  ignored?: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export async function POST(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const supa = createLessonsClient();
  const out = { students: 0, lessons: 0, pending: 0, ignored: 0, skipped: [] as string[] };

  // ---- students -----------------------------------------------------------
  // Uniqueness is a case-insensitive expression index, which onConflict cannot
  // name, so compare against what is already stored and insert only the new.
  const students = (body.students ?? []).filter((s) => s?.name?.trim());
  if (students.length) {
    const { data: have, error: hErr } = await supa.from("students").select("name");
    if (hErr) return NextResponse.json({ error: hErr.message, at: "students.read" }, { status: 500 });

    const known = new Set((have ?? []).map((r) => norm(r.name as string)));
    const fresh = students.filter((s) => !known.has(norm(s.name)));
    if (fresh.length) {
      const { error } = await supa.from("students").insert(
        fresh.map((s) => ({
          name: s.name.trim(),
          aliases: s.aliases ?? [],
          email: s.email ?? null,
          active: s.active ?? true,
        })),
      );
      if (error) return NextResponse.json({ error: error.message, at: "students" }, { status: 500 });
    }
    out.students = fresh.length;
  }

  // Map names AND aliases to ids so lessons can be attached to the right row.
  const { data: roster, error: rErr } = await supa.from("students").select("id, name, aliases");
  if (rErr) return NextResponse.json({ error: rErr.message, at: "roster" }, { status: 500 });

  const byName = new Map<string, string>();
  for (const s of roster ?? []) {
    byName.set(norm(s.name as string), s.id as string);
    for (const a of (s.aliases as string[] | null) ?? []) {
      if (a?.trim()) byName.set(norm(a), s.id as string);
    }
  }

  // ---- lessons ------------------------------------------------------------
  const lessons = (body.lessons ?? []).filter((l) => l?.event_key && l?.student);
  if (lessons.length) {
    const rows: Record<string, unknown>[] = [];
    for (const l of lessons) {
      const sid = byName.get(norm(l.student));
      if (!sid) {
        // Reporting an unknown name beats inventing a student and corrupting totals.
        if (!out.skipped.includes(l.student)) out.skipped.push(l.student);
        continue;
      }
      rows.push({
        student_id: sid,
        event_key: l.event_key,
        starts_at: l.starts_at,
        minutes: l.minutes,
        title: l.title ?? "",
        calendar: l.calendar ?? "",
        status: l.status ?? "delivered",
        series: l.series ?? null,
        seq: l.seq ?? null,
        seq_of: l.seq_of ?? null,
        synced_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      // Deliberately omits amount/paid: on an existing row they keep their
      // stored values, on a new row they default to null/false.
      const { error } = await supa
        .from("lessons")
        .upsert(rows, { onConflict: "event_key", ignoreDuplicates: false });
      if (error) return NextResponse.json({ error: error.message, at: "lessons" }, { status: 500 });
      out.lessons = rows.length;
    }
  }

  // ---- confirm queue ------------------------------------------------------
  const pending = (body.pending ?? []).filter((p) => p?.event_key);
  if (pending.length) {
    const { error } = await supa.from("pending").upsert(
      pending.map((p) => ({
        event_key: p.event_key,
        starts_at: p.starts_at,
        minutes: p.minutes,
        title: p.title,
        calendar: p.calendar ?? "",
        guess: p.guess ?? null,
      })),
      { onConflict: "event_key", ignoreDuplicates: true },
    );
    if (error) return NextResponse.json({ error: error.message, at: "pending" }, { status: 500 });
    out.pending = pending.length;
  }

  // ---- ignored titles -----------------------------------------------------
  const ignored = (body.ignored ?? []).filter(Boolean);
  if (ignored.length) {
    const { error } = await supa.from("ignored").upsert(
      ignored.map((t) => ({ title_norm: norm(t), title: t })),
      { onConflict: "title_norm", ignoreDuplicates: true },
    );
    if (error) return NextResponse.json({ error: error.message, at: "ignored" }, { status: 500 });
    out.ignored = ignored.length;
  }

  return NextResponse.json({ ok: true, ...out });
}
