"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { planBooking } from "./booking";
import { dayRange, getSettings } from "./data";
import { resolveOrigin } from "./origin";
import { getCaddieSession, mintInvite, signOutCaddie } from "./session";
import {
  notifyActiveCaddies,
  notifyCaddies,
  removePushSubscription,
  savePushSubscription,
} from "./push";
import {
  DEFAULT_HOLES,
  TEE_INTERVAL_MINUTES,
  rateFor,
  rowToCaddie,
  rowToLoop,
  type CaddieRec,
  type CaddieStatus,
  type ContactMethod,
  type DefaultSlot,
  type GroupNeed,
  type LoopRec,
  type LoopType,
  type Waterfall,
} from "./types";

// Write-side. Every mutation the Pro Shop makes goes through here.
//
// Accept/decline is the exception: it never writes assignments directly, it
// calls the caddie.respond_to_offer() function, which takes the row locks that
// make "first to respond gets the loop" safe. The same function backs the
// caddie's own tap and the inbound SMS webhook, so all three paths agree.

const BOARD_PATH = "/admin/caddie";
const ROSTER_PATH = "/admin/caddie/roster";
const RATES_PATH = "/admin/caddie/rates";

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
  /** Pasatiempo plays 18; the form does not ask. Kept for the odd 9-holer. */
  holes?: number;
  notes: string;
  bookingId?: string | null;
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
      holes:
        input.holes && [9, 18, 27, 36].includes(input.holes)
          ? input.holes
          : DEFAULT_HOLES,
      notes: input.notes.trim(),
      booking_id: input.bookingId ?? null,
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

export interface GroupInput {
  /** Course-local day, "yyyy-mm-dd". */
  day: string;
  /** Course-local time of the FIRST tee time, "HH:mm" (24h). */
  time: string;
  /** The party — "Whitmore foursome", a member name, an outing. */
  name: string;
  /**
   * What each tee time needs, in order, one entry per group.
   *
   * An empty list means that group is playing without a caddie — which is the
   * point: a party of sixteen where only the first and fourth groups want one
   * is a single booking, not two bookings with a gap nobody can see.
   */
  groups: GroupNeed[][];
  notes: string;
  /** Minutes between tee times. Defaults to the course's ten. */
  intervalMinutes?: number;
}

/**
 * Book a party across consecutive tee times in one go.
 *
 * Twelve players wanting forecaddies off the 12:00, 12:10 and 12:20 is one
 * phone call, so it should be one entry — not three trips through the form.
 * The loops share a booking, which is what lets the board show them as the
 * single job they actually are.
 *
 * Each group carries its own list of needs, because a group is rarely one
 * thing: two double bags, or a double and a single, or a double and a
 * forecaddie for the other two. Every need becomes its own loop, so each can
 * be offered, accepted and paid independently, which is how the work is
 * actually done.
 */
export async function createGroupBooking(
  input: GroupInput,
): Promise<Result<{ bookingId: string; created: number }>> {
  try {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "The group needs a name." };

    const groups = (input.groups ?? []).slice(0, 20);
    if (groups.length === 0) {
      return { ok: false, error: "Add at least one tee time." };
    }
    // A booking where nobody wants a caddie is a tee sheet entry, not a job.
    const totalNeeds = groups.reduce(
      (n, g) => n + g.filter((x) => x.count > 0).length,
      0,
    );
    if (totalNeeds === 0) {
      return {
        ok: false,
        error: "No group wants a caddie. Add at least one before booking.",
      };
    }
    const interval = clamp(
      input.intervalMinutes ?? TEE_INTERVAL_MINUTES,
      1,
      60,
    );

    const supa = createAdminClient("caddie");
    const { courseTimezone } = await getSettings();
    const by = await currentEmail();

    const first = localToInstant(input.day, input.time, courseTimezone);
    if (!first) return { ok: false, error: "That tee time is not a real date." };

    const { data: booking, error: bookingErr } = await supa
      .from("bookings")
      .insert({ name, notes: input.notes.trim(), created_by: by })
      .select("id")
      .single();
    if (bookingErr) throw bookingErr;

    const rows = planBooking({
      startMs: new Date(first).getTime(),
      name,
      groups,
      intervalMinutes: interval,
    }).map((p) => ({
      tee_time: p.teeTime,
      player_name: p.playerName,
      loop_type: p.loopType,
      caddies_required: p.caddiesRequired,
      holes: DEFAULT_HOLES,
      notes: input.notes.trim(),
      booking_id: String(booking.id),
      created_by: by,
    }));

    const { error } = await supa.from("loops").insert(rows);
    if (error) throw error;

    revalidatePath(BOARD_PATH);
    return {
      ok: true,
      value: { bookingId: String(booking.id), created: rows.length },
    };
  } catch (e) {
    return fail(e, "Could not book the group.");
  }
}

