import type { EventInput } from "./actions";
import type { SeatInfo } from "@/components/events/RegistrationForm";
import { TYPE_LABEL } from "./format";
import type {
  CustomField,
  EventRec,
  EventStatus,
  EventType,
  RosterStyle,
  ScheduleMode,
  Slot,
} from "./types";

// Pure helpers behind components/events/EventEditor.tsx: what each event type
// shows, the save payload built from the form, and the live preview's event.

// ---- Type tiles ------------------------------------------------------------

export const TYPE_TILES: { type: EventType; label: string; blurb: string }[] = [
  {
    type: "tournament",
    label: TYPE_LABEL.tournament,
    blurb: "Two-player team entry with GHIN",
  },
  {
    type: "dinner",
    label: TYPE_LABEL.dinner,
    blurb: "Seated or social, guests welcome",
  },
  { type: "clinic", label: TYPE_LABEL.clinic, blurb: "Dates or time slots" },
  { type: "general", label: TYPE_LABEL.general, blurb: "Anything else" },
];

// What the editor shows for a type. A tournament is one date, a Member + Guest
// team and capacity in teams; the server forces the rest (lib/events/actions).
export interface TypeRules {
  tournament: boolean;
  scheduleSwitch: boolean; // "One date / time" vs "Multiple dates / time slots"
  slots: boolean;
  rosterCap: boolean;
  guests: boolean; // the Guests settings, including "collect guest names"
  capacityToggle: string;
  capacityLabel: string;
  capacityHint: string;
}

export function typeRules(type: EventType): TypeRules {
  const tournament = type === "tournament";
  return {
    tournament,
    scheduleSwitch: !tournament,
    slots: !tournament,
    rosterCap: !tournament,
    guests: !tournament,
    capacityToggle: tournament
      ? "Limit the number of teams"
      : "Limit the number of spots",
    capacityLabel: tournament ? "Max teams" : "Total spots",
    capacityHint: tournament
      ? "Entries close when the field is full. Leave off for an open field."
      : "Registration closes when full. Leave off for unlimited.",
  };
}

// A tournament is always a single date, whatever the hidden switch says.
export function effectiveScheduleMode(
  type: EventType,
  mode: ScheduleMode,
): ScheduleMode {
  return type === "tournament" ? "single" : mode;
}

// ---- Steps -----------------------------------------------------------------

export const EDITOR_SECTIONS = [
  { id: "details", label: "Details" },
  { id: "schedule", label: "Schedule" },
  { id: "questions", label: "Players & Questions" },
  { id: "pricing", label: "Pricing" },
  { id: "roster", label: "Roster" },
  { id: "access", label: "Access" },
  { id: "publish", label: "Publish" },
] as const;

export type EditorSectionId = (typeof EDITOR_SECTIONS)[number]["id"];

// ---- Save payload ------------------------------------------------------------

// The editor's form state, as typed (numbers are still strings, dates are
// datetime-local values).
export interface EditorState {
  title: string;
  slug: string;
  type: EventType;
  description: string;
  info: string;
  location: string;
  scheduleMode: ScheduleMode;
  startsAt: string;
  endsAt: string;
  allowMultiSlot: boolean;
  slotsPrompt: string;
  slots: Slot[];
  hasCapacity: boolean;
  capacity: string;
  waitlistEnabled: boolean;
  hasRosterLimit: boolean;
  rosterLimit: string;
  allowGuests: boolean;
  maxGuests: string;
  collectGuestNames: boolean;
  inviteOnly: boolean;
  allowlistText: string;
  inviteOnlyMessage: string;
  pricingEnabled: boolean;
  pricing: string;
  fields: CustomField[];
  showRoster: boolean;
  rosterStyle: RosterStyle;
  managersText: string;
  status: EventStatus;
}

export function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

// The first problem that stops a save, or null.
export function editorError(s: EditorState): string | null {
  if (!s.title.trim()) return "Please give the event a title.";
  if (
    effectiveScheduleMode(s.type, s.scheduleMode) === "slots" &&
    s.slots.length === 0
  )
    return "Add at least one date/time slot, or switch to a single date.";
  return null;
}

