import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// A short-lived pass for the month-end report reader (api/merch/reports.py, a
// Python function). The reader can't see the Supabase session, so the owner's
// page gets a pass from /merch/api/refresh and sends it along with the
// reports. Both sides derive the signing key from SUPABASE_SERVICE_ROLE_KEY,
// so no extra secret needs setting up.

const TTL_S = 15 * 60;

function key(secret = process.env.SUPABASE_SERVICE_ROLE_KEY): Buffer {
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createHash("sha256").update("merch-refresh:" + secret).digest();
}

const b64url = (b: Buffer) => b.toString("base64url");

/** A pass for `email`, good for 15 minutes. */
export function reportTicket(email: string, now = Date.now(), secret?: string): string {
  const body = b64url(Buffer.from(JSON.stringify({ e: email, x: Math.floor(now / 1000) + TTL_S })));
  return `${body}.${b64url(createHmac("sha256", key(secret)).update(body).digest())}`;
}

/** The pass's email if it is genuine and unexpired (mirrors check_ticket in the Python reader). */
export function checkReportTicket(ticket: string, now = Date.now(), secret?: string): string | null {
  const [body, sig, extra] = ticket.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const want = Buffer.from(b64url(createHmac("sha256", key(secret)).update(body).digest()));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof c.x === "number" && c.x >= now / 1000 && typeof c.e === "string" ? c.e : null;
  } catch {
    return null;
  }
}
