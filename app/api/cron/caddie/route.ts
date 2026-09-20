import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Housekeeping for the caddie section, run by Vercel Cron (see vercel.json).
//
// Without this, an offer nobody answered sits on the dispatch board as Pending
// for ever. The database refuses to accept it once the window has passed, so
// the loop is not really at risk — but the board lies about it, which is worse
// than useless when the shop is deciding who to ring next.
//
// Everything here is idempotent: running it twice changes nothing the second
// time, so a retried or overlapping invocation is harmless.

export const dynamic = "force-dynamic";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without the secret
// set the route stays closed rather than silently running for anyone who finds
// the URL — this endpoint mutates rows.
function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const supa = createAdminClient("caddie");

  const [offers, sessions, invites] = await Promise.all([
    supa.rpc("expire_stale_offers"),
    supa.rpc("purge_expired_sessions"),
    supa.rpc("purge_expired_invites"),
  ]);

  const failed = [offers, sessions, invites].filter((r) => r.error);
  if (failed.length > 0) {
    return NextResponse.json(
      { error: failed.map((r) => r.error?.message).join("; ") },
      { status: 500 },
    );
  }

  return NextResponse.json({
    expiredOffers: offers.data ?? 0,
    purgedSessions: sessions.data ?? 0,
    purgedInvites: invites.data ?? 0,
    ranAt: new Date().toISOString(),
  });
}
