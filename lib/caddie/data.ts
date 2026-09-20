import { createAdminClient } from "@/lib/supabase/admin";
import {
  RANK_ORDER,
  rowToAssignment,
  rowToCaddie,
  rowToLoop,
  type AssignmentRec,
  type AvailabilityStatus,
  type CaddieRec,
  type CaddieSettings,
  type CrewMember,
  type LoopRec,
  type LoopWithCrew,
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
    .select("*")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToCaddie);
}

/** Availability submissions for one course-local day, keyed by caddie id. */
export async function availabilityFor(
  day: string,
): Promise<Map<string, AvailabilityStatus>> {
  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("availability")
    .select("caddie_id, time_slot, status")
    .eq("date", day);
  if (error) throw error;

  const byCaddie = new Map<string, AvailabilityStatus>();
  for (const row of data ?? []) {
    const id = String(row.caddie_id);
    const status = row.status as AvailabilityStatus;
    // A definite answer beats a Pending one; otherwise first writer wins.
    const existing = byCaddie.get(id);
    if (!existing || existing === "Pending") byCaddie.set(id, status);
  }
  return byCaddie;
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

export interface Candidate {
  caddie: CaddieRec;
  /** What they told us about this day, or null if they never answered. */
  availability: AvailabilityStatus | null;
  /** Already offered this loop (any outcome). */
  alreadyOffered: boolean;
  /** Holds an accepted loop close enough to collide with this tee time. */
  conflict: boolean;
  /** The member asked for this caddie by name. */
  requested: boolean;
}

/**
 * Who to offer a loop to, best first.
 *
 * Order: the requested caddie, then caddies who said they are Available, then
 * by rank (Honor first), then by who has waited longest for work. Conflicts and
 * caddies already asked sink to the bottom rather than disappearing — the shop
 * should be able to see them and override.
 */
export function rankCandidates(
  loop: LoopRec,
  caddies: CaddieRec[],
  dayLoops: LoopWithCrew[],
  availability: Map<string, AvailabilityStatus>,
  overlapGuardHours: number,
): Candidate[] {
  const teeMs = new Date(loop.teeTime).getTime();
  const guardMs = overlapGuardHours * 3_600_000;

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
      availability: availability.get(caddie.id) ?? null,
      alreadyOffered: offeredHere.has(caddie.id),
      conflict: conflicted.has(caddie.id),
      requested: loop.requestedCaddieId === caddie.id,
    }))
    .sort((a, b) => {
      if (a.requested !== b.requested) return a.requested ? -1 : 1;
      if (a.alreadyOffered !== b.alreadyOffered) return a.alreadyOffered ? 1 : -1;
      if (a.conflict !== b.conflict) return a.conflict ? 1 : -1;

      const av = (c: Candidate) =>
        c.availability === "Available" ? 0 : c.availability == null ? 1 : 2;
      if (av(a) !== av(b)) return av(a) - av(b);

      const rank = RANK_ORDER[a.caddie.rank] - RANK_ORDER[b.caddie.rank];
      if (rank !== 0) return rank;

      // Never worked sorts first, then longest since their last loop.
      return (a.caddie.lastWorkedOn ?? "").localeCompare(
        b.caddie.lastWorkedOn ?? "",
      );
    });
}
