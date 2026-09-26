import { createHubClient } from "@/lib/supabase/admin";
import type { SiteKey } from "./apps";

// Public-site switches (hub.sites), read by the proxy on every request to a
// public site. Cached briefly in memory so a page view doesn't wait on the
// database; a switch takes effect within CACHE_MS on each server instance.

const CACHE_MS = 30_000;
let cache: { at: number; off: Set<string> } | null = null;

export async function siteIsOn(key: SiteKey): Promise<boolean> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    try {
      const { data, error } = await createHubClient().from("sites").select("key, enabled");
      if (error) throw error;
      cache = { at: Date.now(), off: new Set((data ?? []).filter((s) => !s.enabled).map((s) => s.key)) };
    } catch {
      // If the switch table can't be read, keep the sites up.
      return cache ? !cache.off.has(key) : true;
    }
  }
  return !cache.off.has(key);
}

/** Forget the cached switches (after the super admin flips one on this instance). */
export function forgetSites() {
  cache = null;
}

export async function isSuperAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const { data } = await createHubClient()
    .from("people")
    .select("super_admin, active")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return !!data?.super_admin && !!data.active;
}
