import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { remindUpcomingLoops } from "@/lib/caddie/push";

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

  // One retry, because this runs once a day and nothing notices it failing.
  //
  // Observed in testing: the first call after a cold start came back "JWT
  // issued at future". Supabase mints a short-lived token from the secret key
  // at the edge, and it can land a moment ahead of PostgREST's clock. Every
  // call after it succeeded. A daily job that gives up on a blip is a job that
  // quietly stops running.
  async function sweep(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<number> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error } = await supa.rpc(fn, args);
      if (!error) return Number(data ?? 0);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw new Error(`${fn}: ${error.message}`);
    }
    return 0;
  }

  try {
    // Sequential rather than parallel: three concurrent cold connections are
    // what provoked the failure, and nothing here is time-critical.
    // Close out played loops first: a completed loop is no longer live, so
    // nothing below should treat it as if it were.
    const completedLoops = await sweep("complete_past_loops");
    const expiredOffers = await sweep("expire_stale_offers");
    const purgedSessions = await sweep("purge_expired_sessions");
    const purgedInvites = await sweep("purge_expired_invites");
    const purgedDevices = await sweep("purge_dead_push_subscriptions");

    // Reminders last: the purges above clear out dead endpoints first, so the
    // send is not wasted against phones that are already gone.
    const reminders = await remindUpcomingLoops();

    return NextResponse.json({
      completedLoops,
      expiredOffers,
      purgedSessions,
      purgedInvites,
      purgedDevices,
      remindedLoops: reminders.reminded,
      reminderDevices: reminders.devices,
      ranAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "sweep failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
