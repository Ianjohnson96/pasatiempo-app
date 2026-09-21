// Domain model for the Caddie section.
//
// Mirrors the caddie.* schema in the hub (supabase/schema-caddie.sql). The
// database uses text + check constraints rather than enums, so these unions are
// the only place the allowed values are written down for TypeScript — keep them
// in step with the check constraints.

export type CaddieStatus = "Active" | "Inactive" | "Suspended";
export type ContactMethod = "SMS" | "Email" | "Both";
export type TimeSlot = "AM" | "PM" | "All Day";
export type AvailabilityStatus = "Available" | "Unavailable" | "Pending";
export type LoopType =
  | "Single Bag"
  | "Double Bag"
  | "Forecaddie 1-2"
  | "Forecaddie 3-4";
export type OfferKind = "direct" | "broadcast";
export type ResponseChannel = "sms" | "email" | "web" | "admin";

export type LoopStatus =
  | "Unassigned"
  | "Partially Assigned"
  | "Assigned"
  | "Completed"
  | "Cancelled";

export type ConfirmationStatus =
  | "Pending"
  | "Accepted"
  | "Declined"
  | "Expired"
  | "Withdrawn";

/** What a caddie normally does on a given weekday. "Off" is a standing no. */
export type DefaultSlot = TimeSlot | "Off";

/** A stretch of days a caddie is gone. Both ends inclusive. */
export interface AwayPeriod {
  id: string;
  caddieId: string;
  startsOn: string; // "yyyy-mm-dd"
  endsOn: string;   // "yyyy-mm-dd", inclusive
  reason: string;
}

export function rowToAway(r: Record<string, unknown>): AwayPeriod {
  return {
    id: String(r.id),
    caddieId: String(r.caddie_id),
    startsOn: String(r.starts_on),
    endsOn: String(r.ends_on),
    reason: String(r.reason ?? ""),
  };
}

/**
 * Where a day's answer came from. The shop needs the difference between "he
 * said no", "he is in Mexico" and "he never told us" — they are three
 * different phone calls.
 */
export type AvailabilitySource = "away" | "day" | "usual" | "none";

export interface ResolvedDay {
  /** What they can work, or null when unavailable or unknown. */
  slot: TimeSlot | null;
  status: AvailabilityStatus | "Unknown";
  source: AvailabilitySource;
  /** Set when source is "away". */
  reason?: string;
}

/** A seniority tier, defined by the Pro Shop. Lower sortOrder goes out first. */
export interface TierRec {
  id: string;
  name: string;
  sortOrder: number;
  description: string;
}

export const LOOP_TYPES: LoopType[] = [
  "Single Bag",
  "Double Bag",
  "Forecaddie 1-2",
  "Forecaddie 3-4",
];

export const CADDIE_STATUSES: CaddieStatus[] = [
  "Active",
  "Inactive",
  "Suspended",
];

export const CONTACT_METHODS: ContactMethod[] = ["SMS", "Email", "Both"];

// Pasatiempo plays 18. The loops table still carries a holes column and still
// allows 9/18/27/36, but nothing in the UI asks — so there is no hole dimension
// on the rate card either.
export const DEFAULT_HOLES = 18;

export interface CaddieRec {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  tierId: string | null;
  /** Denormalised for display; null when no tier is set. */
  tierName: string | null;
  tierOrder: number;
  status: CaddieStatus;
  preferredContactMethod: ContactMethod;
  smsOptIn: boolean;
  lastWorkedOn: string | null; // "yyyy-mm-dd"
  notes: string;
}

export interface LoopRec {
  id: string;
  teeTime: string; // ISO datetime (UTC from Postgres)
  playerName: string;
  loopType: LoopType;
  caddiesRequired: number;
  holes: number;
  notes: string;
  bookingId: string | null;
  status: LoopStatus;
  openBoard: boolean;
  createdBy: string | null;
}

export interface AssignmentRec {
  id: string;
  loopId: string;
  caddieId: string;
  offeredAt: string;
  offeredBy: string | null;
  offerKind: OfferKind;
  offerExpiresAt: string | null;
  confirmationStatus: ConfirmationStatus;
  respondedAt: string | null;
  responseChannel: ResponseChannel | null;
}

// An assignment with its caddie attached, as the board renders it.
export interface CrewMember extends AssignmentRec {
  caddie: CaddieRec;
}

