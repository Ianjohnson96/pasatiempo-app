// Domain model for the Caddie section.
//
// Mirrors the caddie.* schema in the hub (supabase/schema-caddie.sql). The
// database uses text + check constraints rather than enums, so these unions are
// the only place the allowed values are written down for TypeScript — keep them
// in step with the check constraints.

export type CaddieRank = "Honor" | "A" | "B";
export type CaddieStatus = "Active" | "Inactive" | "Suspended";
export type ContactMethod = "SMS" | "Email" | "Both";
export type TimeSlot = "AM" | "PM" | "All Day";
export type AvailabilityStatus = "Available" | "Unavailable" | "Pending";
export type LoopType = "Single Caddie" | "Double Bag" | "Forecaddie";
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

// Rank order for dispatch: Honor caddies are offered first.
export const RANK_ORDER: Record<CaddieRank, number> = {
  Honor: 0,
  A: 1,
  B: 2,
};

export const LOOP_TYPES: LoopType[] = [
  "Single Caddie",
  "Double Bag",
  "Forecaddie",
];

export const RANKS: CaddieRank[] = ["Honor", "A", "B"];

export const CADDIE_STATUSES: CaddieStatus[] = [
  "Active",
  "Inactive",
  "Suspended",
];

export const CONTACT_METHODS: ContactMethod[] = ["SMS", "Email", "Both"];

// Every hole count the loops table allows. The rate card covers all of them so
// a 27-hole loop never falls through to a blank rate.
export const HOLE_OPTIONS = [18, 9, 27, 36] as const;

export interface CaddieRec {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  rank: CaddieRank;
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
  requestedRank: CaddieRank | null;
  requestedCaddieId: string | null;
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

// The rate card, in CENTS, keyed by loop type then hole count. Money never
// moves through this app — the player pays the caddie directly. These figures
// exist so both sides see the same number before the loop goes out.
export type RateCard = Record<string, Record<string, number>>;

export interface CaddieSettings {
  courseTimezone: string;
  offerExpiryMinutes: number;
  broadcastExpiryMinutes: number;
  reminderHoursBefore: number;
  overlapGuardHours: number;
  sessionDays: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  rates: RateCard;
}

// Rate for a loop, in cents. Returns null when the Pro Shop has not set one —
// the UI must show "not set" rather than an invented number.
export function rateFor(
  rates: RateCard,
  loopType: LoopType,
  holes: number,
): number | null {
  const cents = rates?.[loopType]?.[String(holes)];
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
    rank: (r.rank as CaddieRank) ?? "B",
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
    loopType: (r.loop_type as LoopType) ?? "Single Caddie",
    caddiesRequired: Number(r.caddies_required ?? 1),
    holes: Number(r.holes ?? 18),
    notes: String(r.notes ?? ""),
    requestedRank: (r.requested_rank as CaddieRank | null) ?? null,
    requestedCaddieId: (r.requested_caddie_id as string | null) ?? null,
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
