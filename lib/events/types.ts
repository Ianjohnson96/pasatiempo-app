// Domain model for the Pasatiempo event registration app.
// Kept storage-agnostic so the file-backed prototype store (lib/db.ts) can later
// be swapped for Supabase without touching the UI or server actions.

export type EventType = "dinner" | "clinic" | "general";
export type EventStatus = "draft" | "open" | "closed";
export type RegStatus = "confirmed" | "waitlist" | "cancelled";
export type ScheduleMode = "single" | "slots";
export type GalleryMode = "slideshow" | "grid";
export type RosterStyle = "first_last" | "first_initial" | "count_only";

export type FieldType =
  | "short_text"
  | "long_text"
  | "select"
  | "checkbox"
  | "number";

export interface CustomField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[]; // used when type === "select"
}

// A sign-up "slot" — a dated and/or timed option people register for.
// Used for clinics (time slots), recurring series, and multi-date events
// (the SignUpGenius / SignUp.com model). Each slot has its own capacity.
export interface Slot {
  id: string;
  date: string | null; // "yyyy-mm-dd" or null for undated
  startTime: string; // "18:00" or ""
  endTime: string; // "20:00" or ""
  label: string; // optional descriptor, e.g. "Beginner group"
  note: string; // short "what we're doing" note (<= 80 chars), shown in the schedule
  capacity: number | null; // null = unlimited
}

export interface EventRec {
  id: string;
  slug: string; // unguessable token used in the public URL /e/<slug>
  title: string;
  type: EventType;
  description: string;
  info: string; // "what you need to know" — shown as its own card on the public page
  location: string;
  startsAt: string | null; // ISO datetime (single-date events)
  endsAt: string | null; // ISO datetime

  // Scheduling
  scheduleMode: ScheduleMode; // "single" = one date; "slots" = pick from dated slots
  allowMultiSlot: boolean; // can a registrant pick more than one slot (recurring series)
  slotsPrompt: string; // instruction shown above the date picker
  slots: Slot[];

  // Capacity (single mode; slots carry their own)
  capacity: number | null; // total seats; null = unlimited
  waitlistEnabled: boolean;

  // Guests
  allowGuests: boolean;
  maxGuests: number | null;
  collectGuestNames: boolean;

  // Access
  inviteOnly: boolean;
  allowlist: string[]; // lower-cased emails
  inviteOnlyMessage: string; // custom message shown when a non-listed email is rejected

  // Custom questions
  customFields: CustomField[];

  // Branding / media
  photos: string[]; // public paths, e.g. /uploads/<id>/x.jpg
  galleryMode: GalleryMode;

  // Pricing (optional, toggleable)
  pricingEnabled: boolean;
  pricing: string; // free-form pricing details shown as its own section

  // Roster
  showRoster: boolean; // show who's signed up on the public page
  rosterStyle: RosterStyle;

  // Team
  managers: string[]; // co-manager emails (auth wiring added at deploy)
  createdBy: string | null; // creator email (global admins manage everything)

  status: EventStatus;
  createdAt: string;
}

export interface Registration {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  partySize: number; // 1 = just the registrant; >1 includes guests
  guestNames: string[];
  slotIds: string[]; // which slot(s) they signed up for ([] for single-date events)
  answers: Record<string, string>; // keyed by CustomField.id
  status: RegStatus;
  createdAt: string;
}

export interface DB {
  events: EventRec[];
  registrations: Registration[];
}
