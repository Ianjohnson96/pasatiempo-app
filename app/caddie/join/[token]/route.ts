import { NextResponse, type NextRequest } from "next/server";
import { getSettings } from "@/lib/caddie/data";
import { claimInvite } from "@/lib/caddie/session";

// What the QR code on the Pro Shop counter points at.
//
// A route handler rather than a page on purpose: claiming sets a cookie, and
// Next.js only permits that from a Route Handler or a Server Action — a Server
// Component rendering this throws. Either way the caddie ends up at /caddie,
// signed in or holding an explanation.
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const settings = await getSettings();

  const result = await claimInvite(
    token,
    settings.sessionDays,
    request.headers.get("user-agent"),
  );

  const url = new URL("/caddie", request.url);
  if (!result.ok) url.searchParams.set("reason", result.reason);
  return NextResponse.redirect(url);
}
