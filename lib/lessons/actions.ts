"use server";

import { revalidatePath } from "next/cache";
import { lessonBookClient } from "./db";
import { assertLessonBook } from "./auth";
import { standardPrices } from "./data";
import { syncLessons } from "./sync";
import { logActivity } from "@/lib/hub/log";
import {
  aliasClash,
  cleanAliases,
  courseLocalIso,
  matchExisting,
  parseDollars,
} from "./calc";
import type { PaymentStatus, Result } from "./types";

// Write-side for the lesson book.
//
// Money attaches to PACKAGES, never to lessons: Ian sells 3, 5 or 10 and is
// paid once, up front. There is deliberately no "mark this lesson paid".
//
// Each action asserts access before touching anything. RLS would stop a
// stranger anyway, but a server action is a public endpoint and the page check
// that got Ian to the screen protects nothing on its own.

const BOOK = "/lessons";
const CLIENTS = "/lessons/clients";
const REVIEW = "/lessons/review";
const PRICES = "/lessons/prices";
const SCHEDULE = "/lessons/schedule";

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : fallback;
  return { ok: false, error: msg };
}

function touched(clientId?: string) {
  revalidatePath(BOOK);
  revalidatePath(CLIENTS);
  revalidatePath(PRICES);
  revalidatePath(SCHEDULE);
  if (clientId) revalidatePath(`${CLIENTS}/${clientId}`);
}

/** Compare names the way a person would: case and spacing are not identity. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Today in course time - "paid today" must not become tomorrow on a UTC server. */
function courseToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Move a package between unpaid / pending / paid.
 *
 * `pending` is a real state, not a halfway house: a member charge submitted to
 * the club but not yet posted is neither collected nor outstanding, and
 * flattening it either way misstates what Ian is owed.
 */
export async function setPackagePayment(
  packageId: string,
  status: PaymentStatus,
  opts?: { method?: string | null; clientId?: string },
): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();

    const patch: Record<string, unknown> = { payment_status: status };
    // paid_on only means something once it is actually paid; a stale date left
    // on a reverted package would misreport when the money arrived.
    patch.paid_on = status === "paid" ? courseToday() : null;
    if (opts?.method !== undefined) patch.payment_method = opts.method;

    const { error } = await supa
      .from("lesson_packages")
      .update(patch)
      .eq("id", packageId);
    if (error) throw error;

    touched(opts?.clientId);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not update that package.");
  }
}

/**
 * Set what a package sold for.
 *
 * Takes dollars from the form and stores integer cents, so a price cannot
 * drift by a rounding error the way a float would.
 */
export async function setPackagePrice(
  packageId: string,
  dollars: number | null,
  clientId?: string,
): Promise<Result> {
  try {
    await assertLessonBook();
    if (dollars !== null && (!isFinite(dollars) || dollars < 0)) {
      return { ok: false, error: "That is not a valid price." };
    }
    const supa = await lessonBookClient();
    const { error } = await supa
      .from("lesson_packages")
      .update({
        price_cents: dollars === null ? null : Math.round(dollars * 100),
      })
      .eq("id", packageId);
    if (error) throw error;

    touched(clientId);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save that price.");
  }
}

/**
 * Correct how many lessons a package holds.
 *
 * 20 of the 43 seeded packages have a size inferred from the highest lesson
 * number seen rather than stated, so this is a correction tool, not an edge
 * case.
 */
export async function setPackageSize(
  packageId: string,
  size: number,
  clientId?: string,
): Promise<Result> {
  try {
    await assertLessonBook();
    if (!Number.isInteger(size) || size < 1 || size > 50) {
      return { ok: false, error: "A package holds between 1 and 50 lessons." };
    }
    const supa = await lessonBookClient();
    const { error } = await supa
      .from("lesson_packages")
      .update({ size })
      .eq("id", packageId);
    if (error) throw error;

    touched(clientId);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not change that package size.");
  }
}

