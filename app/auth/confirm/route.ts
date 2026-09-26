import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/hub/next";

// Landing for the links in Supabase's auth emails (password reset). Handles
// both link styles:
//   ?token_hash=…&type=recovery  — works on any device (email template edited
//                                  as described in supabase/auth-email-setup.md)
//   ?code=…                      — Supabase's default link; works in the same
//                                  browser that asked for the email
// Signs the person in, then sends them on (default: set a new password).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next")) ?? "/account/password";
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const supa = await createClient();

  let ok = false;
  if (tokenHash && type) ok = !(await supa.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  else if (code) ok = !(await supa.auth.exchangeCodeForSession(code)).error;

  const to = new URL(ok ? next : "/login", request.url);
  to.search = "";
  if (ok && next === "/account/password") to.searchParams.set("reset", "1");
  if (!ok) to.searchParams.set("reset", "expired");
  return NextResponse.redirect(to);
}
