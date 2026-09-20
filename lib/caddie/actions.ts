"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "./data";
import { rowToLoop, type CaddieRank, type LoopRec, type LoopType } from "./types";

// Write-side. Every mutation the Pro Shop makes goes through here.
//
// Accept/decline is the exception: it never writes assignments directly, it
// calls the caddie.respond_to_offer() function, which takes the row locks that
// make "first to respond gets the loop" safe. The same function backs the
// caddie's own tap and the inbound SMS webhook, so all three paths agree.

const BOARD_PATH = "/admin/caddie";

export type Result<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : fallback;
  return { ok: false, error: msg };
}

// Email of the signed-in admin, stamped onto whatever they create.
async function currentEmail(): Promise<string | null> {
  try {
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    return user?.email?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Loops
// ---------------------------------------------------------------------------

export interface LoopInput {
  id?: string;
  /** Course-local day, "yyyy-mm-dd". */
  day: string;
  /** Course-local time, "HH:mm" (24h). */
  time: string;
  playerName: string;
  loopType: LoopType;
  caddiesRequired: number;
  holes: number;
  notes: string;
  requestedRank: CaddieRank | null;
  requestedCaddieId: string | null;
}

/**
 * Create or update a loop.
 *
 * The form collects a course-local day and time; the database stores an
 * instant. The conversion happens here, once, using the course timezone — not
 * in the browser, whose clock may be anywhere.
 */
export async function saveLoop(input: LoopInput): Promise<Result<LoopRec>> {
  try {
    const supa = createAdminClient("caddie");
    const { courseTimezone } = await getSettings();

    const teeTime = localToInstant(input.day, input.time, courseTimezone);
    if (!teeTime) return { ok: false, error: "That tee time is not a real date." };

    const fields = {
      tee_time: teeTime,
      player_name: input.playerName.trim() || "Unnamed",
      loop_type: input.loopType,
      caddies_required: clamp(input.caddiesRequired, 1, 8),
      holes: [9, 18, 27, 36].includes(input.holes) ? input.holes : 18,
      notes: input.notes.trim(),
      requested_rank: input.requestedRank,
      requested_caddie_id: input.requestedCaddieId,
    };

    if (input.id) {
      const { data, error } = await supa
        .from("loops")
        .update(fields)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      revalidatePath(BOARD_PATH);
      return { ok: true, value: rowToLoop(data) };
    }

    const { data, error } = await supa
      .from("loops")
      .insert({ ...fields, created_by: await currentEmail() })
      .select("*")
      .single();
    if (error) throw error;
    revalidatePath(BOARD_PATH);
    return { ok: true, value: rowToLoop(data) };
  } catch (e) {
    return fail(e, "Could not save the loop.");
  }
}

export async function setLoopStatus(
  loopId: string,
  status: "Completed" | "Cancelled" | "Unassigned",
): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");
    const { error } = await supa
      .from("loops")
      .update({ status })
      .eq("id", loopId);
    if (error) throw error;
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not change the loop status.");
  }
}

export async function deleteLoop(loopId: string): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");
    const { error } = await supa.from("loops").delete().eq("id", loopId);
    if (error) throw error;
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not delete the loop.");
  }
}

export async function setOpenBoard(
  loopId: string,
  on: boolean,
): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");
    const { error } = await supa
      .from("loops")
      .update({ open_board: on })
      .eq("id", loopId);
    if (error) throw error;
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not update the job board.");
  }
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export interface OfferOutcome {
  offered: number;
  skipped: { caddieId: string; reason: string }[];
}

/**
 * Offer a loop to one or more caddies.
 *
 * One caddie is a direct offer; several is a broadcast — "first to respond gets
 * the loop". Either way this only creates the Pending rows. Nothing is sent
 * yet: the notification layer is not wired, so the shop still has to ring the
 * caddie. Wiring it is a change here and nowhere else.
 */