export async function createPackage(
  clientId: string,
  input: { size: number; dollars?: number | null; label?: string | null },
): Promise<Result<string>> {
  try {
    await assertLessonBook();
    if (!Number.isInteger(input.size) || input.size < 1 || input.size > 50) {
      return { ok: false, error: "A package holds between 1 and 50 lessons." };
    }
    const supa = await lessonBookClient();

    // No price typed: use the standard price for this size, if Ian has set
    // one. Most packages sell at standard; the rest get edited on the card.
    const typed = parseDollars(input.dollars);
    if (!typed.ok) return { ok: false, error: "That is not a valid price." };
    let priceCents = typed.cents;
    if (priceCents === null) {
      const standard = await standardPrices();
      priceCents = standard[input.size] ?? null;
    }

    const { data, error } = await supa
      .from("lesson_packages")
      .insert({
        client_id: clientId,
        size: input.size,
        label: input.label?.trim() || null,
        price_cents: priceCents,
        sold_on: courseToday(),
        payment_status: "unpaid",
      })
      .select("id")
      .single();
    if (error) throw error;

    touched(clientId);
    return { ok: true, value: data.id as string };
  } catch (e) {
    return fail(e, "Could not create that package.");
  }
}

/**
 * Attach a lesson to a package, or detach it (null = a one-off).
 *
 * 149 lessons arrived with no package because their titles never said so.
 * Attaching one moves the package's used and remaining counts, which is how an
 * untracked series gets reconstructed.
 */
export async function assignLessonToPackage(
  lessonId: string,
  packageId: string | null,
  clientId?: string,
): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();
    const { error } = await supa
      .from("lessons")
      .update({ package_id: packageId })
      .eq("id", lessonId);
    if (error) throw error;

    touched(clientId);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not move that lesson.");
  }
}

export async function updateClient(
  id: string,
  patch: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    memberNumber?: string | null;
    isMember?: boolean;
    active?: boolean;
    notes?: string | null;
    /** Other spellings the calendar uses for this client. */
    aliases?: string[];
  },
): Promise<Result> {
  try {
    await assertLessonBook();
    const fields: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) return { ok: false, error: "A client needs a name." };
      fields.name = n;
    }
    if (patch.email !== undefined) fields.email = patch.email?.trim() || null;
    if (patch.phone !== undefined) fields.phone = patch.phone?.trim() || null;
    if (patch.memberNumber !== undefined)
      fields.member_number = patch.memberNumber?.trim() || null;
    if (patch.isMember !== undefined) fields.is_member = patch.isMember;
    if (patch.active !== undefined) fields.active = patch.active;
    if (patch.notes !== undefined) fields.notes = patch.notes?.trim() || null;
    if (!Object.keys(fields).length && patch.aliases === undefined) {
      return { ok: true, value: undefined };
    }

    const supa = await lessonBookClient();

    if (patch.aliases !== undefined) {
      // Checked against everyone else: a spelling two clients share would
      // make the sync file lessons under whichever it met last.
      const { data: all, error: aErr } = await supa
        .from("lesson_clients")
        .select("id, name, aliases");
      if (aErr) throw aErr;
      const me = (all ?? []).find((c) => c.id === id);
      const ownName = (fields.name as string) ?? (me?.name as string) ?? "";
      const aliases = cleanAliases(patch.aliases, ownName);
      const clash = aliasClash(
        aliases,
        id,
        (all ?? []).map((c) => ({
          id: c.id as string,
          name: c.name as string,
          aliases: (c.aliases as string[] | null) ?? [],
        })),
      );
      if (clash) return { ok: false, error: clash };
      fields.aliases = aliases;
    }

    const { error } = await supa
      .from("lesson_clients")
      .update(fields)
      .eq("id", id);
    if (error) throw error;

    touched(id);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save that client.");
  }
}

/**
 * "Yes, this was a lesson." Turns a queued calendar entry into a real lesson
 * against a client Ian picks - an existing one, or a new one by name.
 *
 * The lesson is created with no package. Which series it belongs to is a
 * separate decision, made on the client screen, because attaching it moves
 * somebody's remaining count.
 */
