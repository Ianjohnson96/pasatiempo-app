import { createAdminClient } from "@/lib/supabase/admin";
import {
  rowToAssignment,
  rowToCaddie,
  rowToLoop,
  rowToTier,
  type AssignmentRec,
  type AvailabilityStatus,
  type CaddieRec,
  type CaddieSettings,
  type CrewMember,
  type LoopRec,
  type LoopStatus,
  type LoopType,
  type LoopWithCrew,
  type TierRec,
  type RateCard,
  type TimeSlot,
} from "./types";

// Read-side queries. Server components call these; everything runs through the
// schema-pinned service_role client, so the browser never touches these tables.

const DEFAULT_TZ = "America/Los_Angeles";

// ---------------------------------------------------------------------------
// Time helpers.
//
// Tee times are timestamptz. The Pro Shop thinks in course-local time, so every
// day boundary and every displayed hour has to be converted through the course
// timezone — not the server's, which on Vercel is UTC. Getting this wrong shifts
// the whole sheet by seven hours, which is the classic version of this bug.
// ---------------------------------------------------------------------------

// Milliseconds to add to a wall-clock-read-as-UTC value to get the real instant.
function offsetMs(at: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return at.getTime() - asUTC;
}

/** The UTC instant of local midnight on `day` ("yyyy-mm-dd") in `tz`. */
export function zonedMidnight(day: string, tz: string = DEFAULT_TZ): Date {
  const naive = new Date(`${day}T00:00:00Z`);
  // Two passes: the first offset is read at UTC midnight, which can fall on the
  // wrong side of a DST change; re-reading at the corrected instant settles it.
  const once = new Date(naive.getTime() + offsetMs(naive, tz));
  return new Date(naive.getTime() + offsetMs(once, tz));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Half-open [from, to) covering one course-local day, as ISO strings. */
export function dayRange(day: string, tz: string = DEFAULT_TZ) {
  return {
    from: zonedMidnight(day, tz).toISOString(),
    to: zonedMidnight(addDays(day, 1), tz).toISOString(),
  };
}

/** Today's date in the course timezone, as "yyyy-mm-dd". */
export function courseToday(tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The course-local hour (0-23) of an ISO instant. */
export function localHour(iso: string, tz: string = DEFAULT_TZ): number {
  return (
    Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour12: false,
        hour: "2-digit",
      }).format(new Date(iso)),
    ) % 24
  );
}

/** "7:42 AM" in course-local time. */
export function formatTee(iso: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "Saturday, September 20" in course-local time. */
export function formatDay(day: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(zonedMidnight(day, tz));
}

/** Which availability slot a tee time falls in. */
export function slotForTee(iso: string, tz: string = DEFAULT_TZ): TimeSlot {
  return localHour(iso, tz) < 12 ? "AM" : "PM";
}

export function formatRate(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<CaddieSettings> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("settings")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;

  const d = (data?.data ?? {}) as Record<string, unknown>;
  return {
    courseTimezone: String(d.course_timezone ?? DEFAULT_TZ),
    offerExpiryMinutes: Number(d.offer_expiry_minutes ?? 30),
    broadcastExpiryMinutes: Number(d.broadcast_expiry_minutes ?? 20),
    reminderHoursBefore: Number(d.reminder_hours_before ?? 12),
    overlapGuardHours: Number(d.overlap_guard_hours ?? 4),
    sessionDays: Number(d.session_days ?? 90),
    inviteDays: Number(d.invite_days ?? 7),
    emailEnabled: Boolean(d.email_enabled ?? true),
    smsEnabled: Boolean(d.sms_enabled ?? false),
    rates: (d.rates ?? {}) as RateCard,
  };
}

// ---------------------------------------------------------------------------
// Caddies
// ---------------------------------------------------------------------------

export async function listCaddies(): Promise<CaddieRec[]> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("caddies")
    .select("*, tiers(name, sort_order)")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(flattenCaddie);
}

/**
 * Fold the joined tier onto the caddie row.
 *
 * PostgREST nests an embedded table under its own key; the mapper wants flat
 * snake_case, and every caller wants the tier name without a second lookup.
 */
function flattenCaddie(row: Record<string, unknown>): CaddieRec {
  const tier = row.tiers as { name?: string; sort_order?: number } | null;
  return rowToCaddie({
    ...row,
    tier_name: tier?.name ?? null,
    tier_order: typeof tier?.sort_order === "number" ? tier.sort_order : 9999,
  });
}

/** Every tier, in dispatch order. */
export async function listTiers(): Promise<TierRec[]> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("tiers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToTier);
}

