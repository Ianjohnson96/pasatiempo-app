import { createHubClient } from "@/lib/supabase/admin";

// The hub activity log (hub.activity): who changed access, passwords, site
// switches and month-end data. Shown to the super admin at /admin/activity.
//
// Logging never blocks the change it records: a failed write is swallowed, so
// an outage of the log can't stop someone fixing an access problem.

export type ActivityApp = "events" | "caddie" | "merch" | "hub" | "sites";

export interface ActivityEntry {
  actor: string | null;
  app: ActivityApp;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown>;
}

export async function logActivity(e: ActivityEntry): Promise<void> {
  try {
    await createHubClient()
      .from("activity")
      .insert({ actor: e.actor, app: e.app, action: e.action, target: e.target ?? null, detail: e.detail ?? {} });
  } catch {
    // see above
  }
}