export async function resolveReview(
  calendarUid: string,
  client: { id?: string; name?: string },
): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();

    const { data: row, error: rErr } = await supa
      .from("lesson_review")
      .select("*")
      .eq("calendar_uid", calendarUid)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!row) return { ok: false, error: "That one has already been answered." };

    let clientId = client.id;
    if (!clientId) {
      const name = (client.name ?? "").trim();
      if (!name) return { ok: false, error: "Pick a client, or type a new name." };

      // Match case-insensitively first, or a differently-cased duplicate gets
      // created alongside the person who is already there.
      const { data: all, error: cErr } = await supa
        .from("lesson_clients")
        .select("id, name");
      if (cErr) throw cErr;
      const hit = (all ?? []).find((c) => norm(c.name as string) === norm(name));

      if (hit) {
        clientId = hit.id as string;
      } else {
        const { data: made, error: iErr } = await supa
          .from("lesson_clients")
          .insert({ name })
          .select("id")
          .single();
        if (iErr) throw iErr;
        clientId = made.id as string;
      }
    }

    const startsAt = row.starts_at as string;

    // The seeded lessons carry no calendar link, so most queued entries are
    // lessons already in the book. Inserting would count them twice: adopt
    // the existing one for this client at this moment instead.
    const { data: seeded, error: sErr } = await supa
      .from("lessons")
      .select("id")
      .eq("client_id", clientId)
      .eq("starts_at", startsAt)
      .is("calendar_uid", null)
      .limit(1);
    if (sErr) throw sErr;

    const { error: lErr } = seeded?.length
      ? await supa
          .from("lessons")
          .update({
            calendar_uid: calendarUid,
            calendar_source: "m365",
            ends_at: row.ends_at,
            title_raw: row.title_raw,
          })
          .eq("id", seeded[0].id)
      : await supa.from("lessons").upsert(
          {
            client_id: clientId,
            starts_at: startsAt,
            ends_at: row.ends_at,
            status: new Date(startsAt) > new Date() ? "scheduled" : "completed",
            calendar_uid: calendarUid,
            calendar_source: "m365",
            title_raw: row.title_raw,
          },
          { onConflict: "calendar_uid" },
        );
    if (lErr) throw lErr;

    // Only now. If the insert had failed, the entry must stay in the queue
    // rather than disappearing unanswered.
    const { error: dErr } = await supa
      .from("lesson_review")
      .delete()
      .eq("calendar_uid", calendarUid);
    if (dErr) throw dErr;

    touched(clientId);
    revalidatePath(REVIEW);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not add that lesson.");
  }
}

/**
 * "No, that was not a lesson."
 *
 * Marked dismissed rather than deleted: the calendar event still exists, so a
 * deleted row would be re-queued on the next sync and Ian would answer the
 * same question every night.
 */
export async function dismissReview(calendarUid: string): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();
    const { error } = await supa
      .from("lesson_review")
      .update({ dismissed: true })
      .eq("calendar_uid", calendarUid);
    if (error) throw error;

    revalidatePath(REVIEW);
    revalidatePath(BOOK);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not dismiss that one.");
  }
}

/**
 * Fold one client into another: lessons and packages move across, the losing
 * name is kept as an alias, and the duplicate row goes.
 *
 * The alias matters more than it looks. Without it the next calendar sync sees
 * the old spelling, matches nobody, and recreates the duplicate Ian just
 * merged away.
 */
export async function mergeClients(
  keepId: string,
  mergeId: string,
): Promise<Result> {
  try {
    await assertLessonBook();
    if (keepId === mergeId) {
      return { ok: false, error: "That is the same person." };
    }
    const supa = await lessonBookClient();

    const [{ data: keep }, { data: gone }] = await Promise.all([
      supa
        .from("lesson_clients")
        .select("id, aliases")
        .eq("id", keepId)
        .maybeSingle(),
      supa
        .from("lesson_clients")
        .select("id, name, aliases")
        .eq("id", mergeId)
        .maybeSingle(),
    ]);
    if (!keep || !gone) {
      return { ok: false, error: "One of those is already gone." };
    }

    const aliases = Array.from(
      new Set(
        [
          ...((keep.aliases as string[] | null) ?? []),
          ...((gone.aliases as string[] | null) ?? []),
          String(gone.name),
        ]
          .map((a) => a.trim())
          .filter(Boolean),
      ),
    );

    // Lessons and packages first. If one fails the duplicate still exists,
    // which is recoverable - deleting it first would orphan them instead.
    const moves = await Promise.all([
      supa.from("lessons").update({ client_id: keepId }).eq("client_id", mergeId),
      supa
        .from("lesson_packages")
        .update({ client_id: keepId })
        .eq("client_id", mergeId),
      supa.from("lesson_clients").update({ aliases }).eq("id", keepId),
    ]);
    for (const m of moves) if (m.error) throw m.error;

    const { error } = await supa
      .from("lesson_clients")
      .delete()
      .eq("id", mergeId);
    if (error) throw error;

    touched(keepId);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not merge those two.");
  }
}

/**
 * Save the standard price list: package size -> dollars.
 *
 * A null or blank price removes that size from the list rather than storing
 * $0, which would read as "this package is free".
 */
