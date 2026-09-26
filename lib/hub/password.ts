"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createHubClient } from "@/lib/supabase/admin";
import { resolveOrigin } from "@/lib/caddie/origin";
import { signedInEmail } from "./access";
import { logActivity } from "./log";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email a password-reset link. Always answers the same way, so the form can't
 * be used to find out who has an account; the email only goes to people in
 * hub.people who are still active.
 */
export async function requestPasswordReset(rawEmail: string): Promise<{ ok: true }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: true };
  const { data: person } = await createHubClient().from("people").select("active").eq("email", email).maybeSingle();
  if (!person?.active) return { ok: true };
  const h = await headers();
  const origin = resolveOrigin({ configured: process.env.NEXT_PUBLIC_SITE_URL, host: h.get("x-forwarded-host") ?? h.get("host"), proto: h.get("x-forwarded-proto") });
  const supa = await createClient();
  await supa.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm?next=/account/password` });
  await logActivity({ actor: null, app: "hub", action: "password.reset_requested", target: email });
  return { ok: true };
}

/** Record that the signed-in person just changed their own password. */
export async function recordOwnPasswordChange(fromReset: boolean): Promise<void> {
  const email = await signedInEmail();
  if (email) await logActivity({ actor: email, app: "hub", action: fromReset ? "password.reset_done" : "password.changed", target: email });
}
