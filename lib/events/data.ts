import { createAdminClient } from "@/lib/supabase/admin";
import { rowToEvent, rowToReg } from "./map";
import type { EventRec, Registration } from "./types";

// Read-side queries (server components call these). All run server-side through
// the service_role admin client — the browser never touches these tables.

export async function listEvents(): Promise<EventRec[]> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToEvent);
}

export async function getEvent(id: string): Promise<EventRec | null> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEvent(data) : null;
}

export async function getEventBySlug(slug: string): Promise<EventRec | null> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEvent(data) : null;
}

export async function registrationsFor(
  eventId: string,
): Promise<Registration[]> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToReg);
}

export * from "./seats";
