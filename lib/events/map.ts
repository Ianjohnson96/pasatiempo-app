import type { EventRec, Registration } from "./types";
import type { EventFinance, PrizePurchase } from "./finance-types";

// Maps between snake_case DB rows and the camelCase domain types.
// JSON columns (slots, custom_fields, photos, allowlist, managers, guest_names,
// slot_ids, answers) are stored with their camelCase shape as-is, so only the
// top-level column names need translating.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function rowToEvent(r: any): EventRec {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    type: r.type,
    description: r.description ?? "",
    info: r.info ?? "",
    location: r.location ?? "",
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    scheduleMode: r.schedule_mode,
    allowMultiSlot: r.allow_multi_slot,
    slotsPrompt: r.slots_prompt ?? "",
    slots: r.slots ?? [],
    capacity: r.capacity,
    rosterLimit: r.roster_limit ?? null,
    waitlistEnabled: r.waitlist_enabled,
    allowGuests: r.allow_guests,
    maxGuests: r.max_guests,
    collectGuestNames: r.collect_guest_names,
    inviteOnly: r.invite_only,
    allowlist: r.allowlist ?? [],
    inviteOnlyMessage: r.invite_only_message ?? "",
    customFields: r.custom_fields ?? [],
    photos: r.photos ?? [],
    galleryMode: r.gallery_mode,
    showRoster: r.show_roster,
    rosterStyle: r.roster_style,
    pricingEnabled: r.pricing_enabled ?? false,
    pricing: r.pricing ?? "",
    managers: r.managers ?? [],
    createdBy: r.created_by ?? null,
    status: r.status,
    createdAt: r.created_at,
  };
}

// Domain event -> DB columns (omit id/slug/created_at which are handled explicitly).
export function eventToRow(e: Partial<EventRec>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (e.slug !== undefined) row.slug = e.slug;
  if (e.title !== undefined) row.title = e.title;
  if (e.type !== undefined) row.type = e.type;
  if (e.description !== undefined) row.description = e.description;
  if (e.info !== undefined) row.info = e.info;
  if (e.location !== undefined) row.location = e.location;
  if (e.startsAt !== undefined) row.starts_at = e.startsAt;
  if (e.endsAt !== undefined) row.ends_at = e.endsAt;
  if (e.scheduleMode !== undefined) row.schedule_mode = e.scheduleMode;
  if (e.allowMultiSlot !== undefined) row.allow_multi_slot = e.allowMultiSlot;
  if (e.slotsPrompt !== undefined) row.slots_prompt = e.slotsPrompt;
  if (e.slots !== undefined) row.slots = e.slots;
  if (e.capacity !== undefined) row.capacity = e.capacity;
  if (e.rosterLimit !== undefined) row.roster_limit = e.rosterLimit;
  if (e.waitlistEnabled !== undefined) row.waitlist_enabled = e.waitlistEnabled;
  if (e.allowGuests !== undefined) row.allow_guests = e.allowGuests;
  if (e.maxGuests !== undefined) row.max_guests = e.maxGuests;
  if (e.collectGuestNames !== undefined)
    row.collect_guest_names = e.collectGuestNames;
  if (e.inviteOnly !== undefined) row.invite_only = e.inviteOnly;
  if (e.allowlist !== undefined) row.allowlist = e.allowlist;
  if (e.inviteOnlyMessage !== undefined)
    row.invite_only_message = e.inviteOnlyMessage;
  if (e.customFields !== undefined) row.custom_fields = e.customFields;
  if (e.photos !== undefined) row.photos = e.photos;
  if (e.galleryMode !== undefined) row.gallery_mode = e.galleryMode;
  if (e.showRoster !== undefined) row.show_roster = e.showRoster;
  if (e.rosterStyle !== undefined) row.roster_style = e.rosterStyle;
  if (e.pricingEnabled !== undefined) row.pricing_enabled = e.pricingEnabled;
  if (e.pricing !== undefined) row.pricing = e.pricing;
  if (e.managers !== undefined) row.managers = e.managers;
  if (e.status !== undefined) row.status = e.status;
  return row;
}

export function rowToReg(r: any): Registration {
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? "",
    partySize: r.party_size,
    guestNames: r.guest_names ?? [],
    slotIds: r.slot_ids ?? [],
    answers: r.answers ?? {},
    status: r.status,
    createdAt: r.created_at,
    paid: r.paid ?? false,
    feeCents: r.fee_cents ?? null,
    tender: r.tender ?? null,
    paidOn: r.paid_on ?? null,
    paymentNote: r.payment_note ?? "",
  };
}

// ---- Public-safe event ----------------------------------------------------

// The public event page hands the event object to client components, so it gets
// serialised into the page and is readable by anyone. Strip the fields that are
// nobody else's business: the invite allowlist is a list of members' email
// addresses, and managers/createdBy are staff addresses. Invite-only access is
// enforced server-side in actions.ts, so nothing depends on the client seeing it.
export function publicEvent(e: EventRec): EventRec {
  return { ...e, allowlist: [], managers: [], createdBy: null };
}

// ---- Financials (admin-only) ---------------------------------------------

export function rowToFinance(r: any): EventFinance {
  return {
    eventId: r.event_id,
    feeCents: r.fee_cents ?? 0,
    organizerName: r.organizer_name ?? "",
    organizerCutCents: r.organizer_cut_cents ?? 0,
    instructors: r.instructors ?? [],
    presence: r.presence ?? {},
  };
}

export function financeToRow(f: Partial<EventFinance>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (f.eventId !== undefined) row.event_id = f.eventId;
  if (f.feeCents !== undefined) row.fee_cents = f.feeCents;
  if (f.organizerName !== undefined) row.organizer_name = f.organizerName;
  if (f.organizerCutCents !== undefined)
    row.organizer_cut_cents = f.organizerCutCents;
  if (f.instructors !== undefined) row.instructors = f.instructors;
  if (f.presence !== undefined) row.presence = f.presence;
  return row;
}

export function rowToPrize(r: any): PrizePurchase {
  return {
    id: r.id,
    eventId: r.event_id,
    purchasedOn: r.purchased_on ?? null,
    description: r.description ?? "",
    amountCents: r.amount_cents ?? 0,
    createdAt: r.created_at,
  };
}