export function buildEventInput(s: EditorState, id?: string): EventInput {
  const scheduleMode = effectiveScheduleMode(s.type, s.scheduleMode);
  return {
    id,
    slug: s.slug.trim(),
    title: s.title,
    type: s.type,
    description: s.description,
    info: s.info,
    location: s.location,
    startsAt: scheduleMode === "single" ? fromLocalInput(s.startsAt) : null,
    endsAt: scheduleMode === "single" ? fromLocalInput(s.endsAt) : null,
    scheduleMode,
    allowMultiSlot: scheduleMode === "slots" ? s.allowMultiSlot : false,
    slotsPrompt: s.slotsPrompt,
    slots: s.slots,
    capacity:
      scheduleMode === "single" && s.hasCapacity
        ? Math.max(1, parseInt(s.capacity, 10) || 1)
        : null,
    rosterLimit: s.hasRosterLimit
      ? Math.max(1, parseInt(s.rosterLimit, 10) || 1)
      : null,
    waitlistEnabled: s.waitlistEnabled,
    allowGuests: s.allowGuests,
    maxGuests: s.allowGuests ? Math.max(1, parseInt(s.maxGuests, 10) || 1) : null,
    collectGuestNames: s.allowGuests && s.collectGuestNames,
    inviteOnly: s.inviteOnly,
    allowlist: s.inviteOnly ? s.allowlistText.split(/[\n,;]+/) : [],
    inviteOnlyMessage: s.inviteOnly ? s.inviteOnlyMessage : "",
    customFields: s.fields,
    pricingEnabled: s.pricingEnabled,
    pricing: s.pricing,
    showRoster: s.showRoster,
    rosterStyle: s.rosterStyle,
    managers: s.managersText.split(/[\n,;]+/),
    status: s.status,
  };
}

// ---- Live preview ------------------------------------------------------------

// The event the sign-up form would see if the editor saved now: what the server
// keeps (tournament settings forced, slots only in slots mode) with
// placeholders for what only a save creates.
export function previewEvent(input: EventInput): EventRec {
  const tournament = input.type === "tournament";
  const slotsMode = input.scheduleMode === "slots";
  const customFields: CustomField[] = input.customFields.map((f) => ({
    ...f,
    label: f.label.trim() || "Untitled question",
    scope: tournament ? f.scope : "player",
  }));
  return {
    id: "preview",
    slug: input.slug || "preview",
    title: input.title.trim() || "Untitled event",
    type: input.type,
    description: input.description,
    info: input.info,
    location: input.location,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    scheduleMode: input.scheduleMode,
    allowMultiSlot: slotsMode ? input.allowMultiSlot : false,
    slotsPrompt: slotsMode ? input.slotsPrompt.trim() : "",
    slots: slotsMode ? input.slots : [],
    capacity: input.capacity,
    rosterLimit: tournament ? null : input.rosterLimit,
    waitlistEnabled: input.waitlistEnabled,
    allowGuests: tournament ? true : input.allowGuests,
    maxGuests: tournament ? 1 : input.maxGuests,
    collectGuestNames: tournament ? true : input.collectGuestNames,
    inviteOnly: input.inviteOnly,
    allowlist: [],
    inviteOnlyMessage: input.inviteOnlyMessage,
    customFields,
    photos: [],
    galleryMode: "slideshow",
    pricingEnabled: input.pricingEnabled,
    pricing: input.pricing,
    showRoster: input.showRoster,
    rosterStyle: input.rosterStyle,
    managers: [],
    createdBy: null,
    status: input.status,
    createdAt: "",
  };
}

// Nothing is booked in a preview: every seat and slot is open, so what's left
// is the whole capacity (null = unlimited). The form prints "<n> left" for a
// slot with a capacity, so remaining must not be null there.
export function previewSeats(event: EventRec): SeatInfo {
  return {
    remaining: event.capacity,
    full: false,
    slots: event.slots.map((s) => ({
      id: s.id,
      remaining: s.capacity,
      full: false,
    })),
  };
}
