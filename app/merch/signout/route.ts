import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { basePath } from "@/lib/merch/auth";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL(basePath(request.headers.get("host")) + "/login", request.url), 303);
}