// A loop plus everyone offered it. `crew` includes declined and expired offers
// so the Pro Shop can see who has already been asked.
export interface LoopWithCrew {
  loop: LoopRec;
  crew: CrewMember[];
}

// The rate card: one figure per loop type, in CENTS. Money never moves through
// this app — the player pays the caddie directly. These figures exist so both
// sides see the same number before the loop goes out.
export type RateCard = Record<string, number>;

export interface CaddieSettings {
  courseTimezone: string;
  offerExpiryMinutes: number;
  broadcastExpiryMinutes: number;
  reminderHoursBefore: number;
  overlapGuardHours: number;
  sessionDays: number;
  /** How long a handed-over sign-in link stays good. */
  inviteDays: number;
  /** How far ahead the caddie availability planner runs. */
  availabilityMonths: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  rates: RateCard;
}

// Rate for a loop, in cents. Returns null when the Pro Shop has not set one —
// the UI must show "not set" rather than an invented number.
export function rateFor(rates: RateCard, loopType: LoopType): number | null {
  const cents = rates?.[loopType];
  return typeof cents === "number" && cents > 0 ? cents : null;
}

// ---------------------------------------------------------------------------
// Row mappers. Mapping is a straight snake_case -> camelCase rename here, so it
// lives with the types rather than in its own map.ts the way events needs.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

export function rowToCaddie(r: Row): CaddieRec {
  return {
    id: String(r.id),
    fullName: String(r.full_name ?? ""),
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    tierId: (r.tier_id as string | null) ?? null,
    tierName: (r.tier_name as string | null) ?? null,
    // Untiered caddies sort last rather than first.
    tierOrder: typeof r.tier_order === "number" ? r.tier_order : 9999,
    status: (r.status as CaddieStatus) ?? "Active",
    preferredContactMethod:
      (r.preferred_contact_method as ContactMethod) ?? "Both",
    smsOptIn: Boolean(r.sms_opt_in),
    lastWorkedOn: (r.last_worked_on as string | null) ?? null,
    notes: String(r.notes ?? ""),
  };
}

export function rowToLoop(r: Row): LoopRec {
  return {
    id: String(r.id),
    teeTime: String(r.tee_time),
    playerName: String(r.player_name ?? ""),
    loopType: (r.loop_type as LoopType) ?? "Single Bag",
    caddiesRequired: Number(r.caddies_required ?? 1),
    holes: Number(r.holes ?? 18),
    notes: String(r.notes ?? ""),
    bookingId: (r.booking_id as string | null) ?? null,
    status: (r.status as LoopStatus) ?? "Unassigned",
    openBoard: Boolean(r.open_board),
    createdBy: (r.created_by as string | null) ?? null,
  };
}

export function rowToAssignment(r: Row): AssignmentRec {
  return {
    id: String(r.id),
    loopId: String(r.loop_id),
    caddieId: String(r.caddie_id),
    offeredAt: String(r.offered_at),
    offeredBy: (r.offered_by as string | null) ?? null,
    offerKind: (r.offer_kind as OfferKind) ?? "direct",
    offerExpiresAt: (r.offer_expires_at as string | null) ?? null,
    confirmationStatus:
      (r.confirmation_status as ConfirmationStatus) ?? "Pending",
    respondedAt: (r.responded_at as string | null) ?? null,
    responseChannel: (r.response_channel as ResponseChannel | null) ?? null,
  };
}

export function acceptedCount(crew: CrewMember[]): number {
  return crew.filter((c) => c.confirmationStatus === "Accepted").length;
}

export function pendingCount(crew: CrewMember[]): number {
  return crew.filter((c) => c.confirmationStatus === "Pending").length;
}

// Who is still on the hook for this loop — accepted, or asked and not yet
// answered. Declined/Expired/Withdrawn stay visible but do not count.
export function liveCrew(crew: CrewMember[]): CrewMember[] {
  return crew.filter(
    (c) =>
      c.confirmationStatus === "Accepted" || c.confirmationStatus === "Pending",
  );
}

export function rowToTier(r: Record<string, unknown>): TierRec {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    sortOrder: Number(r.sort_order ?? 0),
    description: String(r.description ?? ""),
  };
}

/** A party of players whose tee times go out together. */
export interface BookingRec {
  id: string;
  name: string;
  notes: string;
}

export function rowToBooking(r: Record<string, unknown>): BookingRec {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    notes: String(r.notes ?? ""),
  };
}