/** How many caddies sit in each tier, for the tiers page. */
export async function caddieCountByTier(): Promise<Map<string, number>> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("caddies")
    .select("tier_id")
    .eq("status", "Active");
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.tier_id ? String(row.tier_id) : "none";
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** What one caddie said about one day. */
export interface DayAvailability {
  slot: TimeSlot;
  status: AvailabilityStatus;
}

/**
 * Availability submissions for one course-local day, keyed by caddie id.
 *
 * The calendar writes exactly one row per caddie per day, so there is nothing
 * to merge. Older rows from before that rule, or any written by hand, are
 * resolved by letting a definite answer beat a Pending one.
 */
export async function availabilityFor(
  day: string,
): Promise<Map<string, DayAvailability>> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("availability")
    .select("caddie_id, time_slot, status")
    .eq("date", day);
  if (error) throw error;

  const byCaddie = new Map<string, DayAvailability>();
  for (const row of data ?? []) {
    const id = String(row.caddie_id);
    const entry: DayAvailability = {
      slot: row.time_slot as TimeSlot,
      status: row.status as AvailabilityStatus,
    };
    const existing = byCaddie.get(id);
    if (!existing || existing.status === "Pending") byCaddie.set(id, entry);
  }
  return byCaddie;
}

/**
 * Does what the caddie told us cover a loop teeing off in `slot`?
 *
 * "All Day" covers both. Saying you are free in the morning is not an offer to
 * work the afternoon, so an AM submission does not cover a PM tee time — the
 * ranking treats that the same as being unavailable.
 */
export function coversSlot(entry: DayAvailability, slot: TimeSlot): boolean {
  if (entry.status !== "Available") return false;
  return entry.slot === "All Day" || entry.slot === slot;
}

/** One caddie's own submissions across a date range, keyed by "yyyy-mm-dd". */
export async function availabilityForRange(
  caddieId: string,
  from: string,
  to: string,
): Promise<Map<string, DayAvailability>> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("availability")
    .select("date, time_slot, status")
    .eq("caddie_id", caddieId)
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;

  const byDay = new Map<string, DayAvailability>();
  for (const row of data ?? []) {
    byDay.set(String(row.date), {
      slot: row.time_slot as TimeSlot,
      status: row.status as AvailabilityStatus,
    });
  }
  return byDay;
}

// ---------------------------------------------------------------------------
// Loops
// ---------------------------------------------------------------------------

/** Every loop on one course-local day, each with everyone offered it. */
export async function loopsForDay(
  day: string,
  tz: string = DEFAULT_TZ,
): Promise<LoopWithCrew[]> {
  const supa = createAdminClient("caddie");
  const { from, to } = dayRange(day, tz);

  const { data: loopRows, error: loopErr } = await supa
    .from("loops")
    .select("*")
    .gte("tee_time", from)
    .lt("tee_time", to)
    .order("tee_time", { ascending: true });
  if (loopErr) throw loopErr;

  const loops = (loopRows ?? []).map(rowToLoop);
  if (loops.length === 0) return [];

  const { data: asgRows, error: asgErr } = await supa
    .from("assignments")
    .select("*")
    .in(
      "loop_id",
      loops.map((l) => l.id),
    )
    .order("offered_at", { ascending: true });
  if (asgErr) throw asgErr;

  const caddies = await listCaddies();
  const byId = new Map(caddies.map((c) => [c.id, c]));

  const crewByLoop = new Map<string, CrewMember[]>();
  for (const row of asgRows ?? []) {
    const a = rowToAssignment(row);
    const caddie = byId.get(a.caddieId);
    if (!caddie) continue;
    const list = crewByLoop.get(a.loopId) ?? [];
    list.push({ ...a, caddie });
    crewByLoop.set(a.loopId, list);
  }

  return loops.map((loop) => ({ loop, crew: crewByLoop.get(loop.id) ?? [] }));
}

export async function getLoop(id: string): Promise<LoopRec | null> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("loops")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLoop(data) : null;
}

/**
 * Flip offers whose window has closed from Pending to Expired.
 *
 * Called when the dispatch board loads, not only from the nightly cron: a
 * Vercel Hobby plan allows one cron a day, and an offer window is twenty
 * minutes. The database already refuses a late acceptance, so nothing is at
 * risk either way — but a board showing "waiting on an answer" for an offer
 * that died an hour ago is actively misleading about who still needs ringing.
 *
 * Returns how many it closed. Cheap and idempotent: one indexed UPDATE that
 * matches nothing on the common path.
 */
export async function expireStaleOffers(): Promise<number> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa.rpc("expire_stale_offers");
  if (error) throw error;
  return Number(data ?? 0);
}

