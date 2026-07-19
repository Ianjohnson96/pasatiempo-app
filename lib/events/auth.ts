import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventRec } from "./types";

export interface Viewer {
  email: string;
  isGlobalAdmin: boolean;
}

// The signed-in admin, or null. A "global admin" (in app_admins) can manage
// every event; anyone else can manage only events they created or co-manage.
export async function getViewer(): Promise<Viewer | null> {
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

  const admin = createAdminClient("events");
  const { data } = await admin
    .from("app_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  return { email, isGlobalAdmin: !!data };
}

export function canManageEvent(viewer: Viewer, event: EventRec): boolean {
  return (
    viewer.isGlobalAdmin ||
    event.createdBy === viewer.email ||
    event.managers.includes(viewer.email)
  );
}
