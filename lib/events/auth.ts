import { createAdminClient } from "@/lib/supabase/admin";
import { assertApp, getPerson, hasApp, requireApp, roleIn, type Person } from "@/lib/hub/access";
import type { EventRec } from "./types";

export interface Viewer {
  email: string;
  /** Event Planner admin (or super admin): every event, plus financials. */
  isGlobalAdmin: boolean;
}

// Event Planner access comes from hub.access (lib/hub/access.ts): an "admin"
// manages every event; a "manager" only events they created or co-manage.
function toViewer(p: Person): Viewer {
  return { email: p.email, isGlobalAdmin: roleIn(p, "events") === "admin" };
}

/** The signed-in person if they have Event Planner access, or null. */
export async function getViewer(): Promise<Viewer | null> {
  const p = await getPerson();
  return p && hasApp(p, "events") ? toViewer(p) : null;
}

/** For admin pages: redirects anyone without Event Planner access. */
export async function requireEventsViewer(): Promise<Viewer> {
  return toViewer(await requireApp("events"));
}

/** For server actions: throws unless the caller has Event Planner access. */
export async function assertEventsViewer(): Promise<Viewer> {
  return toViewer(await assertApp("events"));
}

export function canManageEvent(viewer: Viewer, event: Pick<EventRec, "createdBy" | "managers">): boolean {
  return (
    viewer.isGlobalAdmin ||
    event.createdBy === viewer.email ||
    event.managers.includes(viewer.email)
  );
}

/** For server actions on one event: throws unless the caller may manage it. */
export async function assertCanManageEvent(eventId: string): Promise<Viewer> {
  const viewer = await assertEventsViewer();
  if (viewer.isGlobalAdmin) return viewer;
  const { data } = await createAdminClient("events").from("events").select("created_by, managers").eq("id", eventId).maybeSingle();
  if (!data || !canManageEvent(viewer, { createdBy: data.created_by ?? null, managers: data.managers ?? [] }))
    throw new Error("You can only change events you created or co-manage.");
  return viewer;
}

/** For server actions on one registration: throws unless the caller may manage its event. */
export async function assertCanManageRegistration(regId: string): Promise<Viewer> {
  const viewer = await assertEventsViewer();
  if (viewer.isGlobalAdmin) return viewer;
  const { data } = await createAdminClient("events").from("registrations").select("event_id").eq("id", regId).maybeSingle();
  if (!data) throw new Error("That registration no longer exists.");
  return assertCanManageEvent(data.event_id);
}