export async function setStandardPrices(
  prices: Record<number, number | null>,
): Promise<Result> {
  try {
    await assertLessonBook();
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(prices)) {
      const size = Number(k);
      if (!Number.isInteger(size) || size < 1 || size > 50) {
        return { ok: false, error: "A package holds between 1 and 50 lessons." };
      }
      if (v === null || v === undefined) continue;
      if (!isFinite(v) || v < 0) {
        return { ok: false, error: `That is not a valid price for ${size}.` };
      }
      out[String(size)] = Math.round(v * 100);
    }

    const supa = await lessonBookClient();
    const { error } = await supa
      .from("lesson_settings")
      .upsert(
        { id: 1, standard_prices: out, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (error) throw error;

    revalidatePath(BOOK);
    revalidatePath(PRICES);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save the standard prices.");
  }
}

/**
 * Fill in the standard price on packages that have none.
 *
 * Only ever touches a package whose price is still null - the filter is in
 * the update itself, so a price Ian typed by hand (the ones that are
 * different) can never be overwritten, even if the screen was stale.
 * Returns how many packages were filled.
 */
export async function applyStandardPrices(
  packageIds: string[],
): Promise<Result<number>> {
  try {
    await assertLessonBook();
    if (!packageIds.length) return { ok: true, value: 0 };

    const supa = await lessonBookClient();
    const standard = await standardPrices();
    const sizes = Object.keys(standard).map(Number);
    if (!sizes.length) {
      return { ok: false, error: "Set the standard prices first." };
    }

    let filled = 0;
    for (const size of sizes) {
      const { data, error } = await supa
        .from("lesson_packages")
        .update({ price_cents: standard[size] })
        .in("id", packageIds)
        .eq("size", size)
        .is("price_cents", null)
        .select("id");
      if (error) throw error;
      filled += data?.length ?? 0;
    }

    touched();
    return { ok: true, value: filled };
  } catch (e) {
    return fail(e, "Could not apply the standard prices.");
  }
}

/**
 * Move several of one client's lessons into a package (or back to one-offs)
 * in a single write. Returns how many moved.
 *
 * Both sides are pinned to the client: the package must be theirs, and the
 * update only touches lessons whose client_id matches. A stale screen can
 * therefore never put somebody else's lesson in this package.
 */
export async function assignLessons(
  lessonIds: string[],
  packageId: string | null,
  clientId: string,
): Promise<Result<number>> {
  try {
    await assertLessonBook();
    if (!lessonIds.length) return { ok: true, value: 0 };
    const supa = await lessonBookClient();

    if (packageId) {
      const { data: pkg, error: pErr } = await supa
        .from("lesson_packages")
        .select("client_id")
        .eq("id", packageId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!pkg || pkg.client_id !== clientId) {
        return { ok: false, error: "That package belongs to someone else." };
      }
    }

    const { data, error } = await supa
      .from("lessons")
      .update({ package_id: packageId })
      .in("id", lessonIds)
      .eq("client_id", clientId)
      .select("id");
    if (error) throw error;

    touched(clientId);
    return { ok: true, value: data?.length ?? 0 };
  } catch (e) {
    return fail(e, "Could not move those lessons.");
  }
}

/**
 * Link queued calendar entries to the lessons already in the book.
 *
 * Each entry is matched to the un-linked lesson at the same moment (see
 * matchExisting); the lesson gets the calendar link - so the nightly sync
 * recognises it from now on - and the entry leaves the queue. Nothing is
 * inserted, so nothing is counted twice. An entry with no clear match is
 * left in the queue and reported as skipped.
 */
export async function linkReviews(
  calendarUids: string[],
): Promise<
  Result<{ linked: number; skipped: number; undo: LinkUndo[] }>
> {
  try {
    await assertLessonBook();
    if (!calendarUids.length) {
      return { ok: true, value: { linked: 0, skipped: 0, undo: [] } };
    }
    const supa = await lessonBookClient();

    const { data: rows, error: rErr } = await supa
      .from("lesson_review")
      .select("*")
      .in("calendar_uid", calendarUids);
    if (rErr) throw rErr;

    const times = [...new Set((rows ?? []).map((r) => r.starts_at as string))];
    const { data: cands, error: cErr } = times.length
      ? await supa
          .from("lesson_numbered")
          .select(
            "id, client_name, starts_at, ends_at, calendar_uid, title_raw, calendar_source",
          )
          .in("starts_at", times)
      : { data: [], error: null };
    if (cErr) throw cErr;
    const pool = (cands ?? []).map((c) => ({
      id: c.id as string,
      clientName: (c.client_name as string) ?? "",
      startsAt: c.starts_at as string,
      calendarUid: (c.calendar_uid as string | null) ?? null,
      // What the lesson looked like before linking, for Undo.
      before: {
        ends_at: c.ends_at as string,
        title_raw: (c.title_raw as string | null) ?? null,
        calendar_source: (c.calendar_source as string | null) ?? null,
      },
    }));
    const undo: LinkUndo[] = [];

    let linked = 0;
    let skipped = 0;
    for (const r of rows ?? []) {
      const id = matchExisting(
        { startsAt: r.starts_at as string, titleRaw: (r.title_raw as string) ?? "" },
        pool,
      );
      if (!id) {
        skipped++;
        continue;
      }
      // Guarded on calendar_uid is null, so two entries can never both claim
      // one lesson, even across two taps from two screens.
      const { data: done, error } = await supa
        .from("lessons")
        .update({
          calendar_uid: r.calendar_uid,
          calendar_source: "m365",
          ends_at: r.ends_at,
          title_raw: r.title_raw,
        })
        .eq("id", id)
        .is("calendar_uid", null)
        .select("id");
      if (error) throw error;
      if (!done?.length) {
        skipped++;
        continue;
      }
      // Claimed: take it out of the pool for the rest of this batch.
      const used = pool.find((p) => p.id === id);
      if (used) used.calendarUid = r.calendar_uid as string;

      const { error: dErr } = await supa
        .from("lesson_review")
        .delete()
        .eq("calendar_uid", r.calendar_uid);
      if (dErr) throw dErr;
      linked++;
      if (used) {
        undo.push({
          calendarUid: r.calendar_uid as string,
          lessonId: id,
          lessonBefore: used.before,
          review: r as Record<string, unknown>,
        });
      }
    }

    revalidatePath(REVIEW);
    touched();
    return { ok: true, value: { linked, skipped, undo } };
  } catch (e) {
    return fail(e, "Could not link those entries.");
  }
}

/**
 * Log a lesson that is not on the calendar - a walk-up, a moved lesson.
 *
 * Date and time are Pacific wall clock; status follows the clock (a future
 * one is booked, a past one taught). Marked calendar_source = manual and left
 * without a calendar link, so the sync never touches it.
 */
export async function addLesson(
  clientId: string,
  input: { day: string; time: string; minutes: number; packageId: string | null },
): Promise<Result<string>> {
  try {
    await assertLessonBook();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) {
      return { ok: false, error: "Pick a date." };
    }
    let startsAt: string;
    try {
      startsAt = courseLocalIso(input.day, input.time);
    } catch {
      return { ok: false, error: "Pick a time." };
    }
    const minutes = Math.round(input.minutes);
    if (!Number.isFinite(minutes) || minutes < 10 || minutes > 480) {
      return { ok: false, error: "A lesson runs between 10 minutes and 8 hours." };
    }
    const endsAt = new Date(
      new Date(startsAt).getTime() + minutes * 60000,
    ).toISOString();

    const supa = await lessonBookClient();
    if (input.packageId) {
      const { data: pkg, error: pErr } = await supa
        .from("lesson_packages")
        .select("client_id")
        .eq("id", input.packageId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!pkg || pkg.client_id !== clientId) {
        return { ok: false, error: "That package belongs to someone else." };
      }
    }

    const { data, error } = await supa
      .from("lessons")
      .insert({
        client_id: clientId,
        package_id: input.packageId,
        starts_at: startsAt,
        ends_at: endsAt,
        status: new Date(startsAt) > new Date() ? "scheduled" : "completed",
        calendar_source: "manual",
      })
      .select("id")
      .single();
    if (error) throw error;

    touched(clientId);
    return { ok: true, value: data.id as string };
  } catch (e) {
    return fail(e, "Could not add that lesson.");
  }
}

