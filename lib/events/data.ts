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

// ---- Seat math (shared by public page and admin) --------------------------

// Seats already taken (confirmed only), optionally for a single slot.
export function takenSeats(
  regs: Registration[],
  slotId: string | null = null,
): number {
  return regs
    .filter((r) => r.status === "confirmed")
    .filter((r) => (slotId == null ? true : r.slotIds.includes(slotId)))
    .reduce((n, r) => n + Math.max(1, r.partySize), 0);
}

export interface Availability {
  capacity: number | null; // null = unlimited
  taken: number;
  remaining: number | null; // null = unlimited
  full: boolean;
}

export function availability(
  event: EventRec,
  regs: Registration[],
  slotId: string | null = null,
): Availability {
  const cap = slotId
    ? (event.slots.find((s) => s.id === slotId)?.capacity ?? null)
    : event.capacity;
  const taken = takenSeats(regs, slotId);
  if (cap == null) {
    return { capacity: null, taken, remaining: null, full: false };
  }
  const remaining = Math.max(0, cap - taken);
  return { capacity: cap, taken, remaining, full: remaining <= 0 };
}
