import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToCaddie, type CaddieRec } from "./types";

// Caddie sign-in.
//
// Caddies are NOT Supabase Auth users — auth.users stays staff-only, so the
// existing admin gate is untouched. A caddie is identified by a random token in
// a cookie, backed by a row in caddie.sessions.
//
// With no email and no SMS, that token cannot be sent anywhere. The Pro Shop
// mints a single-use invite from the roster and shows it as a QR code; the
// caddie scans it at the counter, which trades the invite for a long session.
//
// Only sha256(token) is ever stored. A dump of caddie.sessions or
// caddie.invites cannot be replayed as a sign-in.

export const CADDIE_COOKIE = "caddie_session";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// ---------------------------------------------------------------------------
// Invites (Pro Shop side)
// ---------------------------------------------------------------------------

export interface Invite {
  /** The full URL to put behind the QR code. Shown once, never stored. */
  url: string;
  expiresAt: string;
}

/**
 * Create a single-use sign-in link for one caddie.
 *
 * Any unused invite the caddie already holds is dropped first, so a link handed
 * out last week stops working the moment a new one is printed.
 */
export async function mintInvite(
  caddieId: string,
  origin: string,
  createdBy: string | null,
  minutes: number,
): Promise<Invite> {
  const supa = createAdminClient("caddie");

  // Every earlier link for this caddie, spent or not. A caddie has exactly one
  // live invite, so a new one always supersedes whatever came before.
  await supa.from("invites").delete().eq("caddie_id", caddieId);

  const token = newToken();
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();

  const { error } = await supa.from("invites").insert({
    token_hash: hash(token),
    caddie_id: caddieId,
    expires_at: expiresAt,
    created_by: createdBy,
  });
  if (error) throw error;

  return { url: `${origin}/caddie/join/${token}`, expiresAt };
}

// ---------------------------------------------------------------------------
// Claiming an invite (caddie side)
// ---------------------------------------------------------------------------

export type ClaimResult =
  | { ok: true; caddie: CaddieRec }
  | { ok: false; reason: "invalid" | "expired" | "inactive" };

/**
 * Trade an invite token for a session cookie.
 *
 * The invite works as often as needed until it expires, which is soon. A caddie
 * who clears their cookies after that needs a fresh
 * link from the shop, which is the right trade for a token that was handed over
 * in the open.
 */
export async function claimInvite(
  token: string,
  sessionDays: number,
  userAgent: string | null,
): Promise<ClaimResult> {
  const supa = createAdminClient("caddie");

  const { data: invite } = await supa
    .from("invites")
    .select("*")
    .eq("token_hash", hash(token))
    .maybeSingle();

  if (!invite) return { ok: false, reason: "invalid" };
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const { data: caddieRow } = await supa
    .from("caddies")
    .select("*")
    .eq("id", invite.caddie_id)
    .maybeSingle();
  if (!caddieRow) return { ok: false, reason: "invalid" };

  const caddie = rowToCaddie(caddieRow);
  if (caddie.status !== "Active") return { ok: false, reason: "inactive" };

  // Stamp the first claim for the record, but never refuse a later one. The
  // link is not burned: a QR scanned by a camera app often opens in that app's
  // own browser, which keeps its own cookies, so the caddie's first scan
  // signed in a throwaway window and a single-use link would leave them locked
  // out with no way to tell why. Reuse costs little here — the link names one
  // caddie, so a second claim only ever mints another session for that same
  // person, and it stops mattering an hour after the shop showed it.
  if (!invite.used_at) {
    await supa
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", invite.token_hash)
      .is("used_at", null);
  }

  await issueSession(caddie.id, sessionDays, userAgent);
  return { ok: true, caddie };
}

async function issueSession(
  caddieId: string,
  days: number,
  userAgent: string | null,
): Promise<void> {
  const supa = createAdminClient("caddie");
  const token = newToken();
  const expiresAt = new Date(Date.now() + days * 86_400_000);

  const { error } = await supa.from("sessions").insert({
    token_hash: hash(token),
    caddie_id: caddieId,
    expires_at: expiresAt.toISOString(),
    last_seen_at: new Date().toISOString(),
    user_agent: userAgent,
  });
  if (error) throw error;

  const jar = await cookies();
  jar.set(CADDIE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

// ---------------------------------------------------------------------------
// Reading the session
// ---------------------------------------------------------------------------

/**
 * The signed-in caddie, or null.
 *
 * Returns null for a revoked or expired session and for a caddie who has since
 * been deactivated — a suspended caddie should not keep working off a cookie
 * minted before the suspension.
 */
export async function getCaddieSession(): Promise<CaddieRec | null> {
  const jar = await cookies();
  const token = jar.get(CADDIE_COOKIE)?.value;
  if (!token) return null;

  const supa = createAdminClient("caddie");
  const tokenHash = hash(token);

  const { data: session } = await supa
    .from("sessions")
    .select("caddie_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: row } = await supa
    .from("caddies")
    .select("*")
    .eq("id", session.caddie_id)
    .maybeSingle();
  if (!row) return null;

  const caddie = rowToCaddie(row);
  if (caddie.status !== "Active") return null;

  // Best-effort activity stamp; never block the page on it.
  await supa
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  return caddie;
}

/** Sign the caddie out on this device. */
export async function signOutCaddie(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CADDIE_COOKIE)?.value;
  if (token) {
    const supa = createAdminClient("caddie");
    await supa
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hash(token));
  }
  jar.delete(CADDIE_COOKIE);
}
