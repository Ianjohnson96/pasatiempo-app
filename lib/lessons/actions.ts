"use server";

import { revalidatePath } from "next/cache";
import { createLessonsClient } from "@/lib/supabase/admin";
import { assertLessonBook } from "./auth";
import type { Result } from "./types";

// Write-side for the lesson book. Every mutation Ian makes goes through here.
//
// Each action calls assertLessonBook() first. Server actions are public
// endpoints - the page check that got him to the screen protects nothing.

const BOOK = "/lessons";
const LOG = "/lessons/log";
const CONFIRM = "/lessons/confirm";

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : fallback;
  return { ok: false, error: msg };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Set (or clear) what a lesson cost.
 *
 * Clearing the price of a lesson already marked paid also clears `paid`: the
 * database forbids that pair outright (`paid_needs_amount`), and paid with no
 * amount would silently count as zero income.
 */
export async function setLessonAmount(
  id: string,
  amount: number | null,
): Promise<Result> {
  try {
    await assertLessonBook();
    if (amount !== null && (!isFinite(amount) || amount < 0)) {
      return { ok: false, error: "That is not a valid price." };
    }
    const patch: Record<string, unknown> =
      amount === null ? { amount: null, paid: false, paid_at: null } : { amount };

    const { error } = await createLessonsClient()
      .from("lessons")
      .update(patch)
      .eq("id", id);
    if (error) throw error;

    revalidatePath(BOOK);
    revalidatePath(LOG);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save that price.");
  }
}

/**
 * Tick or untick paid.
 *
 * Refused when no price is set: the database would reject it anyway, and a
 * plain sentence beats surfacing a constraint violation.
 */
export async function setLessonPaid(id: string, paid: boolean): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = createLessonsClient();

    if (paid) {
      const { data, error: rErr } = await supa
        .from("lessons")
        .select("amount")
        .eq("id", id)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!data) return { ok: false, error: "That lesson no longer exists." };
      if (data.amount === null) {
        return { ok: false, error: "Set a price before marking it paid." };
      }
    }

    const { error } = await supa
      .from("lessons")
      .update({ paid, paid_at: paid ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) throw error;

    revalidatePath(BOOK);
    revalidatePath(LOG);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not update that lesson.");
  }
}

/**
 * Price a batch at once - the "all of these were $120" case, which is most of
 * them.
 */
export async function setAmountBulk(
  ids: string[],
  amount: number,
): Promise<Result<number>> {
  try {
    await assertLessonBook();
    if (!ids.length) return { ok: true, value: 0 };
    if (!isFinite(amount) || amount < 0) {
      return { ok: false, error: "That is not a valid price." };
    }
    const { error } = await createLessonsClient()
      .from("lessons")
      .update({ amount })
      .in("id", ids);
    if (error) throw error;

    revalidatePath(BOOK);
    revalidatePath(LOG);
    return { ok: true, value: ids.length };
  } catch (e) {
    return fail(e, "Could not price those lessons.");
  }
}

/**
 * Mark a batch paid - "he settled up for the month".
 *
 * Unpriced lessons are skipped rather than failing the whole batch, and the
 * count returned is how many actually moved, so the reply can be honest about
 * a partial result instead of implying everything was covered.
 */
export async function markPaidBulk(ids: string[]): Promise<Result<number>> {
  try {
    await assertLessonBook();
    if (!ids.length) return { ok: true, value: 0 };
    const supa = createLessonsClient();

    const { data, error: rErr } = await supa
      .from("lessons")
      .select("id")
      .in("id", ids)
      .not("amount", "is", null);
    if (rErr) throw rErr;

    const priced = (data ?? []).map((r) => r.id as string);
    if (!priced.length) {
      return { ok: false, error: "None of those have a price set yet." };
    }

    const { error } = await supa
      .from("lessons")
      .update({ paid: true, paid_at: new Date().toISOString() })
      .in("id", priced);
    if (error) throw error;

    revalidatePath(BOOK);
    revalidatePath(LOG);
    return { ok: true, value: priced.length };
  } catch (e) {
    return fail(e, "Could not mark those paid.");
  }
}

/**
 * Drop a lesson from the book without deleting it.
 *
 * `voided` rather than a delete, because the calendar event still exists: a
 * deleted row would simply come back on the next sync, which upserts by
 * event_key. Voided rows are filtered out of every total.
 */