export interface SyncSummary {
  inserted: number;
  adopted: number;
  updated: number;
  queued: number;
  resolved: number;
}

/**
 * Run the calendar sync now instead of waiting for the 2am cron - for right
 * after fixing titles in Outlook. Same code path as the cron, so the same
 * rules: never invents a client, never touches money.
 */
export async function syncCalendarNow(): Promise<Result<SyncSummary>> {
  try {
    const viewer = await assertLessonBook();
    const report = await syncLessons();
    if (!report.ok) {
      return {
        ok: false,
        error:
          report.error ??
          `${report.failed} change${report.failed === 1 ? "" : "s"} rejected: ${report.errors[0] ?? "unknown"}`,
      };
    }
    const summary: SyncSummary = {
      inserted: report.inserted,
      adopted: report.adopted,
      updated: report.updated,
      queued: report.queued,
      resolved: report.resolved,
    };
    await logActivity({
      actor: viewer.email,
      app: "lessons",
      action: "calendar sync (manual)",
      detail: { ...summary },
    });
    touched();
    revalidatePath(REVIEW);
    return { ok: true, value: summary };
  } catch (e) {
    return fail(e, "The calendar sync did not run.");
  }
}

/** Enough to put one Link back exactly as it was. */
export interface LinkUndo {
  calendarUid: string;
  lessonId: string;
  lessonBefore: {
    ends_at: string;
    title_raw: string | null;
    calendar_source: string | null;
  };
  /** The lesson_review row as it was before it was cleared. */
  review: Record<string, unknown>;
}