export async function setLoopStatus(
  loopId: string,
  status: "Completed" | "Cancelled" | "Unassigned",
): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");

    // Cancelling is signed; restoring clears the signature rather than leaving
    // a stale one behind claiming someone cancelled a live loop.
    const audit =
      status === "Cancelled"
        ? { cancelled_at: new Date().toISOString(), cancelled_by: await currentEmail() }
        : { cancelled_at: null, cancelled_by: null };

    const { error } = await supa
      .from("loops")
      .update({ status, ...audit })
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
// Whole-day operations
// ---------------------------------------------------------------------------

/**
 * Call the day off — weather, usually.
 *
 * Rain does not cancel one loop, it cancels the sheet, and doing that a row at
 * a time while the phone rings is not a workflow. Completed loops are left
 * alone: they already happened. Pending offers are withdrawn in the same pass
 * so nobody accepts a loop that is no longer on.
 */
export async function cancelDay(day: string): Promise<Result<number>> {
  try {
    const supa = createAdminClient("caddie");
    const { courseTimezone } = await getSettings();
    const { from, to } = dayRange(day, courseTimezone);

    const { data: affected, error: readErr } = await supa
      .from("loops")
      .select("id")
      .gte("tee_time", from)
      .lt("tee_time", to)
      .not("status", "in", '("Completed","Cancelled")');
    if (readErr) throw readErr;

    const ids = (affected ?? []).map((r) => String(r.id));
    if (ids.length === 0) return { ok: true, value: 0 };

    // Offers first: a caddie accepting between these two statements would be
    // accepting a loop that is about to be cancelled anyway, and this way the
    // board never shows a pending offer against a cancelled loop.
    const { error: offerErr } = await supa
      .from("assignments")
      .update({
        confirmation_status: "Withdrawn",
        responded_at: new Date().toISOString(),
        response_channel: "admin",
      })
      .in("loop_id", ids)
      .eq("confirmation_status", "Pending");
    if (offerErr) throw offerErr;

    const { error } = await supa
      .from("loops")
      .update({
        status: "Cancelled",
        open_board: false,
        cancelled_at: new Date().toISOString(),
        cancelled_by: await currentEmail(),
      })
      .in("id", ids);
    if (error) throw error;

    revalidatePath(BOARD_PATH);
    return { ok: true, value: ids.length };
  } catch (e) {
    return fail(e, "Could not cancel the day.");
  }
}

/**
 * Copy one day's loops onto another date.
 *
 * Most Saturdays look like the last Saturday, and retyping the sheet is the
 * kind of chore that stops people using the tool at all. Copies the jobs only —
 * never the caddies — because who worked last Saturday is a fact about last
 * Saturday, not a booking for the next one.
 */
export async function duplicateDay(
  fromDay: string,
  toDay: string,
): Promise<Result<number>> {
  try {
    if (fromDay === toDay) {
      return { ok: false, error: "Pick a different date to copy to." };
    }

    const supa = createAdminClient("caddie");
    const { courseTimezone } = await getSettings();
    const { from, to } = dayRange(fromDay, courseTimezone);

    const { data: rows, error: readErr } = await supa
      .from("loops")
      .select("*")
      .gte("tee_time", from)
      .lt("tee_time", to)
      .neq("status", "Cancelled")
      .order("tee_time", { ascending: true });
    if (readErr) throw readErr;

    const source = (rows ?? []).map(rowToLoop);
    if (source.length === 0) {
      return { ok: false, error: "That day has no loops to copy." };
    }

    const by = await currentEmail();
    const offsetDays = daysBetween(fromDay, toDay);

    const copies = source.map((l) => ({
      // Shift by whole days so the tee time lands at the same wall clock even
      // across a daylight-saving boundary.
      tee_time: shiftInstantByDays(l.teeTime, offsetDays, courseTimezone),
      player_name: l.playerName,
      loop_type: l.loopType,
      caddies_required: l.caddiesRequired,
      holes: l.holes,
      notes: l.notes,
      booking_id: l.bookingId,
      created_by: by,
    }));

    const { error } = await supa.from("loops").insert(copies);
    if (error) throw error;

    revalidatePath(BOARD_PATH);
    return { ok: true, value: copies.length };
  } catch (e) {
    return fail(e, "Could not copy the day.");
  }
}

