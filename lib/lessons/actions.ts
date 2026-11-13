"use server";

import { revalidatePath } from "next/cache";
import { lessonBookClient } from "./db";
import { assertLessonBook } from "./auth";
import { singleRates, standardPrices } from "./data";
import { syncLessons } from "./sync";
import { logActivity } from "@/lib/hub/log";
import {
  aliasClash,
  cleanAliases,
  courseDay,
  courseLocalIso,
  matchExisting,
  parseDollars,
  singleRate,
} from "./calc";
import { markPaidOn } from "./catchup";
import { planDelete, planHappened, planMove } from "./sync-plan";
import type { PayMethod, PaymentStatus, Result } from "./types";

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
const LEDGER = "/lessons/ledger";

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
  revalidatePath(LEDGER);
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
 * The day a one-tap "paid" should record - see markPaidOn. Stamping today
 * put a year of caught-up bills into the month they were entered.
 */
async function paidOnFor(
  supa: Awaited<ReturnType<typeof lessonBookClient>>,
  packageId: string,
): Promise<string> {
  const [pkg, first, venmo] = await Promise.all([
    supa
      .from("lesson_packages")
      .select("payment_status, paid_on, sold_on")
      .eq("id", packageId)
      .maybeSingle(),
    supa
      .from("lessons")
      .select("starts_at")
      .eq("package_id", packageId)
      .neq("status", "cancelled")
      .order("starts_at")
      .limit(1),
    supa
      .from("lesson_payments")
      .select("paid_on")
      .eq("package_id", packageId)
      .order("paid_on")
      .limit(1),
  ]);
  for (const r of [pkg, first, venmo]) if (r.error) throw r.error;
  const starts = first.data?.[0]?.starts_at as string | undefined;
  const venmoOn = venmo.data?.[0]?.paid_on as string | undefined;
  return markPaidOn({
    alreadyPaidOn:
      pkg.data?.payment_status === "paid" ? ((pkg.data.paid_on as string | null) ?? null) : null,
    venmoOn: venmoOn ? venmoOn.slice(0, 10) : null,
    firstLessonOn: starts ? courseDay(starts) : null,
    soldOn: (pkg.data?.sold_on as string | null) ?? null,
    today: courseToday(),
  });
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
    patch.paid_on = status === "paid" ? await paidOnFor(supa, packageId) : null;
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
    if (clientId) await dropEmptySingles(supa, clientId);

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

    // Remember the spelling that did not match, or the queue asks forever.
    //
    // The sync matches on the client's name and aliases. "Takahashi son
    // lesson" and "Cameron Stewart lesson Individual paying" match neither,
    // so every run queued them again, Ian answered again, and before the
    // adopt fix each answer left another copy of the lesson behind. Saving
    // the guessed name as an alias is what makes the answer stick - the same
    // reasoning mergeClients already relies on.
    const guess = ((row.guess_name as string | null) ?? "").trim();
    if (guess) {
      const { data: everyone, error: gErr } = await supa
        .from("lesson_clients")
        .select("id, name, aliases");
      if (gErr) throw gErr;
      const all = (everyone ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        aliases: (c.aliases as string[] | null) ?? [],
      }));
      const me = all.find((c) => c.id === clientId);
      // A spelling another client already answers to would break the sync's
      // name -> client map, so it is not worth having.
      if (me && !aliasClash([guess], clientId, all)) {
        const next = cleanAliases([...me.aliases, guess], me.name);
        if (next.length !== me.aliases.length) {
          const { error: aErr } = await supa
            .from("lesson_clients")
            .update({ aliases: next })
            .eq("id", clientId);
          if (aErr) throw aErr;
        }
      }
    }

    const startsAt = row.starts_at as string;

    // Most queued entries are lessons already in the book, so inserting would
    // count them twice: adopt the existing one for this client at this moment
    // instead.
    //
    // Any uid, not just a missing one. Exchange entry ids are not permanent,
    // and a row whose uid has gone stale is still that lesson - the sync
    // learned this the night 94 ids rotated and the book grew a second copy
    // of everything. Answering two Review entries on 6 November made two more
    // the same way, because this query still asked for a null uid.
    const { data: seeded, error: sErr } = await supa
      .from("lessons")
      .select("id")
      .eq("client_id", clientId)
      .eq("starts_at", startsAt)
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
    const [standard, rates] = await Promise.all([
      standardPrices(),
      singleRates(),
    ]);
    const sizes = Object.keys(standard).map(Number);
    const noRates = rates.member === undefined && rates.guest === undefined;
    if (!sizes.length && noRates) {
      return { ok: false, error: "Set the standard prices first." };
    }

    let filled = 0;
    for (const size of sizes) {
      const { data, error } = await supa
        .from("lesson_packages")
        .update({ price_cents: standard[size] })
        .in("id", packageIds)
        .eq("kind", "package")
        .eq("size", size)
        .is("price_cents", null)
        .select("id");
      if (error) throw error;
      filled += data?.length ?? 0;
    }

    // Singles take the member or guest rate, by the client's membership.
    for (const member of [true, false]) {
      const cents = singleRate(member, rates);
      if (cents === null) continue;
      const { data: who, error: wErr } = await supa
        .from("lesson_package_status")
        .select("package_id")
        .in("package_id", packageIds)
        .eq("kind", "single")
        .eq("client_is_member", member);
      if (wErr) throw wErr;
      const ids = (who ?? []).map((w) => w.package_id as string);
      if (!ids.length) continue;
      const { data, error } = await supa
        .from("lesson_packages")
        .update({ price_cents: cents })
        .in("id", ids)
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
    await dropEmptySingles(supa, clientId);

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
  singles: number;
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
      singles: report.singles,
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
 * Delete a lesson - usually a calendar entry that was never a lesson.
 *
 * A calendar lesson is dismissed in Review before the row goes, so the sync
 * skips that event from now on rather than bringing it back (see
 * planDelete). Its own unpaid single goes with it; a paid one is refused.
 */
export async function deleteLesson(
  lessonId: string,
  clientId: string | null,
): Promise<Result> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();
    const { data: lesson, error: lErr } = await supa
      .from("lessons")
      .select("id, client_id, package_id, calendar_uid, calendar_source, starts_at, ends_at, title_raw")
      .eq("id", lessonId)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!lesson) return { ok: false, error: "That lesson is no longer in the book." };

    const packageId = lesson.package_id as string | null;
    let bill: { kind: string; status: string } | null = null;
    if (packageId) {
      const { data: p, error } = await supa
        .from("lesson_packages")
        .select("kind, payment_status")
        .eq("id", packageId)
        .maybeSingle();
      if (error) throw error;
      if (p) bill = { kind: p.kind as string, status: p.payment_status as string };
    }

    const plan = planDelete({
      calendarUid: (lesson.calendar_uid as string | null) ?? null,
      bill,
    });
    if (!plan.ok) return plan;

    // The marker first: if the delete then fails, the worst case is a lesson
    // the sync no longer refreshes, never one it brings back.
    if (plan.dismissUid) {
      const { error } = await supa.from("lesson_review").upsert(
        {
          calendar_uid: plan.dismissUid,
          starts_at: lesson.starts_at,
          ends_at: lesson.ends_at,
          title_raw: (lesson.title_raw as string | null) ?? "(deleted lesson)",
          calendar_source: lesson.calendar_source,
          dismissed: true,
        },
        { onConflict: "calendar_uid" },
      );
      if (error) throw error;
    }

    const { error: dErr } = await supa.from("lessons").delete().eq("id", lessonId);
    if (dErr) throw dErr;

    if (plan.dropSingle && packageId) {
      const { error } = await supa
        .from("lesson_packages")
        .delete()
        .eq("id", packageId)
        .eq("kind", "single")
        .neq("payment_status", "paid");
      if (error) throw error;
    }

    touched((lesson.client_id as string | null) ?? clientId ?? undefined);
    revalidatePath(REVIEW);
    revalidatePath("/lessons/billing");
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not delete that lesson.");
  }
}