export async function offerLoop(
  loopId: string,
  caddieIds: string[],
): Promise<Result<OfferOutcome>> {
  try {
    if (caddieIds.length === 0) {
      return { ok: false, error: "Pick at least one caddie." };
    }

    const supa = createAdminClient("caddie");
    const settings = await getSettings();
    const by = await currentEmail();

    const broadcast = caddieIds.length > 1;
    const minutes = broadcast
      ? settings.broadcastExpiryMinutes
      : settings.offerExpiryMinutes;
    const expires = new Date(Date.now() + minutes * 60_000).toISOString();

    // Inserted one at a time on purpose. The row triggers reject an individual
    // caddie (suspended, double-booked), and a batch insert would throw the
    // whole set away with them. The shop should keep the ones that worked.
    let offered = 0;
    const skipped: { caddieId: string; reason: string }[] = [];

    for (const caddieId of caddieIds) {
      const { error } = await supa.from("assignments").insert({
        loop_id: loopId,
        caddie_id: caddieId,
        offered_by: by,
        offer_kind: broadcast ? "broadcast" : "direct",
        offer_expires_at: expires,
      });
      if (error) {
        skipped.push({
          caddieId,
          reason:
            error.code === "23505" ? "already offered this loop" : error.message,
        });
      } else {
        offered += 1;
      }
    }

    revalidatePath(BOARD_PATH);
    return { ok: true, value: { offered, skipped } };
  } catch (e) {
    return fail(e, "Could not send the offer.");
  }
}

/** Pull an offer back before the caddie answers. */
export async function withdrawOffer(assignmentId: string): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");
    const { error } = await supa
      .from("assignments")
      .update({
        confirmation_status: "Withdrawn",
        responded_at: new Date().toISOString(),
        response_channel: "admin",
      })
      .eq("id", assignmentId)
      .eq("confirmation_status", "Pending");
    if (error) throw error;
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not withdraw the offer.");
  }
}

/**
 * Answer on a caddie's behalf — they rang the shop instead of tapping.
 *
 * Goes through the same locking function the caddie's own tap uses, so a phone
 * call racing an SMS reply cannot double-fill a loop.
 */
export async function respondForCaddie(
  assignmentId: string,
  accept: boolean,
): Promise<Result<string>> {
  try {
    const supa = createAdminClient("caddie");
    const { data, error } = await supa.rpc("respond_to_offer", {
      p_assignment_id: assignmentId,
      p_accept: accept,
      p_channel: "admin",
    });
    if (error) throw error;

    const res = (data ?? {}) as {
      ok?: boolean;
      reason?: string;
      result?: string;
    };
    revalidatePath(BOARD_PATH);

    if (!res.ok) return { ok: false, error: explainRefusal(res.reason) };
    return { ok: true, value: String(res.result) };
  } catch (e) {
    return fail(e, "Could not record the response.");
  }
}

function explainRefusal(reason: string | undefined): string {
  switch (reason) {
    case "already_filled":
      return "Another caddie took this loop first.";
    case "already_responded":
      return "That offer has already been answered.";
    case "expired":
      return "That offer had already expired.";
    case "not_found":
      return "That offer no longer exists.";
    default:
      return "The offer could not be accepted.";
  }
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

/**
 * Set the caddie rate card.
 *
 * No money moves through this app — the player pays the caddie directly. These
 * figures exist so both sides see the same number before the loop goes out, so
 * they are stored in cents and only the Pro Shop can change them.
 */
export async function saveRates(
  rates: Record<string, Record<string, number>>,
): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");

    const clean: Record<string, Record<string, number>> = {};
    for (const [type, byHoles] of Object.entries(rates)) {
      clean[type] = {};
      for (const [holes, cents] of Object.entries(byHoles)) {
        clean[type][holes] = Math.max(0, Math.round(Number(cents) || 0));
      }
    }

    const { data, error: readErr } = await supa
      .from("settings")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    if (readErr) throw readErr;

    const next = { ...((data?.data ?? {}) as object), rates: clean };
    const { error } = await supa
      .from("settings")
      .update({ data: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw error;

    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save the rates.");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(Number(n) || lo)));
}

/**
 * A course-local "yyyy-mm-dd" + "HH:mm" as a real instant.
 *
 * Reads the zone offset at the naive instant, then again at the corrected one,
 * so a tee time on a DST changeover day still lands on the right hour.
 */
function localToInstant(day: string, time: string, tz: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const naive = new Date(`${day}T${time}:00Z`);
  if (Number.isNaN(naive.getTime())) return null;

  const offset = (at: Date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(at)
        .map((x) => [x.type, x.value]),
    );
    const asUTC = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour) % 24,
      Number(p.minute),
      Number(p.second),
    );
    return at.getTime() - asUTC;
  };

  const once = new Date(naive.getTime() + offset(naive));
  return new Date(naive.getTime() + offset(once)).toISOString();
}