/**
 * Loops posted to the open job board that this caddie could still take.
 *
 * Excludes anything they have already been offered or turned down, so the
 * board is only things they can act on.
 */
export async function openBoardLoops(caddieId: string): Promise<LoopRec[]> {
  const supa = createAdminClient("caddie");

  const { data: rows, error } = await supa
    .from("loops")
    .select("*")
    .eq("open_board", true)
    .in("status", ["Unassigned", "Partially Assigned"])
    .gte("tee_time", new Date().toISOString())
    .order("tee_time", { ascending: true });
  if (error) throw error;

  const loops = (rows ?? []).map(rowToLoop);
  if (loops.length === 0) return [];

  const { data: mine, error: mineErr } = await supa
    .from("assignments")
    .select("loop_id")
    .eq("caddie_id", caddieId)
    .in(
      "loop_id",
      loops.map((l) => l.id),
    );
  if (mineErr) throw mineErr;

  const seen = new Set((mine ?? []).map((r) => String(r.loop_id)));
  return loops.filter((l) => !seen.has(l.id));
}

/**
 * Every caddie's submissions across a date range, for the Pro Shop's week view.
 * Keyed caddie id -> "yyyy-mm-dd".
 */
export async function availabilityBetween(
  from: string,
  to: string,
): Promise<Map<string, Map<string, DayAvailability>>> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("availability")
    .select("caddie_id, date, time_slot, status")
    .gte("date", from)
    .lte("date", to);
  if (error) throw error;

  const grid = new Map<string, Map<string, DayAvailability>>();
  for (const row of data ?? []) {
    const id = String(row.caddie_id);
    const byDay = grid.get(id) ?? new Map<string, DayAvailability>();
    byDay.set(String(row.date), {
      slot: row.time_slot as TimeSlot,
      status: row.status as AvailabilityStatus,
    });
    grid.set(id, byDay);
  }
  return grid;
}

/** One job as the month calendar draws it. */
export interface LoopSummary {
  id: string;
  teeTime: string;
  teeLabel: string;
  playerName: string;
  loopType: LoopType;
  status: LoopStatus;
  accepted: number;
  required: number;
}

/**
 * Every loop in a range, grouped by course-local day, with how many caddies
 * have actually accepted.
 *
 * The calendar shows the jobs themselves rather than a tally, because "three
 * loops" and "the 7:40, the 8:10 and the 2pm, one of them still short" are
 * different amounts of information when you are deciding where to spend the
 * afternoon ringing round.
 */
export async function loopsBetweenByDay(
  from: string,
  to: string,
  tz: string = DEFAULT_TZ,
): Promise<Map<string, LoopSummary[]>> {
  const supa = createAdminClient("caddie");

  const { data: loopRows, error } = await supa
    .from("loops")
    .select("*")
    .gte("tee_time", zonedMidnight(from, tz).toISOString())
    .lt("tee_time", zonedMidnight(addDays(to, 1), tz).toISOString())
    .order("tee_time", { ascending: true });
  if (error) throw error;

  const loops = (loopRows ?? []).map(rowToLoop);
  if (loops.length === 0) return new Map();

  const { data: asgRows, error: asgErr } = await supa
    .from("assignments")
    .select("loop_id, confirmation_status")
    .in(
      "loop_id",
      loops.map((l) => l.id),
    );
  if (asgErr) throw asgErr;

  const acceptedByLoop = new Map<string, number>();
  for (const row of asgRows ?? []) {
    if (String(row.confirmation_status) !== "Accepted") continue;
    const id = String(row.loop_id);
    acceptedByLoop.set(id, (acceptedByLoop.get(id) ?? 0) + 1);
  }

  const asCourseDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const out = new Map<string, LoopSummary[]>();
  for (const loop of loops) {
    const date = asCourseDate.format(new Date(loop.teeTime));
    const list = out.get(date) ?? [];
    list.push({
      id: loop.id,
      teeTime: loop.teeTime,
      teeLabel: formatTee(loop.teeTime, tz),
      playerName: loop.playerName,
      loopType: loop.loopType,
      status: loop.status,
      accepted: acceptedByLoop.get(loop.id) ?? 0,
      required: loop.caddiesRequired,
    });
    out.set(date, list);
  }
  return out;
}

/** Booking id -> party name, for showing which loops belong together. */
export async function bookingNames(
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("bookings")
    .select("id, name")
    .in("id", unique);
  if (error) throw error;

  return new Map((data ?? []).map((r) => [String(r.id), String(r.name)]));
}

/** An offer or booking the caddie still has a stake in. */
export interface OpenWork {
  assignment: AssignmentRec;
  loop: LoopRec;
}