type Supa = Awaited<ReturnType<typeof lessonBookClient>>;

/**
 * A single exists to bill one lesson. When its lesson moves into a package
 * it has nothing left to bill, so it goes - unless it was already paid,
 * because that is a money record, and deleting it would lose the payment.
 */
async function dropEmptySingles(supa: Supa, clientId: string): Promise<void> {
  const { data: singles, error } = await supa
    .from("lesson_package_status")
    .select("package_id, payment_status")
    .eq("client_id", clientId)
    .eq("kind", "single");
  if (error) throw error;
  const unpaid = (singles ?? [])
    .filter((s) => s.payment_status !== "paid")
    .map((s) => s.package_id as string);
  if (!unpaid.length) return;
  // Any lesson of any status still pointing at it keeps it.
  const { data: still, error: sErr } = await supa
    .from("lessons")
    .select("package_id")
    .in("package_id", unpaid);
  if (sErr) throw sErr;
  const inUse = new Set((still ?? []).map((l) => l.package_id as string));
  const gone = unpaid.filter((id) => !inUse.has(id));
  if (gone.length) {
    const { error: dErr } = await supa
      .from("lesson_packages")
      .delete()
      .in("id", gone)
      .eq("kind", "single");
    if (dErr) throw dErr;
  }
}

/** Save the single-lesson rates, in dollars. Blank = no rate. */
export async function setSingleRates(rates: {
  member: number | null;
  guest: number | null;
}): Promise<Result> {
  try {
    await assertLessonBook();
    const out: Record<string, number> = {};
    for (const k of ["member", "guest"] as const) {
      const parsed = parseDollars(rates[k]);
      if (!parsed.ok) {
        return { ok: false, error: `That is not a valid ${k} rate.` };
      }
      if (parsed.cents !== null) out[k] = parsed.cents;
    }
    const supa = await lessonBookClient();
    const { error } = await supa
      .from("lesson_settings")
      .upsert(
        { id: 1, single_rates: out, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (error) throw error;
    revalidatePath(BOOK);
    revalidatePath(PRICES);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save the single rates.");
  }
}

/**
 * Bill each of these lessons on its own: one single (a one-lesson bill) per
 * lesson, at the member or guest rate, unpaid. Each is its own row, so two
 * singles are never bundled. Only lessons still on no bill are touched.
 */
export async function billAsSingles(
  lessonIds: string[],
  clientId: string,
): Promise<Result<number>> {
  try {
    await assertLessonBook();
    if (!lessonIds.length) return { ok: true, value: 0 };
    const supa = await lessonBookClient();

    const [clientRes, rates, lessonsRes] = await Promise.all([
      supa
        .from("lesson_clients")
        .select("is_member")
        .eq("id", clientId)
        .maybeSingle(),
      singleRates(),
      supa
        .from("lessons")
        .select("id, starts_at")
        .in("id", lessonIds)
        .eq("client_id", clientId)
        .is("package_id", null),
    ]);
    if (clientRes.error) throw clientRes.error;
    if (lessonsRes.error) throw lessonsRes.error;
    if (!clientRes.data) return { ok: false, error: "That client is gone." };
    const cents = singleRate(clientRes.data.is_member === true, rates);

    let billed = 0;
    for (const l of lessonsRes.data ?? []) {
      const { data: pkg, error: pErr } = await supa
        .from("lesson_packages")
        .insert({
          client_id: clientId,
          size: 1,
          kind: "single",
          sold_on: courseDay(l.starts_at as string),
          price_cents: cents,
          payment_status: "unpaid",
        })
        .select("id")
        .single();
      if (pErr) throw pErr;
      // Guarded: if the lesson was billed elsewhere meanwhile, drop the single.
      const { data: moved, error: mErr } = await supa
        .from("lessons")
        .update({ package_id: pkg.id })
        .eq("id", l.id)
        .is("package_id", null)
        .select("id");
      if (mErr) throw mErr;
      if (moved?.length) billed++;
      else await supa.from("lesson_packages").delete().eq("id", pkg.id);
    }

    touched(clientId);
    return { ok: true, value: billed };
  } catch (e) {
    return fail(e, "Could not bill those lessons.");
  }
}

export interface BillItem {
  lessonId: string;
  /** Integer cents; null = no price recorded yet. */
  priceCents: number | null;
  status: PaymentStatus;
  method: PaymentMethodValue | null;
}

type PaymentMethodValue = "venmo" | "member_charge" | "cash" | "other";
const METHODS = new Set(["venmo", "member_charge", "cash", "other"]);

/**
 * The Billing screen's one tap: each lesson becomes its own single with the
 * amount, status and method chosen. A paid one is dated the day of its own
 * lesson - the money arrived around the lesson, not the day it was entered
 * - so the year-end income lands in the right year. Only lessons still on
 * no bill, and only this client's. Returns the singles made, for Undo.
 */
export async function billLessons(
  clientId: string,
  items: BillItem[],
): Promise<Result<{ billed: number; packageIds: string[] }>> {
  try {
    await assertLessonBook();
    if (!items.length) return { ok: true, value: { billed: 0, packageIds: [] } };
    for (const it of items) {
      if (
        it.priceCents !== null &&
        (!Number.isInteger(it.priceCents) || it.priceCents < 0)
      ) {
        return { ok: false, error: "That is not a valid amount." };
      }
      if (it.method !== null && !METHODS.has(it.method)) {
        return { ok: false, error: "That is not a payment method." };
      }
    }
    const supa = await lessonBookClient();
    const { data: lessons, error: lErr } = await supa
      .from("lessons")
      .select("id, starts_at")
      .in(
        "id",
        items.map((i) => i.lessonId),
      )
      .eq("client_id", clientId)
      .is("package_id", null);
    if (lErr) throw lErr;
    const when = new Map(
      (lessons ?? []).map((l) => [l.id as string, l.starts_at as string]),
    );

    const packageIds: string[] = [];
    for (const it of items) {
      const startsAt = when.get(it.lessonId);
      if (!startsAt) continue; // already billed, or not this client's
      const day = courseDay(startsAt);
      const { data: pkg, error: pErr } = await supa
        .from("lesson_packages")
        .insert({
          client_id: clientId,
          size: 1,
          kind: "single",
          sold_on: day,
          price_cents: it.priceCents,
          payment_status: it.status,
          payment_method: it.status === "unpaid" ? null : it.method,
          paid_on: it.status === "paid" ? day : null,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;
      const { data: moved, error: mErr } = await supa
        .from("lessons")
        .update({ package_id: pkg.id })
        .eq("id", it.lessonId)
        .is("package_id", null)
        .select("id");
      if (mErr) throw mErr;
      if (moved?.length) packageIds.push(pkg.id as string);
      else await supa.from("lesson_packages").delete().eq("id", pkg.id);
    }

    touched(clientId);
    revalidatePath("/lessons/billing");
    return { ok: true, value: { billed: packageIds.length, packageIds } };
  } catch (e) {
    return fail(e, "Could not bill those lessons.");
  }
}

/**
 * Undo for billLessons: delete those singles, and their lessons go back to
 * not billed (the foreign key clears package_id). Singles only, this
 * client's only - a package can never be removed this way.
 */
export async function unbillSingles(
  clientId: string,
  packageIds: string[],
): Promise<Result<number>> {
  try {
    await assertLessonBook();
    if (!packageIds.length) return { ok: true, value: 0 };
    const supa = await lessonBookClient();
    const { data, error } = await supa
      .from("lesson_packages")
      .delete()
      .in("id", packageIds)
      .eq("client_id", clientId)
      .eq("kind", "single")
      .select("id");
    if (error) throw error;
    touched(clientId);
    revalidatePath("/lessons/billing");
    return { ok: true, value: data?.length ?? 0 };
  } catch (e) {
    return fail(e, "Could not undo that.");
  }
}

export interface CatchUpItem {
  packageId: string;
  priceCents: number | null;
  status: PaymentStatus;
  method: PaymentMethodValue | null;
  /** The day it counts as paid; required when status is paid. */
  paidOn: string | null;
}

/**
 * The Billing catch-up: price, status, method and paid date for many bills
 * in one save, each as Ian set it.
 *
 * The form defaults a series' date to its first lesson so income lands in
 * the month the money really came in; this action stores whatever day it is
 * given. An unpaid bill carries no method and no date - a stale one would
 * misreport when money arrived.
 */
export async function saveCatchUp(items: CatchUpItem[]): Promise<Result<number>> {
  try {
    await assertLessonBook();
    if (!items.length) return { ok: true, value: 0 };
    for (const it of items) {
      if (
        it.priceCents !== null &&
        (!Number.isInteger(it.priceCents) || it.priceCents < 0)
      ) {
        return { ok: false, error: "That is not a valid amount." };
      }
      if (!["unpaid", "pending", "paid"].includes(it.status)) {
        return { ok: false, error: "That is not a payment status." };
      }
      if (it.method !== null && !METHODS.has(it.method)) {
        return { ok: false, error: "That is not a payment method." };
      }
      if (it.status === "paid" && !(it.paidOn && /^\d{4}-\d{2}-\d{2}$/.test(it.paidOn))) {
        return { ok: false, error: "A paid bill needs the day it was paid." };
      }
    }
    const supa = await lessonBookClient();
    let saved = 0;
    for (const it of items) {
      const { data, error } = await supa
        .from("lesson_packages")
        .update({
          price_cents: it.priceCents,
          payment_status: it.status,
          payment_method: it.status === "unpaid" ? null : it.method,
          paid_on: it.status === "paid" ? it.paidOn : null,
        })
        .eq("id", it.packageId)
        .select("id");
      if (error) throw error;
      saved += data?.length ?? 0;
    }
    touched();
    revalidatePath("/lessons/billing");
    return { ok: true, value: saved };
  } catch (e) {
    return fail(e, "Could not save those bills.");
  }
}

/**
 * Answer what a Venmo payment was for.
 *
 * Writing decided_by = 'ian' is the point: it marks the row as answered, so a
 * later statement re-import leaves it alone instead of replacing a decision
 * with a fresh guess.
 *
 * Only a lesson payment may carry a package or a lesson, so switching a row to
 * clinic or not-a-lesson clears any tie - the database enforces the same rule,
 * and leaving a stale link would attribute money to a package it no longer
 * belongs to.
 */
export async function setPaymentKind(
  id: string,
  kind: "unclassified" | "lesson" | "clinic" | "not_lesson",
  opts?: { clientId?: string | null; packageId?: string | null; lessonId?: string | null },
): Promise<Result> {
  try {
    await assertLessonBook();
    const isLesson = kind === "lesson";
    const patch: Record<string, unknown> = {
      kind,
      decided_by: "ian",
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_id: isLesson ? (opts?.clientId ?? null) : null,
      package_id: isLesson ? (opts?.packageId ?? null) : null,
      lesson_id: isLesson ? (opts?.lessonId ?? null) : null,
    };

    const { error } = await (await lessonBookClient())
      .from("lesson_payments")
      .update(patch)
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/lessons/payments");
    revalidatePath(BOOK);
    if (opts?.clientId) revalidatePath(`${CLIENTS}/${opts.clientId}`);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save that payment.");
  }
}

/**
 * Put a payment against the bill it paid for, leaving everything else alone.
 *
 * Separate from setPaymentKind because that one clears the tie whenever the
 * kind is not a lesson - right when answering "what was this", wrong when
 * the answer is already "a lesson" and Ian is now saying which one.
 */
export async function tiePaymentToPackage(
  id: string,
  packageId: string | null,
): Promise<Result> {
  try {
    await assertLessonBook();
    const { error } = await (await lessonBookClient())
      .from("lesson_payments")
      .update({
        package_id: packageId,
        // A payment buys one or the other, never both.
        lesson_id: null,
        // tie_needs_lesson_kind: a payment pointing at a bill must say it was
        // for a lesson. Most arrive 'unclassified', so tying one without
        // this is rejected by the database outright. Untying is exempt - the
        // constraint only bites while a tie exists - but saying so anyway
        // keeps the kind honest for a row Ian has now ruled on.
        kind: "lesson",
        decided_by: "ian",
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;

    revalidatePath("/lessons/payments");
    revalidatePath(BOOK);
    revalidatePath(LEDGER);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not tie that payment to a package.");
  }
}

// ---- the lesson ledger ----------------------------------------------------
// One lesson at a time, from the lesson's side. Everything below writes the
// same shapes the rest of the book uses - money on a package, never on a
// lesson - so a row settled here is indistinguishable from one settled on the
// Billing screen.

export interface LedgerPay {
  /** Integer cents. Null is refused: a paid single worth nothing hides a gap. */
  priceCents: number | null;
  method: PayMethod | null;
  status: PaymentStatus;
  /** Course-local date the money moved. Defaults to the lesson's own day. */
  paidOn?: string | null;
  /** A Venmo payment to tie to the single this creates. */
  paymentId?: string | null;
}

/**
 * Put an amount and a payment on one lesson, and tie the Venmo row that paid
 * for it.
 *
 * The lesson becomes its own single, the way billLessons does it - but one at
 * a time, with its own date and its own method, because walking 74 lessons by
 * day means each one is answered on its own terms rather than in a block.
 *
 * Re-running on an already-billed lesson edits that single rather than making
 * a second one, so a corrected amount does not double the takings.
 */
export async function setLessonPayment(
  lessonId: string,
  pay: LedgerPay,
): Promise<Result<{ packageId: string }>> {
  try {
    await assertLessonBook();
    if (pay.priceCents === null) {
      return { ok: false, error: "Enter an amount." };
    }
    if (!Number.isInteger(pay.priceCents) || pay.priceCents < 0) {
      return { ok: false, error: "That is not a valid amount." };
    }
    if (pay.method !== null && !METHODS.has(pay.method)) {
      return { ok: false, error: "That is not a payment method." };
    }
    if (!["unpaid", "pending", "paid"].includes(pay.status)) {
      return { ok: false, error: "That is not a payment state." };
    }

    const supa = await lessonBookClient();
    const { data: lesson, error: lErr } = await supa
      .from("lessons")
      .select("id, client_id, package_id, starts_at")
      .eq("id", lessonId)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!lesson) return { ok: false, error: "That lesson is no longer in the book." };
    const clientId = lesson.client_id as string | null;
    if (!clientId) {
      return { ok: false, error: "Give that lesson a student before billing it." };
    }

    const day = courseDay(lesson.starts_at as string);
    const paidOn = pay.status === "paid" ? (pay.paidOn?.trim() || day) : null;
    const fields = {
      price_cents: pay.priceCents,
      payment_status: pay.status,
      payment_method: pay.status === "unpaid" ? null : pay.method,
      paid_on: paidOn,
    };

    // Already on a package? Edit that one - but only when it is this lesson's
    // own single. A real package is shared with its other lessons, and
    // rewriting its price from one of them would misprice the rest.
    let packageId = lesson.package_id as string | null;
    if (packageId) {
      const { data: existing, error: pErr } = await supa
        .from("lesson_packages")
        .select("id, kind")
        .eq("id", packageId)
        .maybeSingle();
      if (pErr) throw pErr;
      if (existing && existing.kind !== "single") {
        return {
          ok: false,
          error: "That lesson is part of a package - price the package itself.",
        };
      }
      const { error } = await supa
        .from("lesson_packages")
        .update(fields)
        .eq("id", packageId);
      if (error) throw error;
    } else {
      const { data: made, error } = await supa
        .from("lesson_packages")
        .insert({ client_id: clientId, size: 1, kind: "single", sold_on: day, ...fields })
        .select("id")
        .single();
      if (error) throw error;
      packageId = made.id as string;

      const { data: moved, error: mErr } = await supa
        .from("lessons")
        .update({ package_id: packageId })
        .eq("id", lessonId)
        .is("package_id", null)
        .select("id");
      if (mErr) throw mErr;
      if (!moved?.length) {
        // Billed from another screen a moment ago. Drop the single rather
        // than leave it hanging where it will read as money owed.
        await supa.from("lesson_packages").delete().eq("id", packageId);
        return { ok: false, error: "That lesson was just billed somewhere else." };
      }
    }

    // Tie the Venmo row last: it is the only part that can fail without
    // leaving the book wrong, and a bill with an untied payment is still
    // better than no bill.
    if (pay.paymentId) {
      const { error } = await supa
        .from("lesson_payments")
        .update({
          package_id: packageId,
          lesson_id: null,
          // Required by tie_needs_lesson_kind - see tiePaymentToPackage.
          kind: "lesson",
          decided_by: "ian",
          decided_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pay.paymentId);
      if (error) throw error;
      revalidatePath("/lessons/payments");
    }

    touched(clientId);
    revalidatePath("/lessons/billing");
    return { ok: true, value: { packageId } };
  } catch (e) {
    return fail(e, "Could not put that payment on the lesson.");
  }
}

/**
 * The lesson never happened.
 *
 * Marked, not deleted. Deleting is wrong twice over: the calendar event still
 * exists, so tonight's sync would put the row straight back, and a package
 * would lose the audit trail of a lesson that was booked and dropped. A
 * cancelled lesson counts toward no package - lesson_package_status only
 * counts 'completed' - so the series gets its slot back by itself.
 *
 * Pass back "completed" to undo.
 */
export async function setLessonHappened(
  lessonId: string,
  status: "cancelled" | "no_show" | "completed",
): Promise<Result> {
  try {
    await assertLessonBook();
    if (!["cancelled", "no_show", "completed"].includes(status)) {
      return { ok: false, error: "That is not a lesson state." };
    }
    const supa = await lessonBookClient();
    const { data, error } = await supa
      .from("lessons")
      .update({ status })
      .eq("id", lessonId)
      .select("client_id, package_id");
    if (error) throw error;
    if (!data?.length) return { ok: false, error: "That lesson is no longer in the book." };

    // A lesson that never happened owes nothing: let go of its own unpaid
    // single, so it stops asking for payment (see planHappened). Deleting the
    // single clears the lesson's package_id through the foreign key.
    const packageId = data[0].package_id as string | null;
    if (packageId) {
      const bill = await billOf(supa, packageId);
      if (planHappened(status, bill).dropSingle) {
        const { error: dErr } = await supa
          .from("lesson_packages")
          .delete()
          .eq("id", packageId)
          .eq("kind", "single")
          .neq("payment_status", "paid");
        if (dErr) throw dErr;
      }
    }

    touched((data[0].client_id as string) ?? undefined);
    revalidatePath("/lessons/billing");
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not change that lesson.");
  }
}

async function billOf(
  supa: Awaited<ReturnType<typeof lessonBookClient>>,
  packageId: string,
): Promise<{ kind: string; status: string; clientId: string } | null> {
  const { data, error } = await supa
    .from("lesson_packages")
    .select("kind, payment_status, client_id")
    .eq("id", packageId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        kind: data.kind as string,
        status: data.payment_status as string,
        clientId: data.client_id as string,
      }
    : null;
}

/**
 * Put a lesson on one of its client's packages - or on a new 3/5/10-pack -
 * from the lesson itself. Its own single goes, so it stops being billed as a
 * lesson on its own. A paid single needs `choice` - whose payment is real -
 * so the money is never counted twice (see planMove).
 */
export async function moveLessonToPackage(
  lessonId: string,
  target: { packageId: string } | { newSize: number },
  choice?: "carry" | "keep_package",
): Promise<Result<{ packageId: string; made: boolean }>> {
  try {
    await assertLessonBook();
    const supa = await lessonBookClient();
    const { data: lesson, error: lErr } = await supa
      .from("lessons")
      .select("id, client_id, package_id, starts_at")
      .eq("id", lessonId)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!lesson) return { ok: false, error: "That lesson is no longer in the book." };
    const clientId = (lesson.client_id as string | null) ?? null;
    const oldId = (lesson.package_id as string | null) ?? null;
    const bill = oldId ? await billOf(supa, oldId) : null;

    let dest: { clientId: string; kind: string };
    if ("packageId" in target) {
      if (target.packageId === oldId) {
        return { ok: true, value: { packageId: oldId, made: false } };
      }
      const t = await billOf(supa, target.packageId);
      if (!t) return { ok: false, error: "That package is no longer in the book." };
      dest = { clientId: t.clientId, kind: t.kind };
    } else {
      if (!Number.isInteger(target.newSize) || target.newSize < 2 || target.newSize > 50) {
        return { ok: false, error: "A package holds between 2 and 50 lessons." };
      }
      dest = { clientId: clientId ?? "", kind: "package" };
    }

    const plan = planMove({ lessonClientId: clientId, bill, target: dest, choice });
    if (!plan.ok) return { ok: false, error: plan.error };

    let packageId: string;
    let made = false;
    if ("packageId" in target) {
      packageId = target.packageId;
    } else {
      const standard = await standardPrices();
      const { data: created, error: cErr } = await supa
        .from("lesson_packages")
        .insert({
          client_id: clientId,
          size: target.newSize,
          kind: "package",
          sold_on: courseDay(lesson.starts_at as string),
          price_cents: standard[target.newSize] ?? null,
          payment_status: "unpaid",
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      packageId = created.id as string;
      made = true;
    }

    const { error: mErr } = await supa
      .from("lessons")
      .update({ package_id: packageId })
      .eq("id", lessonId);
    if (mErr) throw mErr;

    if (oldId && plan.carry) {
      // The single's payment becomes the series' payment.
      const { data: paid, error: sErr } = await supa
        .from("lesson_packages")
        .select("price_cents, payment_method, paid_on")
        .eq("id", oldId)
        .maybeSingle();
      if (sErr) throw sErr;
      if (paid) {
        const { error } = await supa
          .from("lesson_packages")
          .update({
            price_cents: paid.price_cents,
            payment_status: "paid",
            payment_method: paid.payment_method,
            paid_on: paid.paid_on,
          })
          .eq("id", packageId);
        if (error) throw error;
      }
    }
    if (oldId && (plan.carry || plan.untie)) {
      // The Venmo row follows the payment that stands - or, when the
      // package's payment stands, goes back to the untied ones.
      const { error } = await supa
        .from("lesson_payments")
        .update({
          package_id: plan.carry ? packageId : null,
          lesson_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("package_id", oldId);
      if (error) throw error;
    }

    if (plan.dropSingle && oldId) {
      // A paid single only gets this far once Ian has said whose payment is
      // real; without that, planMove stopped above.
      let del = supa.from("lesson_packages").delete().eq("id", oldId).eq("kind", "single");
      if (!choice) del = del.neq("payment_status", "paid");
      const { error: dErr } = await del;
      if (dErr) throw dErr;
    }

    touched(clientId ?? undefined);
    revalidatePath("/lessons/billing");
    return { ok: true, value: { packageId, made } };
  } catch (e) {
    return fail(e, "Could not put that lesson on a package.");
  }
}

/**
 * Take the calendar title at its word and put this lesson on a package.
 *
 * "Jack Hutchinson lesson 3 of 5" says there is a five-lesson package and
 * this is the third of it. Prefer one that already exists and has room -
 * making a second 5-pack for a series already half recorded is how a client
 * ends up with eleven lessons across three packages.
 */
export async function packFromTitle(
  lessonId: string,
  size: number,
): Promise<Result<{ packageId: string; made: boolean }>> {
  try {
    await assertLessonBook();
    if (!Number.isInteger(size) || size < 2 || size > 50) {
      return { ok: false, error: "A package holds between 2 and 50 lessons." };
    }
    const supa = await lessonBookClient();
    const { data: lesson, error: lErr } = await supa
      .from("lessons")
      .select("id, client_id, package_id, starts_at")
      .eq("id", lessonId)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!lesson) return { ok: false, error: "That lesson is no longer in the book." };
    if (lesson.package_id) {
      return { ok: false, error: "That lesson is already on a bill." };
    }
    const clientId = lesson.client_id as string | null;
    if (!clientId) {
      return { ok: false, error: "Give that lesson a student first." };
    }

    const { data: open, error: oErr } = await supa
      .from("lesson_package_status")
      .select("package_id, size, lessons_remaining")
      .eq("client_id", clientId)
      .eq("kind", "package")
      .eq("size", size)
      .gt("lessons_remaining", 0)
      .order("last_lesson_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (oErr) throw oErr;

    let packageId = (open?.[0]?.package_id as string | undefined) ?? null;
    const made = !packageId;
    if (!packageId) {
      const standard = await standardPrices();
      const { data: created, error: cErr } = await supa
        .from("lesson_packages")
        .insert({
          client_id: clientId,
          size,
          kind: "package",
          sold_on: courseDay(lesson.starts_at as string),
          price_cents: standard[size] ?? null,
          payment_status: "unpaid",
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      packageId = created.id as string;
    }

    const { error: mErr } = await supa
      .from("lessons")
      .update({ package_id: packageId })
      .eq("id", lessonId)
      .is("package_id", null);
    if (mErr) throw mErr;

    await dropEmptySingles(supa, clientId);
    touched(clientId);
    return { ok: true, value: { packageId, made } };
  } catch (e) {
    return fail(e, "Could not put that lesson on a package.");
  }
}
