import { NextResponse, type NextRequest } from "next/server";
import { syncLessons } from "@/lib/lessons/sync";
import { logActivity } from "@/lib/hub/log";

// Pulls Ian's Outlook calendar into the lesson book. Run nightly by Vercel
// Cron (vercel.json).
//
// `?dry=1` reports what it would do and writes nothing. The first run must use
// it: the 283 seeded lessons carry no calendar_uid, so this is the one moment
// a bad match would double the whole book rather than update it.

export const dynamic = "force-dynamic";
// Several hundred events over two Graph pages, then a write each. The default
// 10s is not enough, and a timeout here reads as a sync that simply stopped.
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const dryRun = params.get("dry") === "1";

  // `?days=N` widens the look-back for a one-off backfill. The nightly run
  // keeps the default window: re-reading years of calendar every night would
  // be slow and would change nothing, since old lessons do not move.
  const days = Number(params.get("days"));
  const fromIso =
    Number.isFinite(days) && days > 0
      ? new Date(
          Date.now() - Math.min(days, 2000) * 24 * 3600 * 1000,
        ).toISOString()
      : undefined;

  const report = await syncLessons({ dryRun, fromIso });

  if (!report.ok) {
    return NextResponse.json(report, { status: 500 });
  }

  // Worth a line in the hub log when it actually changes the book - a sync
  // that quietly rewrote history with nobody watching is the thing to avoid.
  if (
    !dryRun &&
    (report.inserted || report.adopted || report.queued || report.resolved)
  ) {
    await logActivity({
      actor: null,
      app: "lessons",
      action: "calendar sync",
      detail: {
        inserted: report.inserted,
        adopted: report.adopted,
        updated: report.updated,
        queued: report.queued,
        resolved: report.resolved,
        singles: report.singles,
      },
    });
  }

  return NextResponse.json(report);
}