/**
 * Undo a Link: the lesson loses its calendar id (and gets its old title and
 * end time back) and the entry returns to Review. Only undoes a lesson still
 * linked to that same entry, so it cannot unpick a later change.
 */
export async function unlinkReviews(items: LinkUndo[]): Promise<Result<number>> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();
    let undone = 0;
    for (const it of items) {
      if (typeof it?.calendarUid !== "string" || typeof it?.lessonId !== "string") {
        continue;
      }
      const { data, error } = await supa
        .from("lessons")
        .update({
          calendar_uid: null,
          calendar_source: it.lessonBefore.calendar_source,
          title_raw: it.lessonBefore.title_raw,
          ends_at: it.lessonBefore.ends_at,
        })
        .eq("id", it.lessonId)
        .eq("calendar_uid", it.calendarUid)
        .select("id");
      if (error) throw error;
      if (!data?.length) continue;

      // Back into the queue as it was; only the columns Review owns.
      const r = it.review;
      const { error: rErr } = await supa.from("lesson_review").upsert(
        {
          calendar_uid: it.calendarUid,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          title_raw: r.title_raw,
          guess_name: r.guess_name ?? null,
          guess_client_id: r.guess_client_id ?? null,
          calendar_source: r.calendar_source ?? "m365",
          dismissed: false,
        },
        { onConflict: "calendar_uid" },
      );
      if (rErr) throw rErr;
      undone++;
    }
    revalidatePath(REVIEW);
    touched();
    return { ok: true, value: undone };
  } catch (e) {
    return fail(e, "Could not undo that.");
  }
}

/** What was worked on in a lesson. Blank clears it. */
export async function setLessonNote(
  lessonId: string,
  clientId: string,
  text: string,
): Promise<Result> {
  try {
    await assertLessonBook();
    const notes = text.trim().slice(0, 2000) || null;
    const supa = await lessonBookClient();
    const { error } = await supa
      .from("lessons")
      .update({ notes })
      .eq("id", lessonId)
      .eq("client_id", clientId);
    if (error) throw error;
    // The client page holds the note in its own state; only the dashboard's
    // "last time" line needs a refresh.
    revalidatePath(BOOK);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save that note.");
  }
}

/**
 * Delete a package. Its lessons are kept and become one-offs (the foreign
 * key sets package_id to null); its price and payment record go with it.
 */
export async function deletePackage(
  packageId: string,
  clientId: string,
): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();
    const { data, error } = await supa
      .from("lesson_packages")
      .delete()
      .eq("id", packageId)
      .eq("client_id", clientId)
      .select("id");
    if (error) throw error;
    if (!data?.length) return { ok: false, error: "That package is already gone." };
    touched(clientId);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not delete that package.");
  }
}

/**
 * Delete a lesson that was added by hand. Calendar lessons are refused: the
 * next sync would only bring them back - cancel those in Outlook instead.
 */
export async function deleteLesson(
  lessonId: string,
  clientId: string,
): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();
    const { data, error } = await supa
      .from("lessons")
      .delete()
      .eq("id", lessonId)
      .eq("client_id", clientId)
      .eq("calendar_source", "manual")
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      return {
        ok: false,
        error:
          "Only lessons added by hand can be deleted here. Cancel calendar lessons in Outlook.",
      };
    }
    touched(clientId);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not delete that lesson.");
  }
}
