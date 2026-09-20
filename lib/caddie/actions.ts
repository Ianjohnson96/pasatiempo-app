"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "./data";
import { getCaddieSession, mintInvite, signOutCaddie } from "./session";
import {
  rowToCaddie,
  rowToLoop,
  type CaddieRank,
  type CaddieRec,
  type CaddieStatus,
  type ContactMethod,
  type LoopRec,
  type LoopType,
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
// Roster
// ---------------------------------------------------------------------------

export interface CaddieInput {
  id?: string;
  fullName: string;
  phone: string; // as typed; normalised to E.164 here
  email: string;
  rank: CaddieRank;
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
      rank: input.rank,
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
 * the shop shows the QR on the counter screen and the caddie scans it. Single
 * use, and minting a new one kills any unused link the caddie still holds.
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
      settings.inviteDays,
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

// The origin to build the invite URL from. NEXT_PUBLIC_SITE_URL wins when set;
// otherwise the request's own host, so a link minted on a phone on the club
// wifi still points somewhere that phone can reach.
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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
