import { NextResponse, type NextRequest } from "next/server";
import { getMerchViewer } from "@/lib/merch/auth";
import { refreshReceivingLog } from "@/lib/merch/receiving-log-server";

export const dynamic = "force-dynamic";

// POST: read the receiving log again (read-only) into receivinglog/current, unless it was read in the last two
// minutes. Orders & receiving calls this when it opens; the page then gets the copy with its next poll. The owner can
// force a read ({force: true}). View-only members just see the copy.
export async function POST(request: NextRequest) {
  const me = await getMerchViewer();
  if (!me) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  if (me.role === "viewer") return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  let force = false;
  try {
    force = me.role === "owner" && (await request.json())?.force === true;
  } catch {
    force = false;
  }
  try {
    return NextResponse.json(await refreshReceivingLog({ force }));
  } catch (e) {
    console.error("receiving log route", e);
    // The owner sees what went wrong (these messages are the app's own, never credentials); others a plain line.
    const why = me.role === "owner" && e instanceof Error ? ` (${e.message})` : "";
    return NextResponse.json({ ok: false, error: `The receiving log couldn't be read right now${why}.` }, { status: 503 });
  }
}