export async function voidLesson(id: string): Promise<Result> {
  try {
    await assertLessonBook();
    const { error } = await createLessonsClient()
      .from("lessons")
      .update({ status: "voided" })
      .eq("id", id);
    if (error) throw error;

    revalidatePath(BOOK);
    revalidatePath(LOG);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not remove that lesson.");
  }
}

/** Contact details and notes for a student. */
export async function updateStudent(
  id: string,
  patch: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    notes?: string;
    active?: boolean;
  },
): Promise<Result> {
  try {
    await assertLessonBook();
    const fields: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) return { ok: false, error: "A student needs a name." };
      fields.name = n;
    }
    if (patch.email !== undefined) fields.email = patch.email?.trim() || null;
    if (patch.phone !== undefined) fields.phone = patch.phone?.trim() || null;
    if (patch.notes !== undefined) fields.notes = patch.notes;
    if (patch.active !== undefined) fields.active = patch.active;
    if (!Object.keys(fields).length) return { ok: true, value: undefined };

    const { error } = await createLessonsClient()
      .from("students")
      .update(fields)
      .eq("id", id);
    if (error) {
      // The unique index is on lower(btrim(name)), so a clash here means a
      // student by that name already exists under different casing.
      if (String(error.message).includes("students_name_key")) {
        return { ok: false, error: "There is already a student with that name." };
      }
      throw error;
    }

    revalidatePath(BOOK);
    revalidatePath(LOG);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save that student.");
  }
}

/**
 * "Yes, that was a lesson." Attaches the pending event to a student - an
 * existing one by id, or a new one by name - and clears it from the queue.
 */
export async function confirmPending(
  eventKey: string,
  student: { id?: string; name?: string },
): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = createLessonsClient();

    const { data: p, error: pErr } = await supa
      .from("pending")
      .select("*")
      .eq("event_key", eventKey)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!p) return { ok: false, error: "That one has already been answered." };

    let studentId = student.id;
    if (!studentId) {
      const name = (student.name ?? "").trim();
      if (!name) return { ok: false, error: "Pick a student, or type a new name." };

      // Match case-insensitively first: uniqueness is an expression index, so
      // inserting a differently-cased duplicate would just error out.
      const { data: existing, error: sErr } = await supa
        .from("students")
        .select("id, name");
      if (sErr) throw sErr;
      const hit = (existing ?? []).find((s) => norm(s.name as string) === norm(name));

      if (hit) {
        studentId = hit.id as string;
      } else {
        const { data: made, error: iErr } = await supa
          .from("students")
          .insert({ name })
          .select("id")
          .single();
        if (iErr) throw iErr;
        studentId = made.id as string;
      }
    }

    const { error: lErr } = await supa.from("lessons").upsert(
      {
        student_id: studentId,
        event_key: p.event_key,
        starts_at: p.starts_at,
        minutes: p.minutes,
        title: p.title,
        calendar: p.calendar ?? "",
        status: "delivered",
      },
      { onConflict: "event_key" },
    );
    if (lErr) throw lErr;

    // Only now: if the insert had failed, the item must stay in the queue
    // rather than vanishing unanswered.
    const { error: dErr } = await supa
      .from("pending")
      .delete()
      .eq("event_key", eventKey);
    if (dErr) throw dErr;

    revalidatePath(BOOK);
    revalidatePath(LOG);
    revalidatePath(CONFIRM);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not confirm that one.");
  }
}

/**
 * "No, that was not a lesson."
 *
 * With `never`, the title is remembered in `ignored` so the next sync stops
 * asking - the difference between answering once and answering every week.
 */
export async function rejectPending(
  eventKey: string,
  never: boolean,
): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = createLessonsClient();

    if (never) {
      const { data: p, error: pErr } = await supa
        .from("pending")
        .select("title")
        .eq("event_key", eventKey)
        .maybeSingle();
      if (pErr) throw pErr;
      const title = (p?.title as string | undefined)?.trim();
      if (title) {
        const { error: iErr } = await supa
          .from("ignored")
          .upsert(
            { title_norm: norm(title), title },
            { onConflict: "title_norm", ignoreDuplicates: true },
          );
        if (iErr) throw iErr;
      }
    }

    const { error } = await supa.from("pending").delete().eq("event_key", eventKey);
    if (error) throw error;

    revalidatePath(CONFIRM);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not dismiss that one.");
  }
}
