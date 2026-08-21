import { createAdminClient } from "@/lib/supabase/admin";
import { rowToFinance, rowToPrize } from "./map";
import { newId } from "./ids";
import type { EventFinance, PrizePurchase } from "./finance-types";

// Read side for the financials page. Everything here runs server-side through
// the service_role client; the financials page gates on global admin before
// calling any of it.

// Defaults for a clinic that has never had its financials opened. Seeded from
// how the Ladies Intro to Golf clinic actually runs — $320 a head, Ian takes one
// person's fee for organising, four pros share the pot. All of it is editable on
// the page, so a different clinic just edits it.
export const DEFAULT_FEE_CENTS = 32_000;
const DEFAULT_ORGANIZER = "Ian";
const DEFAULT_INSTRUCTOR_NAMES = ["Ian", "Justin", "Chris", "Tyler"];

function defaultFinance(eventId: string): EventFinance {
  return {
    eventId,
    feeCents: DEFAULT_FEE_CENTS,
    organizerName: DEFAULT_ORGANIZER,
    organizerCutCents: DEFAULT_FEE_CENTS,
    instructors: DEFAULT_INSTRUCTOR_NAMES.map((name) => ({
      id: newId(),
      name,
    })),
    presence: {},
  };
}

// The finance row for an event, creating it on first look so the page always
// has something to edit. Concurrent first-loads are handled by the primary key:
// the insert conflicts, and we re-read whichever row won.
export async function getFinance(eventId: string): Promise<EventFinance> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("event_finance")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (data) return rowToFinance(data);

  const seeded = defaultFinance(eventId);
  const { data: inserted, error: insErr } = await supa
    .from("event_finance")
    .insert({
      event_id: seeded.eventId,
      fee_cents: seeded.feeCents,
      organizer_name: seeded.organizerName,
      organizer_cut_cents: seeded.organizerCutCents,
      instructors: seeded.instructors,
      presence: seeded.presence,
    })
    .select("*")
    .maybeSingle();

  if (insErr) {
    // Lost the race (or the event vanished) — re-read rather than fail the page.
    const { data: existing } = await supa
      .from("event_finance")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing) return rowToFinance(existing);
    throw insErr;
  }
  return inserted ? rowToFinance(inserted) : seeded;
}

export async function listPrizes(eventId: string): Promise<PrizePurchase[]> {
  const supa = createAdminClient("events");
  const { data, error } = await supa
    .from("prize_purchases")
    .select("*")
    .eq("event_id", eventId)
    .order("purchased_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToPrize);
}
