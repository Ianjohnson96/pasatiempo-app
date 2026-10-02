import { createClient as createSbClient } from "@supabase/supabase-js";
import { fetchCalendarEvents, graphConfigured } from "./graph";

// Calendar -> book. Runs from a cron, so there is no signed-in user and RLS
// cannot be the gate; this is the one place the lesson tables are reached with
// service_role, and the route in front of it is bearer-authenticated.
//
// Three rules it will not break:
//   1. It never invents a client. An unrecognised name goes to lesson_review.
//   2. It never touches money. Packages and payment are Ian's alone.
//   3. It is idempotent. Re-running changes nothing the second time.

function syncClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Must say "lesson" to count - this is Ian's work calendar, not a teaching one. */
const LESSON_WORD = /\blessons?\b/i;

// Group teaching, billed per head rather than per booking, so it belongs to no
// single client. Out until there is a model for it.
const NOT_BILLABLE = [
  /\bclinic\b/i,
  /\bcamp\b/i,
  /\bacademy\b/i,
  /\bjunior\s+golf\b/i,
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Strip the scaffolding so "Jon Davies lesson 2 of 5" leaves "jon davies". */
function nameFromTitle(subject: string): string {
  let s = norm(subject);
  s = s.replace(/\blessons?\b/g, " ");
  s = s.replace(
    /\bseries\b|\bsession\b|\bpackage\b|\bpkg\b|\bof\b|\bwith\b|\bfor\b/g,
    " ",
  );
  s = s.replace(/\bpaid\b|\bunpaid\b/g, " ");
  s = s.replace(/\b\d+\b/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

export interface SyncReport {
  ok: boolean;
  dryRun: boolean;
  window: { from: string; to: string };
  scanned: number;
  candidates: number;
  inserted: number;
  updated: number;
  adopted: number;
  queued: number;
  cancelled: number;
  skippedGroup: number;
  unmatchedNames: string[];
  /** Writes that were rejected. A run with failures is not a clean run. */
  failed: number;
  /** Distinct reasons, so one bad value does not hide behind 155 repeats. */
  errors: string[];
  error?: string;
}

/**
 * Record a rejected write.
 *
 * Deduplicated: 155 rows failing the same check constraint is one problem,
 * and listing it 155 times buries it.
 */
function note(report: SyncReport, message: string): void {
  report.failed++;
  if (!report.errors.includes(message) && report.errors.length < 5) {
    report.errors.push(message);
  }
}

/**
 * Pull the calendar and reconcile it against the book.
 *
 * `dryRun` reports what would happen and writes nothing. The first run should
 * use it: the 283 seeded lessons carry no calendar_uid, so this is precisely
 * the moment a mistake would double the entire book.
 */
export async function syncLessons(opts?: {
  dryRun?: boolean;
  fromIso?: string;
  toIso?: string;
}): Promise<SyncReport> {
  const dryRun = opts?.dryRun ?? false;
  const now = new Date();
  const from =
    opts?.fromIso ??
    new Date(now.getTime() - 400 * 24 * 3600 * 1000).toISOString();
  const to =
    opts?.toIso ??
    new Date(now.getTime() + 180 * 24 * 3600 * 1000).toISOString();

  const report: SyncReport = {
    ok: false,
    dryRun,
    window: { from, to },
    scanned: 0,
    candidates: 0,
    inserted: 0,
    updated: 0,
    adopted: 0,
    queued: 0,
    cancelled: 0,
    skippedGroup: 0,
    unmatchedNames: [],
    failed: 0,
    errors: [],
  };

  if (!graphConfigured()) {
    report.error = "Microsoft Graph is not configured";
    return report;
  }

  const supa = syncClient();

  try {
    const events = await fetchCalendarEvents(from, to);
    report.scanned = events.length;

    const [{ data: clients }, { data: existing }, { data: reviewed }] =
      await Promise.all([
        supa.from("lesson_clients").select("id, name, aliases"),
        supa.from("lessons").select("id, client_id, starts_at, calendar_uid"),
        supa.from("lesson_review").select("calendar_uid"),
      ]);

    // name OR alias -> client id
    const byName = new Map<string, string>();
    for (const c of clients ?? []) {
      byName.set(norm(c.name as string), c.id as string);
      for (const a of (c.aliases as string[] | null) ?? []) {
        if (a?.trim()) byName.set(norm(a), c.id as string);
      }
    }

    const byUid = new Map<string, { id: string }>();
    // The adoption index: seeded rows have no uid, so the only way to
    // recognise them is who and when.
    const byClientStart = new Map<string, { id: string; uid: string | null }>();
    for (const l of existing ?? []) {
      const uid = l.calendar_uid as string | null;
      if (uid) byUid.set(uid, { id: l.id as string });
      if (l.client_id && l.starts_at) {
        const key = `${l.client_id}|${new Date(l.starts_at as string).toISOString()}`;
        byClientStart.set(key, { id: l.id as string, uid });
      }
    }

    const seenReview = new Set(
      (reviewed ?? []).map((r) => r.calendar_uid as string),
    );

    const toInsert: Record<string, unknown>[] = [];
    const toQueue: Record<string, unknown>[] = [];
    const unmatched = new Set<string>();

    for (const ev of events) {
      if (!ev.subject || !LESSON_WORD.test(ev.subject)) continue;
      if (NOT_BILLABLE.some((re) => re.test(ev.subject))) {
        report.skippedGroup++;
        continue;
      }
      report.candidates++;

      const bare = nameFromTitle(ev.subject);
      const clientId = bare ? byName.get(bare) : undefined;

      if (!clientId) {
        unmatched.add(bare || ev.subject);
        // Already answered, or already waiting - either way, do not re-queue.
        if (seenReview.has(ev.uid)) continue;
        report.queued++;
        toQueue.push({
          calendar_uid: ev.uid,
          starts_at: ev.startsAt,
          ends_at: ev.endsAt,
          title_raw: ev.subject,
          guess_name: bare || null,
          calendar_source: "m365",
        });
        continue;
      }

      const status = ev.isCancelled
        ? "cancelled"
        : new Date(ev.startsAt) > now
          ? "scheduled"
          : "completed";
      if (ev.isCancelled) report.cancelled++;

      const known = byUid.get(ev.uid);
      if (known) {
        if (dryRun) {
          report.updated++;
        } else {
          const { error } = await supa
            .from("lessons")
            .update({
              starts_at: ev.startsAt,
              ends_at: ev.endsAt,
              status,
              title_raw: ev.subject,
            })
            .eq("id", known.id);
          // Count what happened, not what was attempted. Incrementing first
          // and discarding the error is how a run that wrote nothing at all
          // still reported 155 successes.
          if (error) note(report, error.message);
          else report.updated++;
        }
        continue;
      }

      // No uid match. Before inserting, look for the same client at the same
      // moment - that is a seeded row for this very event, and inserting would
      // duplicate all 283 of them on the first run. Adopt it instead by
      // stamping the uid, after which the cheap uid path handles it forever.
      const adoptKey = `${clientId}|${new Date(ev.startsAt).toISOString()}`;
      const adoptable = byClientStart.get(adoptKey);
      if (adoptable && !adoptable.uid) {
        if (dryRun) {
          report.adopted++;
        } else {
          const { error } = await supa
            .from("lessons")
            .update({
              calendar_uid: ev.uid,
              calendar_source: "m365",
              ends_at: ev.endsAt,
              status,
              title_raw: ev.subject,
            })
            .eq("id", adoptable.id);
          if (error) note(report, error.message);
          else report.adopted++;
        }
        continue;
      }

      report.inserted++;
      toInsert.push({
        client_id: clientId,
        starts_at: ev.startsAt,
        ends_at: ev.endsAt,
        status,
        calendar_uid: ev.uid,
        calendar_source: "m365",
        title_raw: ev.subject,
        // package_id deliberately left null. Which series a lesson belongs to
        // is Ian's call, made on the client screen - guessing would move
        // somebody's remaining count without them knowing.
      });
    }

    report.unmatchedNames = [...unmatched].slice(0, 40);

    if (!dryRun) {
      if (toInsert.length) {
        const { error } = await supa
          .from("lessons")
          .upsert(toInsert, { onConflict: "calendar_uid" });
        if (error) throw error;
      }
      if (toQueue.length) {
        const { error } = await supa
          .from("lesson_review")
          .upsert(toQueue, {
            onConflict: "calendar_uid",
            ignoreDuplicates: true,
          });
        if (error) throw error;
      }

      const { error: healthErr } = await supa.from("lesson_calendar_sync").upsert(
        {
          source: "m365",
          label: process.env.MS_LESSON_MAILBOX ?? "Outlook",
          enabled: true,
          last_synced_at: new Date().toISOString(),
          // A run with rejected writes is not "ok", and saying so here is what
          // makes a broken sync visible without reading the logs.
          last_status: report.failed ? `partial: ${report.failed} rejected` : "ok",
          last_event_count: report.candidates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source" },
      );
      if (healthErr) note(report, healthErr.message);
    }

    // `ok` means the run did what it said. Rejected writes make it false, so
    // the cron route returns 500 and the failure surfaces instead of reading
    // as a clean run that happened to change nothing.
    report.ok = report.failed === 0;
    return report;
  } catch (e) {
    report.error = e instanceof Error ? e.message : String(e);
    if (!dryRun) {
      // Record the failure, so a sync that has been dead a week shows as dead
      // rather than quietly stale.
      try {
        await supa.from("lesson_calendar_sync").upsert(
          {
            source: "m365",
            label: process.env.MS_LESSON_MAILBOX ?? "Outlook",
            last_synced_at: new Date().toISOString(),
            last_status: `error: ${report.error}`.slice(0, 300),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "source" },
        );
      } catch {
        // Logging the failure must not become a second failure.
      }
    }
    return report;
  }
}
