import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sectionForHost } from "@/lib/sections";
import type { MerchRole } from "./rules";

export interface MerchViewer {
  email: string;
  name: string;
  role: MerchRole;
}

export interface MerchMember extends MerchViewer {
  active: boolean;
  createdAt: string;
}

// The signed-in user if they are an active member of the merchandise program,
// else null. Membership lives in merch.members; sign-in is Supabase Auth.
export async function getMerchViewer(): Promise<MerchViewer | null> {
  let email: string | null = null;
  try {
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    email = user?.email?.toLowerCase() ?? null;
  } catch {
    email = null;
  }
  if (!email) return null;
  const { data } = await createAdminClient("merch")
    .from("members")
    .select("email, name, role, active")
    .eq("email", email)
    .maybeSingle();
  if (!data || !data.active) return null;
  return { email: data.email, name: data.name, role: data.role as MerchRole };
}

/** Everyone in the program, for showing names next to entries. */
export async function listMembers(): Promise<MerchMember[]> {
  const { data } = await createAdminClient("merch")
    .from("members")
    .select("email, name, role, active, created_at")
    .order("name");
  return (data ?? []).map((m) => ({
    email: m.email,
    name: m.name,
    role: m.role as MerchRole,
    active: m.active,
    createdAt: m.created_at,
  }));
}

/**
 * Where the section lives for this request: "" on its own domain (the proxy
 * maps / onto /merch), "/merch" when served by path on any other host.
 */
export function basePath(host: string | null): string {
  return sectionForHost(host)?.key === "merch" ? "" : "/merch";
}
