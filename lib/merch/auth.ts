import { createHubClient } from "@/lib/supabase/admin";
import { sectionForHost } from "@/lib/sections";
import { getPerson, roleIn } from "@/lib/hub/access";
import type { MerchRole } from "./rules";

export interface MerchViewer {
  email: string;
  name: string;
  role: MerchRole;
}

// Merchandise Program access comes from hub.access (lib/hub/access.ts):
// owner | staff | viewer. A super admin is an owner.
export async function getMerchViewer(): Promise<MerchViewer | null> {
  const p = await getPerson();
  const role = roleIn(p, "merch");
  return p && role ? { email: p.email, name: p.name, role } : null;
}

/** Display names for the people who have the Merchandise Program (its members and the super admins), for showing
 *  who entered what. Nobody else in the hub is sent to the page. Someone who has since lost access shows by email. */
export async function memberNames(): Promise<Record<string, string>> {
  const hub = createHubClient();
  const [{ data: people }, { data: access }] = await Promise.all([
    hub.from("people").select("email, name, super_admin"),
    hub.from("access").select("email").eq("app", "merch"),
  ]);
  const members = new Set((access ?? []).map((a) => a.email));
  return Object.fromEntries((people ?? []).filter((m) => m.super_admin || members.has(m.email)).map((m) => [m.email, m.name]));
}

/**
 * Where the section lives for this request: "" on its own domain (the proxy
 * maps / onto /merch), "/merch" when served by path on any other host.
 */
export function basePath(host: string | null): string {
  return sectionForHost(host)?.key === "merch" ? "" : "/merch";
}
