import { createClient as createSbClient } from "@supabase/supabase-js";
import { fetchCalendarEvents, graphConfigured } from "./graph";
import { courseDay, normName, singleRate } from "./calc";
import {
  isLessonTitle,
  nameFromTitle,
  needsSingle,
  planEntry,
  type ReviewState,
} from "./sync-plan";

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
  /** Waiting Review entries whose title now matches, booked and cleared. */
  resolved: number;
  /** New lessons billed as singles (client had no package with room). */
  singles: number;
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
    resolved: 0,
    singles: 0,
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

    const [
      { data: clients },
      { data: existing },
      { data: reviewed },
      { data: packages },
      { data: settings },
    ] = await Promise.all([
      supa.from("lesson_clients").select("id, name, aliases, is_member"),
      supa
        .from("lessons")
        .select("id, client_id, starts_at, calendar_uid, package_id, status"),
      supa.from("lesson_review").select("calendar_uid, dismissed"),
      supa.from("lesson_packages").select("id, client_id, size, kind"),
      supa
        .from("lesson_settings")
        .select("single_rates")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    // Room per client, for deciding whether a new lesson is a single: each
    // package's size against the lessons already counted in it.
    const counted = new Map<string, number>();
    for (const l of existing ?? []) {
      if (l.package_id && (l.status === "completed" || l.status === "scheduled")) {
        const k = l.package_id as string;
        counted.set(k, (counted.get(k) ?? 0) + 1);
      }
    }
    const roomByClient = new Map<
      string,
      { kind: string; size: number; counted: number }[]
    >();
    for (const p of packages ?? []) {
      const list = roomByClient.get(p.client_id as string) ?? [];
      list.push({
        kind: (p.kind as string) ?? "package",
        size: Number(p.size),
        counted: counted.get(p.id as string) ?? 0,
      });
      roomByClient.set(p.client_id as string, list);
    }
    const isMember = new Map(
      (clients ?? []).map((c) => [c.id as string, c.is_member === true]),
    );
    const rawRates = (settings?.single_rates ?? {}) as Record<string, unknown>;
    const rateOf = (v: unknown) =>
      v !== null && v !== undefined && Number.isFinite(Number(v))
        ? Number(v)
        : undefined;
    const rates = { member: rateOf(rawRates.member), guest: rateOf(rawRates.guest) };
    // New lessons to bill on their own once inserted: calendar uid -> client.
    const toSingle = new Map<string, string>();

    // name OR alias -> client id
    const byName = new Map<string, string>();
    for (const c of clients ?? []) {
      byName.set(normName(c.name as string), c.id as string);
      for (const a of (c.aliases as string[] | null) ?? []) {
        if (a?.trim()) byName.set(normName(a), c.id as string);
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

    const reviewState = new Map<string, ReviewState>(
      (reviewed ?? []).map((r) => [
        r.calendar_uid as string,
        r.dismissed ? "dismissed" : "waiting",
      ]),
    );
    // Waiting entries booked this run; removed from Review only after the
    // lesson write has gone through.
    const toClear: string[] = [];

    const toInsert: Record<string, unknown>[] = [];
    const toQueue: Record<string, unknown>[] = [];
    const unmatched = new Set<string>();

    for (const ev of events) {
      const kind = isLessonTitle(ev.subject);
      if (kind === "no") continue;
      if (kind === "group") {
        report.skippedGroup++;
        continue;
      }
      report.candidates++;

      const bare = nameFromTitle(ev.subject);
      const clientId = bare ? byName.get(bare) : undefined;
      const plan = planEntry({
        matched: !!clientId,
        review: reviewState.get(ev.uid) ?? null,
      });

      if (plan.action === "skip") {
        if (!clientId) unmatched.add(bare || ev.subject);
        continue;
      }
      if (plan.action === "queue" || !clientId) {
        unmatched.add(bare || ev.subject);
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
      // A waiting Review entry that now matches leaves the queue once its
      // lesson is written (cleared after the writes below, never before).
      if (plan.clearReview) toClear.push(ev.uid);

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
        // package_id left null here. A client with no package that has room
        // gets the lesson billed as a single below; one WITH room keeps it
        // unassigned, because which series it belongs to is Ian's call.
      });
      if (status !== "cancelled" && needsSingle(roomByClient.get(clientId) ?? [])) {
        toSingle.set(ev.uid, clientId);
      }
    }

    report.unmatchedNames = [...unmatched].slice(0, 40);

    if (dryRun) {
      report.resolved = toClear.length;
      report.singles = toSingle.size;
    }

    if (!dryRun) {
      if (toInsert.length) {
        const { error } = await supa
          .from("lessons")
          .upsert(toInsert, { onConflict: "calendar_uid" });
        if (error) throw error;
      }
      if (toSingle.size) {
        const { data: fresh, error: fErr } = await supa
          .from("lessons")
          .select("id, client_id, starts_at, calendar_uid")
          .in("calendar_uid", [...toSingle.keys()])
          .is("package_id", null);
        if (fErr) throw fErr;
        for (const l of fresh ?? []) {
          const clientId = l.client_id as string;
          const { data: pkg, error: pErr } = await supa
            .from("lesson_packages")
            .insert({
              client_id: clientId,
              size: 1,
              kind: "single",
              sold_on: courseDay(l.starts_at as string),
              price_cents: singleRate(isMember.get(clientId) ?? false, rates),
              payment_status: "unpaid",
            })
            .select("id")
            .single();
          if (pErr) {
            note(report, pErr.message);
            continue;
          }
          const { error: uErr } = await supa
            .from("lessons")
            .update({ package_id: pkg.id })
            .eq("id", l.id)
            .is("package_id", null);
          if (uErr) note(report, uErr.message);
          else report.singles++;
        }
      }
      if (toClear.length) {
        // Only entries whose lesson is now in the book by its calendar id:
        // a rejected update above leaves its entry waiting, not lost.
        const { data: booked, error: bErr } = await supa
          .from("lessons")
          .select("calendar_uid")
          .in("calendar_uid", toClear);
        if (bErr) throw bErr;
        const done = (booked ?? []).map((b) => b.calendar_uid as string);
        if (done.length) {
          const { error } = await supa
            .from("lesson_review")
            .delete()
            .in("calendar_uid", done);
          if (error) throw error;
        }
        report.resolved = done.length;
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
