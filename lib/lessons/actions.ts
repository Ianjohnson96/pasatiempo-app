"use server";

import { revalidatePath } from "next/cache";
import { lessonBookClient } from "./db";
import { assertLessonBook } from "./auth";
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
  if (clientId) revalidatePath(`${CLIENTS}/${clientId}`);
}

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
    const { data, error } = await supa
      .from("lesson_packages")
      .insert({
        client_id: clientId,
        size: input.size,
        label: input.label?.trim() || null,
        price_cents:
          input.dollars === null || input.dollars === undefined
            ? null
            : Math.round(input.dollars * 100),
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
    if (!Object.keys(fields).length) return { ok: true, value: undefined };

    const supa = await lessonBookClient();
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
