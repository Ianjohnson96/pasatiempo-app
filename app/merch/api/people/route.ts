import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMerchViewer, listMembers } from "@/lib/merch/auth";
import type { MerchRole } from "@/lib/merch/rules";

export const dynamic = "force-dynamic";

const ROLES: MerchRole[] = ["owner", "staff", "viewer"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function owner() {
  const v = await getMerchViewer();
  return v && v.role === "owner" ? v : null;
}

export async function GET() {
  if (!(await owner())) return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  return NextResponse.json({ members: await listMembers() }, { headers: { "Cache-Control": "no-store" } });
}

// Finds the Supabase Auth user for an email (the org is small; one page is enough).
async function authUser(email: string): Promise<User | null> {
  const admin = createAdminClient("merch").auth.admin;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

// POST {email, name, role, active, password?}
//   Adds or updates a member. A password creates their sign-in if they don't
//   have one yet, or replaces one this program created (for "forgot my password").
export async function POST(request: NextRequest) {
  const me = await owner();
  if (!me) return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  let b: { email?: unknown; name?: unknown; role?: unknown; active?: unknown; password?: unknown };
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  const role = ROLES.find((r) => r === b.role);
  const active = b.active !== false;
  const password = typeof b.password === "string" ? b.password : "";
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!role) return NextResponse.json({ error: "Pick a role." }, { status: 400 });
  if (password && password.length < 8) return NextResponse.json({ error: "Passwords need at least 8 characters." }, { status: 400 });
  if (email === me.email && (role !== "owner" || !active))
    return NextResponse.json({ error: "You can't remove your own owner access." }, { status: 400 });

  const supa = createAdminClient("merch");
  if (password) {
    const user = await authUser(email);
    // Only sign-ins this program created can be reset here. Anyone else (an
    // events admin, say) keeps their password unless they change it themselves.
    if (user && !user.app_metadata?.merch_only)
      return NextResponse.json({ error: "This person already signs in to another Pasatiempo app. They keep their existing password." }, { status: 400 });
    const res = user
      ? await supa.auth.admin.updateUserById(user.id, { password })
      : await supa.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { merch_only: true } });
    if (res.error) return NextResponse.json({ error: "The sign-in couldn't be saved: " + res.error.message }, { status: 400 });
  }
  const { error } = await supa
    .from("members")
    .upsert({ email, name, role, active, created_by: me.email }, { onConflict: "email" });
  if (error) return NextResponse.json({ error: "That didn't save. Try again." }, { status: 503 });
  return NextResponse.json({ members: await listMembers() });
}