function daysBetween(a: string, b: string): number {
  const ms =
    new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Move an instant forward N calendar days, keeping the course-local wall clock.
 *
 * Adding N*24h would drift by an hour across a daylight-saving change and put
 * a 7:40 tee time out at 6:40 or 8:40.
 */
function shiftInstantByDays(iso: string, days: number, tz: string): string {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => local.find((p) => p.type === t)?.value ?? "00";

  const day = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
  const shifted = new Date(`${day}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);

  return (
    localToInstant(shifted.toISOString().slice(0, 10), time, tz) ??
    new Date(iso).toISOString()
  );
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export interface OfferOutcome {
  offered: number;
  skipped: { caddieId: string; reason: string }[];
  /** Devices actually reached. Offered but not notified means no alerts on. */
  notified: number;
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

    const { data: loopRow, error: loopErr } = await supa
      .from("loops")
      .select("tee_time, status")
      .eq("id", loopId)
      .maybeSingle();
    if (loopErr) throw loopErr;
    if (!loopRow) return { ok: false, error: "That loop no longer exists." };
    if (new Date(String(loopRow.tee_time)).getTime() < Date.now()) {
      return { ok: false, error: "That loop has already teed off." };
    }

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

    // Tell the people we just offered it to.
    //
    // This used to do nothing at all: the offer rows appeared on the board and
    // the caddies were never told, so a targeted offer only worked if someone
    // happened to open the portal. Only "Call all" ever notified anybody.
    let notified = 0;
    if (offered > 0) {
      const offeredIds = caddieIds.filter(
        (id) => !skipped.some((s) => s.caddieId === id),
      );
      const push = await notifyCaddies(
        offeredIds,
        await offerAlert(loopId, broadcast),
      );
      notified = push.sent;
    }

    revalidatePath(BOARD_PATH);
    revalidatePath("/caddie");
    return { ok: true, value: { offered, skipped, notified } };
  } catch (e) {
    return fail(e, "Could not send the offer.");
  }
}

/**
 * Offer a loop to whole tiers at once.
 *
 * What the seniority ladder is actually for. Offering to the top tier and
 * widening only if nobody bites is how a caddie programme stays fair without
 * the shop having to remember who is owed a loop — and unlike a job-board
 * post, nobody outside those tiers can take it.
 */
export async function offerToTiers(
  loopId: string,
  tierIds: string[],
): Promise<Result<OfferOutcome>> {
  try {
    if (tierIds.length === 0) {
      return { ok: false, error: "Pick at least one tier." };
    }

    const supa = createAdminClient("caddie");
    const { data, error } = await supa
      .from("caddies")
      .select("id")
      .eq("status", "Active")
      .in("tier_id", tierIds);
    if (error) throw error;

    const ids = (data ?? []).map((r) => String(r.id));
    if (ids.length === 0) {
      return { ok: false, error: "No active caddies are in those tiers." };
    }

    return await offerLoop(loopId, ids);
  } catch (e) {
    return fail(e, "Could not offer to those tiers.");
  }
}

/** The wording a caddie sees when they are offered a loop directly. */
async function offerAlert(loopId: string, broadcast: boolean) {
  const supa = createAdminClient("caddie");
  const settings = await getSettings();

  const { data } = await supa
    .from("loops")
    .select("*")
    .eq("id", loopId)
    .maybeSingle();

  const loop = data ? rowToLoop(data) : null;
  const when = loop
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: settings.courseTimezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(loop.teeTime))
    : "";
  const rate = loop ? rateFor(settings.rates, loop.loopType) : null;

  return {
    title: broadcast
      ? "Loop offered — first to answer"
      : "You've been offered a loop",
    body: loop
      ? `${when} · ${loop.loopType}` +
        (rate ? ` · $${Math.round(rate / 100)}` : "") +
        `\n${loop.playerName}. Tap to accept or decline.`
      : "Tap to accept or decline.",
    url: "/caddie",
    tag: `offer-${loopId}`,
    loopId,
  };
}

/**
 * Push an offer again at whoever has not answered yet.
 *
 * The shop's alternative is ringing them, which is the thing this app exists
 * to stop. Only caddies still sitting on Pending are nudged — anyone who has
 * already said no is left alone, because re-asking a decline is how a tool
 * turns into a nuisance.
 */
export async function nudgePending(loopId: string): Promise<Result<number>> {
  try {
    const supa = createAdminClient("caddie");

    const { data: loopRow, error: loopErr } = await supa
      .from("loops")
      .select("tee_time, status")
      .eq("id", loopId)
      .maybeSingle();
    if (loopErr) throw loopErr;
    if (!loopRow) return { ok: false, error: "That loop no longer exists." };
    if (new Date(String(loopRow.tee_time)).getTime() < Date.now()) {
      return { ok: false, error: "That loop has already teed off." };
    }

    const { data, error } = await supa
      .from("assignments")
      .select("caddie_id")
      .eq("loop_id", loopId)
      .eq("confirmation_status", "Pending");
    if (error) throw error;

    const ids = (data ?? []).map((r) => String(r.caddie_id));
    if (ids.length === 0) {
      return { ok: false, error: "Nobody is still deciding on this loop." };
    }

    const alert = await offerAlert(loopId, false);
    const push = await notifyCaddies(ids, {
      ...alert,
      title: "Still waiting on you",
      // A distinct tag so the nudge lands as a new notification rather than
      // silently replacing the original offer the caddie has not opened.
      tag: `nudge-${loopId}-${Date.now()}`,
    });

    revalidatePath(BOARD_PATH);
    return { ok: true, value: push.sent };
  } catch (e) {
    return fail(e, "Could not send the nudge.");
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

/**
 * The caddie answering their own offer from the portal.
 *
 * Ownership is checked here against the cookie session — the assignment id is
 * in the page, so without this a caddie could accept someone else's loop by
 * replaying an id. Same locking function as every other path.
 */
export async function respondToMyOffer(
  assignmentId: string,
  accept: boolean,
): Promise<Result<string>> {
  try {
    const caddie = await getCaddieSession();
    if (!caddie) {
      return { ok: false, error: "You are signed out. Ask the shop for a new link." };
    }

    const supa = createAdminClient("caddie");
    const { data: owned, error: readErr } = await supa
      .from("assignments")
      .select("id")
      .eq("id", assignmentId)
      .eq("caddie_id", caddie.id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!owned) return { ok: false, error: "That offer is not yours." };

    const { data, error } = await supa.rpc("respond_to_offer", {
      p_assignment_id: assignmentId,
      p_accept: accept,
      p_channel: "web",
    });
    if (error) throw error;

    const res = (data ?? {}) as {
      ok?: boolean;
      reason?: string;
      result?: string;
    };
    revalidatePath("/caddie");
    revalidatePath(BOARD_PATH);

    if (!res.ok) return { ok: false, error: explainRefusal(res.reason) };
    return { ok: true, value: String(res.result) };
  } catch (e) {
    return fail(e, "Could not record your answer.");
  }
}

/**
 * A caddie taking a loop straight off the open job board.
 *
 * No offer exists here, so this inserts the assignment already Accepted and
 * leans on the guard trigger, which locks the loop row before checking
 * capacity, the overlap window and the caddie's status. Two caddies tapping
 * Claim at the same instant therefore serialise: one gets the loop, the other
 * gets told it went.
 */
export async function claimOpenLoop(loopId: string): Promise<Result> {
  try {
    const caddie = await getCaddieSession();
    if (!caddie) {
      return {
        ok: false,
        error: "You are signed out. Ask the shop for a new link.",
      };
    }

    const supa = createAdminClient("caddie");

    // Only loops the shop actually posted can be claimed this way; without
    // this check the loop id alone would be enough to jump onto any job.
    const { data: loop, error: loopErr } = await supa
      .from("loops")
      .select("id, open_board, status")
      .eq("id", loopId)
      .maybeSingle();
    if (loopErr) throw loopErr;
    if (!loop || !loop.open_board) {
      return { ok: false, error: "That loop is no longer on the job board." };
    }

    const { error } = await supa.from("assignments").insert({
      loop_id: loopId,
      caddie_id: caddie.id,
      offer_kind: "broadcast",
      confirmation_status: "Accepted",
      responded_at: new Date().toISOString(),
      response_channel: "web",
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("already filled")) {
        return { ok: false, error: "Another caddie took that one first." };
      }
      if (msg.includes("within")) {
        return {
          ok: false,
          error: "You already have a loop too close to that tee time.",
        };
      }
      if (error.code === "23505") {
        return { ok: false, error: "You are already on that loop." };
      }
      throw error;
    }

    revalidatePath("/caddie");
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not claim that loop.");
  }
}

// ---------------------------------------------------------------------------
// Job alerts
// ---------------------------------------------------------------------------

/** Register this device for job alerts. */
export async function subscribeToPush(keys: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<Result> {
  try {
    const caddie = await getCaddieSession();
    if (!caddie) {
      return { ok: false, error: "You are signed out." };
    }
    const ua = (await headers()).get("user-agent");
    await savePushSubscription(caddie.id, keys, ua);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not turn on job alerts.");
  }
}

export async function unsubscribeFromPush(endpoint: string): Promise<Result> {
  try {
    await removePushSubscription(endpoint);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not turn off job alerts.");
  }
}

/**
 * Post a loop to every active caddie at once.
 *
 * This is the job the app exists to do. A member rings wanting a caddie on
 * Saturday; instead of texting the roster one at a time, the shop presses this
 * and every phone buzzes. First to claim takes it.
 */
export async function callAllCaddies(loopId: string): Promise<Result<number>> {
  try {
    const supa = createAdminClient("caddie");
    const settings = await getSettings();

    const { data: row, error } = await supa
      .from("loops")
      .select("*")
      .eq("id", loopId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return { ok: false, error: "That loop no longer exists." };

    const loop = rowToLoop(row);
    if (loop.status === "Cancelled") {
      return { ok: false, error: "That loop is cancelled." };
    }
    // The board hides the button on past loops, but the action is the thing
    // that must refuse: a stale tab from this morning would otherwise buzz
    // every caddie about a round that has already been played.
    if (new Date(loop.teeTime).getTime() < Date.now()) {
      return { ok: false, error: "That loop has already teed off." };
    }

    // Posting to the board is what makes it claimable; the alert only tells
    // people to go and look.
    const { error: postErr } = await supa
      .from("loops")
      .update({ open_board: true })
      .eq("id", loopId);
    if (postErr) throw postErr;

    const when = new Intl.DateTimeFormat("en-US", {
      timeZone: settings.courseTimezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(loop.teeTime));

    const rate = rateFor(settings.rates, loop.loopType);

    // Caddies already on this loop do not need telling about it.
    const { data: already } = await supa
      .from("assignments")
      .select("caddie_id")
      .eq("loop_id", loopId)
      .in("confirmation_status", ["Pending", "Accepted"]);

    const result = await notifyActiveCaddies(
      {
        title: "Loop available",
        body:
          `${when} · ${loop.loopType}` +
          (rate ? ` · $${Math.round(rate / 100)}` : "") +
          `\n${loop.playerName}. First to claim gets it.`,
        url: "/caddie",
        tag: `loop-${loopId}`,
        loopId,
      },
      {
        excludeCaddieIds: (already ?? []).map((r) => String(r.caddie_id)),
      },
    );

    revalidatePath(BOARD_PATH);
    revalidatePath("/caddie");
    return { ok: true, value: result.sent };
  } catch (e) {
    return fail(e, "Could not send the caddie call.");
  }
}

/**
 * What the caddie can say about a day. "Off" is a deliberate no, which is not
 * the same as saying nothing — the dispatch board shows the difference.
 */
export type AvailabilityChoice = "AM" | "PM" | "All Day" | "Off" | "Clear";

/**
 * Record one day of availability for the signed-in caddie.
 *
 * Exactly one row per caddie per day: the old rows for that date are cleared
 * first, so switching from AM to All Day cannot leave a stale AM row behind to
 * be found by the dispatch query.
 *
 * The caddie comes from the cookie, never from an argument — otherwise anyone
 * could post availability for anyone.
 */
export async function setAvailability(
  date: string,
  choice: AvailabilityChoice,
): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: "That is not a real date." };
    }

    const caddie = await getCaddieSession();
    if (!caddie) {
      return {
        ok: false,
        error: "You are signed out. Ask the shop for a new link.",
      };
    }

    const supa = createAdminClient("caddie");
    const { error: clearErr } = await supa
      .from("availability")
      .delete()
      .eq("caddie_id", caddie.id)
      .eq("date", date);
    if (clearErr) throw clearErr;

    if (choice !== "Clear") {
      const { error } = await supa.from("availability").insert({
        caddie_id: caddie.id,
        date,
        time_slot: choice === "Off" ? "All Day" : choice,
        status: choice === "Off" ? "Unavailable" : "Available",
      });
      if (error) throw error;
    }

    revalidatePath("/caddie/availability");
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save that day.");
  }
}

/**
 * Set the caddie's standing pattern for one weekday.
 *
 * "I work Saturdays" said once, rather than ticked forty times. Passing null
 * clears the weekday back to unknown, which the shop reads differently from a
 * standing Off.
 */
export async function setUsualDay(
  weekday: number,
  slot: DefaultSlot | null,
): Promise<Result> {
  try {
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return { ok: false, error: "That is not a day of the week." };
    }
    const caddie = await getCaddieSession();
    if (!caddie) return { ok: false, error: "You are signed out." };

    const supa = createAdminClient("caddie");

    if (slot === null) {
      const { error } = await supa
        .from("availability_defaults")
        .delete()
        .eq("caddie_id", caddie.id)
        .eq("weekday", weekday);
      if (error) throw error;
    } else {
      const { error } = await supa.from("availability_defaults").upsert(
        {
          caddie_id: caddie.id,
          weekday,
          slot,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "caddie_id,weekday" },
      );
      if (error) throw error;
    }

    revalidatePath("/caddie/availability");
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save your usual week.");
  }
}

/**
 * Book a stretch of days off — a holiday, a trip, surgery.
 *
 * One entry instead of a fortnight of taps, and it outranks everything else,
 * so a caddie who is away does not get offered loops because their usual week
 * says Saturdays.
 */
export async function addAwayPeriod(input: {
  startsOn: string;
  endsOn: string;
  reason: string;
}): Promise<Result> {
  try {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(input.startsOn) || !iso.test(input.endsOn)) {
      return { ok: false, error: "Pick a start and end date." };
    }
    if (input.endsOn < input.startsOn) {
      return { ok: false, error: "The end date is before the start date." };
    }

    const caddie = await getCaddieSession();
    if (!caddie) return { ok: false, error: "You are signed out." };

    const supa = createAdminClient("caddie");
    const { error } = await supa.from("away_periods").insert({
      caddie_id: caddie.id,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      reason: input.reason.trim(),
    });
    if (error) throw error;

    revalidatePath("/caddie/availability");
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save that time away.");
  }
}

export async function removeAwayPeriod(id: string): Promise<Result> {
  try {
    const caddie = await getCaddieSession();
    if (!caddie) return { ok: false, error: "You are signed out." };

    const supa = createAdminClient("caddie");
    // Scoped to the session's own caddie: the id comes from the page, so
    // without this anyone could delete someone else's time off.
    const { error } = await supa
      .from("away_periods")
      .delete()
      .eq("id", id)
      .eq("caddie_id", caddie.id);
    if (error) throw error;

    revalidatePath("/caddie/availability");
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not remove that time away.");
  }
}

/** Sign the caddie out on this device, from the portal. */
export async function caddieSignOut(): Promise<Result> {
  try {
    await signOutCaddie();
    revalidatePath("/caddie");
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not sign out.");
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
// Tiers
// ---------------------------------------------------------------------------

const TIERS_PATH = "/admin/caddie/tiers";

export interface TierInput {
  id?: string;
  name: string;
  description: string;
}

/**
 * Create or rename a tier.
 *
 * New tiers land at the bottom of the ladder; order is changed with the arrows
 * on the tiers page rather than by typing a number, because the only thing that
 * matters is which tier is above which.
 */
export async function saveTier(input: TierInput): Promise<Result> {
  try {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "A tier needs a name." };

    const supa = createAdminClient("caddie");

    if (input.id) {
      const { error } = await supa
        .from("tiers")
        .update({ name, description: input.description.trim() })
        .eq("id", input.id);
      if (error) {
        if (error.code === "23505") {
          return { ok: false, error: `There is already a tier called ${name}.` };
        }
        throw error;
      }
    } else {
      const { data: last } = await supa
        .from("tiers")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { error } = await supa.from("tiers").insert({
        name,
        description: input.description.trim(),
        sort_order: Number(last?.sort_order ?? 0) + 10,
      });
      if (error) {
        if (error.code === "23505") {
          return { ok: false, error: `There is already a tier called ${name}.` };
        }
        throw error;
      }
    }

    revalidatePath(TIERS_PATH);
    revalidatePath(ROSTER_PATH);
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save the tier.");
  }
}

/**
 * Move a tier one place up or down the ladder.
 *
 * Swaps sort_order with its neighbour rather than renumbering the table, so
 * the operation touches two rows however long the list gets.
 */
export async function moveTier(
  tierId: string,
  direction: "up" | "down",
): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");

    const { data: rows, error: readErr } = await supa
      .from("tiers")
      .select("id, sort_order")
      .order("sort_order", { ascending: true });
    if (readErr) throw readErr;

    const list = rows ?? [];
    const i = list.findIndex((t) => String(t.id) === tierId);
    if (i === -1) return { ok: false, error: "That tier no longer exists." };

    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) return { ok: true, value: undefined };

    const a = list[i];
    const b = list[j];
    const { error } = await supa.from("tiers").upsert([
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ]);
    if (error) throw error;

    revalidatePath(TIERS_PATH);
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not reorder the tiers.");
  }
}

/**
 * Delete a tier.
 *
 * Refused while caddies are still in it: the FK would quietly null their tier
 * and drop them to the bottom of every dispatch list without anyone noticing.
 * Move them first.
 */
export async function deleteTier(tierId: string): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");

    const { count, error: countErr } = await supa
      .from("caddies")
      .select("*", { count: "exact", head: true })
      .eq("tier_id", tierId);
    if (countErr) throw countErr;

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `${count} ${
          count === 1 ? "caddie is" : "caddies are"
        } still in this tier. Move them to another tier first.`,
      };
    }

    const { error } = await supa.from("tiers").delete().eq("id", tierId);
    if (error) throw error;

    revalidatePath(TIERS_PATH);
    revalidatePath(ROSTER_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not delete the tier.");
  }
}

/**
 * Save the tier escalation rules.
 *
 * Clamped rather than trusted: a zero-minute window would widen a loop to the
 * whole roster on the first sweep, which is the opposite of a seniority ladder.
 */
export async function saveWaterfall(input: Waterfall): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");

    const clean = {
      enabled: Boolean(input.enabled),
      urgentWithinHours: clamp(input.urgentWithinHours, 1, 72),
      urgentMinutes: clamp(input.urgentMinutes, 1, 600),
      soonWithinHours: clamp(input.soonWithinHours, 1, 336),
      soonMinutes: clamp(input.soonMinutes, 1, 1440),
      laterMinutes: clamp(input.laterMinutes, 1, 4320),
    };

    const { data, error: readErr } = await supa
      .from("settings")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    if (readErr) throw readErr;

    const next = { ...((data?.data ?? {}) as object), waterfall: clean };
    const { error } = await supa
      .from("settings")
      .update({ data: next, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw error;

    revalidatePath(TIERS_PATH);
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not save the escalation rules.");
  }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export interface CaddieInput {
  id?: string;
  fullName: string;
  phone: string; // as typed; normalised to E.164 here
  email: string;
  tierId: string | null;
  status: CaddieStatus;
  preferredContactMethod: ContactMethod;
  notes: string;
}

export async function saveCaddie(input: CaddieInput): Promise<Result<CaddieRec>> {
  try {
    const fullName = input.fullName.trim();
    if (!fullName) return { ok: false, error: "A caddie needs a name." };

    const phone = normalisePhone(input.phone);
    if (input.phone.trim() && !phone) {
      return {
        ok: false,
        error: "That phone number does not look right. Use 10 digits, e.g. 831 459 9155.",
      };
    }
    const email = input.email.trim().toLowerCase() || null;

    // Mirrors caddies_reachable_chk. Checked here so the caddie sees a sentence
    // rather than a constraint name.
    const reachable =
      input.preferredContactMethod === "SMS"
        ? !!phone
        : input.preferredContactMethod === "Email"
          ? !!email
          : !!phone || !!email;
    if (!reachable) {
      return {
        ok: false,
        error:
          input.preferredContactMethod === "SMS"
            ? "A caddie contacted by SMS needs a phone number."
            : input.preferredContactMethod === "Email"
              ? "A caddie contacted by email needs an email address."
              : "Add a phone number or an email address.",
      };
    }

    const supa = createAdminClient("caddie");
    const fields = {
      full_name: fullName,
      phone,
      email,
      tier_id: input.tierId,
      status: input.status,
      preferred_contact_method: input.preferredContactMethod,
      notes: input.notes.trim(),
    };

    const q = input.id
      ? supa.from("caddies").update(fields).eq("id", input.id).select("*").single()
      : supa.from("caddies").insert(fields).select("*").single();

    const { data, error } = await q;
    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: error.message.includes("phone")
            ? "Another caddie already has that phone number."
            : "Another caddie already has that email address.",
        };
      }
      throw error;
    }

    revalidatePath(ROSTER_PATH);
    revalidatePath(BOARD_PATH);
    return { ok: true, value: rowToCaddie(data) };
  } catch (e) {
    return fail(e, "Could not save the caddie.");
  }
}

/**
 * Move a caddie between tiers.
 *
 * Its own action rather than a saveCaddie round trip: promoting someone is a
 * one-tap job the shop does often, and it should not mean opening an edit form
 * and re-submitting every other field alongside it.
 */
export async function setCaddieTier(
  caddieId: string,
  tierId: string,
): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");
    const { error } = await supa
      .from("caddies")
      .update({ tier_id: tierId })
      .eq("id", caddieId);
    if (error) throw error;
    revalidatePath(ROSTER_PATH);
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not change the caddie's tier.");
  }
}

export async function setCaddieStatus(
  caddieId: string,
  status: CaddieStatus,
): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");
    const { error } = await supa
      .from("caddies")
      .update({ status })
      .eq("id", caddieId);
    if (error) throw error;
    revalidatePath(ROSTER_PATH);
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not change the caddie's status.");
  }
}

/**
 * Remove a caddie outright.
 *
 * Refused once they have any loop history — assignments cascade, so deleting
 * would silently erase who worked what. Setting them Inactive is almost always
 * what the shop actually means.
 */
export async function deleteCaddie(caddieId: string): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");
    const { count, error: countErr } = await supa
      .from("assignments")
      .select("*", { count: "exact", head: true })
      .eq("caddie_id", caddieId);
    if (countErr) throw countErr;

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error:
          "This caddie has loop history. Set them Inactive instead — deleting would erase the record of loops they worked.",
      };
    }

    const { error } = await supa.from("caddies").delete().eq("id", caddieId);
    if (error) throw error;
    revalidatePath(ROSTER_PATH);
    revalidatePath(BOARD_PATH);
    return { ok: true, value: undefined };
  } catch (e) {
    return fail(e, "Could not remove the caddie.");
  }
}

export interface InviteHandout {
  url: string;
  /** Inline SVG for the QR code — rendered on the server, no client library. */
  qrSvg: string;
  expiresAt: string;
}

/**
 * Mint a sign-in link for one caddie, as a URL and a QR code.
 *
 * This app sends no email and no SMS, so the link is handed over in person:
 * the shop shows the QR on the counter screen and the caddie scans it. Good for
 * an hour and reusable within it, so a scan that lands in a camera app's own
 * browser does not strand the caddie. Minting a new one kills the old link.
 */
export async function createInvite(
  caddieId: string,
): Promise<Result<InviteHandout>> {
  try {
    const settings = await getSettings();
    const origin = await siteOrigin();
    const invite = await mintInvite(
      caddieId,
      origin,
      await currentEmail(),
      settings.inviteMinutes,
    );
    const qrSvg = await QRCode.toString(invite.url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
    });
    revalidatePath(ROSTER_PATH);
    return { ok: true, value: { ...invite, qrSvg } };
  } catch (e) {
    return fail(e, "Could not create the sign-in link.");
  }
}

// The origin to build the invite URL from. NEXT_PUBLIC_SITE_URL wins when set
// and plausible; otherwise the request's own host, so a link minted on a phone
// on the club wifi still points somewhere that phone can reach.
//
// "Plausible" is doing real work here — see resolveOrigin. A localhost value
// left in a production environment used to win outright, and every invite it
// minted was dead on arrival.
async function siteOrigin(): Promise<string> {
  const h = await headers();
  return resolveOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    host: h.get("host"),
    proto: h.get("x-forwarded-proto"),
  });
}

/**
 * US-centric phone normalisation to E.164, which is what the check constraint
 * and Twilio both want. Ten digits get +1; anything already international is
 * kept as typed. Returns null for empty input, and null for anything that
 * cannot be made into a valid number so the caller can complain properly.
 */
function normalisePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let e164: string;
  if (hadPlus) e164 = `+${digits}`;
  else if (digits.length === 10) e164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith("1")) e164 = `+${digits}`;
  else return null;

  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
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
export async function saveRates(rates: Record<string, number>): Promise<Result> {
  try {
    const supa = createAdminClient("caddie");

    const clean: Record<string, number> = {};
    for (const [type, cents] of Object.entries(rates)) {
      clean[type] = Math.max(0, Math.round(Number(cents) || 0));
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

    revalidatePath(RATES_PATH);
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