/**
 * Everything one caddie is currently on the hook for: offers awaiting an answer
 * and loops they have accepted.
 *
 * A loop stays on the list until six hours past its tee time, so a caddie can
 * still check what they are on during the round.
 */
export async function openWorkFor(caddieId: string): Promise<OpenWork[]> {
  const supa = createAdminClient("caddie");

  const { data: rows, error } = await supa
    .from("assignments")
    .select("*")
    .eq("caddie_id", caddieId)
    .in("confirmation_status", ["Pending", "Accepted"])
    .order("offered_at", { ascending: false });
  if (error) throw error;

  const assignments = (rows ?? []).map(rowToAssignment);
  const loopIds = [...new Set(assignments.map((a) => a.loopId))];
  if (loopIds.length === 0) return [];

  const cutoff = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const { data: loopRows, error: loopErr } = await supa
    .from("loops")
    .select("*")
    .in("id", loopIds)
    .neq("status", "Cancelled")
    .gte("tee_time", cutoff)
    .order("tee_time", { ascending: true });
  if (loopErr) throw loopErr;

  const loopsById = new Map(
    (loopRows ?? []).map((r) => [String(r.id), rowToLoop(r)]),
  );

  return assignments
    .filter((a) => loopsById.has(a.loopId))
    .map((a) => ({ assignment: a, loop: loopsById.get(a.loopId)! }))
    .sort((x, y) => x.loop.teeTime.localeCompare(y.loop.teeTime));
}

// ---------------------------------------------------------------------------
// Dispatch ranking
// ---------------------------------------------------------------------------

/**
 * The candidate's standing for THIS loop's half of the day: null when they
 * never answered, "Available" only when what they said covers this tee time.
 * An AM-only caddie reads as unavailable for an afternoon loop.
 */
function verdict(
  entry: DayAvailability | undefined,
  slot: TimeSlot,
): AvailabilityStatus | null {
  if (!entry) return null;
  if (entry.status === "Pending") return "Pending";
  return coversSlot(entry, slot) ? "Available" : "Unavailable";
}

export interface Candidate {
  caddie: CaddieRec;
  /** Their standing for this loop's tee time, or null if they never answered. */
  availability: AvailabilityStatus | null;
  /** Already offered this loop (any outcome). */
  alreadyOffered: boolean;
  /** Holds an accepted loop close enough to collide with this tee time. */
  conflict: boolean;
}

/**
 * Who to offer a loop to, best first.
 *
 * Order: caddies who said they are Available, then by seniority tier, then by
 * who has waited longest for work. Conflicts and caddies already asked sink to
 * the bottom rather than disappearing — the shop should be able to see them and
 * override.
 */
export function rankCandidates(
  loop: LoopRec,
  caddies: CaddieRec[],
  dayLoops: LoopWithCrew[],
  availability: Map<string, DayAvailability>,
  overlapGuardHours: number,
): Candidate[] {
  const teeMs = new Date(loop.teeTime).getTime();
  const guardMs = overlapGuardHours * 3_600_000;
  const loopSlot = slotForTee(loop.teeTime);

  const offeredHere = new Set(
    (dayLoops.find((d) => d.loop.id === loop.id)?.crew ?? []).map(
      (c) => c.caddieId,
    ),
  );

  // Caddies holding an accepted loop inside the guard window.
  const conflicted = new Set<string>();
  for (const { loop: other, crew } of dayLoops) {
    if (other.id === loop.id || other.status === "Cancelled") continue;
    if (Math.abs(new Date(other.teeTime).getTime() - teeMs) > guardMs) continue;
    for (const c of crew) {
      if (c.confirmationStatus === "Accepted") conflicted.add(c.caddieId);
    }
  }

  return caddies
    .filter((c) => c.status === "Active")
    .map<Candidate>((caddie) => ({
      caddie,
      availability: verdict(availability.get(caddie.id), loopSlot),
      alreadyOffered: offeredHere.has(caddie.id),
      conflict: conflicted.has(caddie.id),
    }))
    .sort((a, b) => {
      if (a.alreadyOffered !== b.alreadyOffered) return a.alreadyOffered ? 1 : -1;
      if (a.conflict !== b.conflict) return a.conflict ? 1 : -1;

      const av = (c: Candidate) =>
        c.availability === "Available" ? 0 : c.availability == null ? 1 : 2;
      if (av(a) !== av(b)) return av(a) - av(b);

      const tier = a.caddie.tierOrder - b.caddie.tierOrder;
      if (tier !== 0) return tier;

      // Never worked sorts first, then longest since their last loop.
      return (a.caddie.lastWorkedOn ?? "").localeCompare(
        b.caddie.lastWorkedOn ?? "",
      );
    });
}
