import { NextResponse, type NextRequest } from "next/server";
import { basePath, getMerchViewer, listMembers } from "@/lib/merch/auth";
import { programHtml } from "@/lib/merch/page";
import { isSignedIn } from "@/lib/merch/guard";

export const dynamic = "force-dynamic";

// The program itself. Signed-in members only; everyone else goes to sign in.
export async function GET(request: NextRequest) {
  const base = basePath(request.headers.get("host"));
  const viewer = await getMerchViewer();
  if (!viewer) {
    const to = base + "/login" + ((await isSignedIn()) ? "?denied=1" : "");
    return NextResponse.redirect(new URL(to, request.url));
  }
  const members = Object.fromEntries((await listMembers()).map((m) => [m.email, m.name]));
  return new NextResponse(programHtml(viewer, members, base), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    },
  });
}
