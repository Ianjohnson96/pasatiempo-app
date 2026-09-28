import webpush, { type PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  availabilityFor,
  caddieLedger,
  formatTee,
  getSettings,
  listCaddies,
  loopsForDay,
  rankCandidates,
} from "./data";
import { nextUpOrder } from "./ledger";
import { nextBoardStep } from "./release";
import { rowToLoop, type LoopRec } from "./types";

// Web push: the thing that makes this app worth opening.
//
// Caddies are on call rather than waiting in a yard, so a posted job has to
// reach them where they are. Push does that for nothing — no carrier
// registration, no per-message fee, no 10DLC queue. The trade is that iPhones
// only deliver it once the caddie has added the portal to their home screen.

let configured: boolean | null = null;

/** Set up VAPID once per process. Returns false when keys are missing. */
function ready(): boolean {
  if (configured !== null) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@pasatiempo.com";

  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/** Whether push can actually be sent, so the UI can tell the truth about it. */
export function pushConfigured(): boolean {
  return ready();
}

export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Remember a device so it can be reached later. */
export async function savePushSubscription(
  caddieId: string,
  keys: PushKeys,
  userAgent: string | null,
): Promise<void> {
  const supa = createAdminClient("caddie");
  const { error } = await supa.from("push_subscriptions").upsert(
    {
      endpoint: keys.endpoint,
      caddie_id: caddieId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const supa = createAdminClient("caddie");
  await supa.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export interface JobAlert {
  title: string;
  body: string;
  /** Where tapping the notification lands. */
  url: string;
  /** Collapses repeat alerts about the same loop instead of stacking them. */
  tag?: string;
  loopId?: string;
}

/**
 * Send to one device, folding the outcome into `result`.
 *
 * 404 and 410 mean the browser threw the subscription away — uninstalled,
 * permission revoked, or a cleared profile. Keeping it would mean failing
 * against a dead endpoint for ever, so it is deleted as we go.
 */
async function deliver(
  row: { endpoint: unknown; p256dh: unknown; auth: unknown },
  alert: JobAlert,
  result: PushResult,
): Promise<void> {
  const sub: PushSubscription = {
    endpoint: String(row.endpoint),
    keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
  };
  try {
    await webpush.sendNotification(sub, JSON.stringify(alert));
    result.sent += 1;
    await createAdminClient("caddie")
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("endpoint", sub.endpoint);
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await removePushSubscription(sub.endpoint);
      result.pruned += 1;
    } else {
      result.failed += 1;
    }
  }
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Devices the push service said are gone; deleted as we go. */
  pruned: number;
}

/**
 * Remind caddies about loops they have already accepted.
 *
 * The forgetting problem, not the refusing problem: a caddie who said yes on
 * Tuesday to a Saturday loop has had four days to lose track of it, and in an
 * on-call programme that is how a no-show actually happens.
 *
 * Idempotent by column: reminder_sent_at is stamped per assignment, so running
 * the sweep twice never double-sends and a caddie never gets buzzed twice
 * about the same loop.
 */
export async function remindUpcomingLoops(): Promise<{
  reminded: number;
  devices: number;
}> {
  if (!ready()) return { reminded: 0, devices: 0 };

  const supa = createAdminClient("caddie");

  const { data: settingsRow } = await supa
    .from("settings")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  const settings = (settingsRow?.data ?? {}) as Record<string, unknown>;
  const hours = Number(settings.reminder_hours_before ?? 24);
  const tz = String(settings.course_timezone ?? "America/Los_Angeles");

  const horizon = new Date(Date.now() + hours * 3_600_000).toISOString();

  const { data, error } = await supa
    .from("assignments")
    .select("id, caddie_id, loops!inner(id, tee_time, player_name, loop_type, status)")
    .eq("confirmation_status", "Accepted")
    .is("reminder_sent_at", null)
    .gte("loops.tee_time", new Date().toISOString())
    .lte("loops.tee_time", horizon)
    .neq("loops.status", "Cancelled");
  if (error) throw error;

  const due = data ?? [];
  if (due.length === 0) return { reminded: 0, devices: 0 };

  // "You're on tomorrow" is the message, but only when it is actually
  // tomorrow. Run the sweep by hand at nine in the morning and a loop that
  // afternoon is today, not tomorrow, and saying otherwise sends someone to
  // the first tee on the wrong day.
  const courseDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
  });
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });

  const todayStr = courseDate.format(new Date());
  const tomorrowStr = courseDate.format(new Date(Date.now() + 86_400_000));

  let devices = 0;
  for (const row of due) {
    const loop = row.loops as unknown as {
      id: string;
      tee_time: string;
      player_name: string;
      loop_type: string;
    };

    const teeAt = new Date(loop.tee_time);
    const on = courseDate.format(teeAt);
    const whenWord =
      on === tomorrowStr
        ? "tomorrow"
        : on === todayStr
          ? "today"
          : weekday.format(teeAt);

    const result = await notifyCaddies([String(row.caddie_id)], {
      title: `You're on ${whenWord}`,
      body: `${clock.format(teeAt)} · ${loop.loop_type}\n${loop.player_name}`,
      url: "/caddie",
      tag: `reminder-${loop.id}`,
      loopId: loop.id,
    });
    devices += result.sent;

    // Stamped whether or not a device answered. A caddie with no phone signed
    // up cannot be reminded, and retrying them every night for ever would just
    // grind against dead endpoints.
    await supa
      .from("assignments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return { reminded: due.length, devices };
}

/**
 * Widen tier offers that nobody has taken.
 *
 * A loop offered to the senior tier and left sitting is the case this exists
 * for: rather than the shop watching a clock, the offer reaches down the
 * ladder one tier at a time until somebody takes it.
 *
 * Two rules keep it fair. It only ever widens by ONE tier per run, so a loop
 * cannot fall from the top to the bottom in a single sweep. And it never
 * widens a loop somebody has already accepted, nor one that has teed off.
 *
 * Entirely driven by the shop's settings; off unless they turn it on.
 */
export async function escalateTierOffers(): Promise<{
  widened: number;
  notified: number;
}> {
  const out = { widened: 0, notified: 0 };
  if (!ready()) return out;

  const supa = createAdminClient("caddie");

  const { data: settingsRow } = await supa
    .from("settings")
    .select("data")
    .eq("id", 1)
    .maybeSingle();
  const w = (((settingsRow?.data ?? {}) as Record<string, unknown>).waterfall ??
    {}) as Record<string, unknown>;
  if (!w.enabled) return out;

  const bands = {
    urgentWithinHours: Number(w.urgentWithinHours ?? 12),
    urgentMinutes: Number(w.urgentMinutes ?? 10),
    soonWithinHours: Number(w.soonWithinHours ?? 48),
    soonMinutes: Number(w.soonMinutes ?? 30),
    laterMinutes: Number(w.laterMinutes ?? 120),
  };

  const [{ data: tierRows }, { data: loopRows }] = await Promise.all([
    supa.from("tiers").select("id, name, sort_order").order("sort_order"),
    supa
      .from("loops")
      .select("id, tee_time, status")
      .in("status", ["Unassigned", "Partially Assigned"])
      .gte("tee_time", new Date().toISOString()),
  ]);

  const tiers = tierRows ?? [];
  if (tiers.length < 2) return out; // nothing to widen into

  for (const loop of loopRows ?? []) {
    const { data: asgs } = await supa
      .from("assignments")
      .select("caddie_id, confirmation_status, offered_at, caddies!inner(tier_id)")
      .eq("loop_id", loop.id);

    const rows = asgs ?? [];
    if (rows.length === 0) continue; // never offered; not the waterfall's job
    if (rows.some((a) => a.confirmation_status === "Accepted")) continue;

    // The furthest down the ladder this loop has already reached.
    const offeredTierIds = new Set(
      rows
        .map((a) => (a.caddies as unknown as { tier_id: string | null })?.tier_id)
        .filter(Boolean) as string[],
    );
    const deepest = tiers.reduce(
      (acc, t, i) => (offeredTierIds.has(String(t.id)) ? i : acc),
      -1,
    );
    if (deepest === -1 || deepest >= tiers.length - 1) continue;

    // Has the current tier had its turn?
    const lastOfferedAt = rows
      .map((a) => new Date(String(a.offered_at)).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const hoursUntilTee =
      (new Date(String(loop.tee_time)).getTime() - Date.now()) / 3_600_000;
    const windowMins =
      hoursUntilTee <= bands.urgentWithinHours
        ? bands.urgentMinutes
        : hoursUntilTee <= bands.soonWithinHours
          ? bands.soonMinutes
          : bands.laterMinutes;

    if (Date.now() - lastOfferedAt < windowMins * 60_000) continue;

    const nextTier = tiers[deepest + 1];
    const { data: nextCaddies } = await supa
      .from("caddies")
      .select("id")
      .eq("status", "Active")
      .eq("tier_id", nextTier.id);

    const already = new Set(rows.map((a) => String(a.caddie_id)));
    const ids = (nextCaddies ?? [])
      .map((c) => String(c.id))
      .filter((id) => !already.has(id));
    if (ids.length === 0) continue;

    const expires = new Date(Date.now() + windowMins * 60_000).toISOString();
    let inserted = 0;
    for (const caddieId of ids) {
      const { error } = await supa.from("assignments").insert({
        loop_id: loop.id,
        caddie_id: caddieId,
        offer_kind: "broadcast",
        offer_expires_at: expires,
      });
      if (!error) inserted += 1;
    }
    if (inserted === 0) continue;

    const push = await notifyCaddies(ids, {
      title: "Loop offered — first to answer",
      body: `Now open to ${nextTier.name}. Tap to accept or decline.`,
      url: "/caddie",
      tag: `offer-${loop.id}`,
      loopId: String(loop.id),
    });

    out.widened += 1;
    out.notified += push.sent;
  }

  return out;
}

/**
 * Notify specific caddies rather than the whole roster.
 *
 * A reminder is addressed to the person who accepted the loop; blasting it to
 * everyone would train the yard to ignore notifications, which is the one
 * failure this whole channel cannot recover from.
 */
export async function notifyCaddies(
  caddieIds: string[],
  alert: JobAlert,
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, pruned: 0 };
  if (!ready() || caddieIds.length === 0) return result;

  const supa = createAdminClient("caddie");
  const { data, error } = await supa
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("caddie_id", caddieIds);
  if (error) throw error;

  await Promise.all(
    (data ?? []).map((row) => deliver(row, alert, result)),
  );
  return result;
}

/**
 * Notify every ACTIVE caddie, optionally excluding some.
 *
 * Everyone active rather than only those who ticked themselves available: on a
 * roster this size stated availability is a hint, and a caddie who is free but
 * forgot to fill the calendar in should still hear about the loop.
 * Availability still orders the dispatch list — it just does not gag the alert.
 */
export async function notifyActiveCaddies(
  alert: JobAlert,
  options: { excludeCaddieIds?: string[] } = {},
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, pruned: 0 };
  if (!ready()) return result;

  const supa = createAdminClient("caddie");

  const { data, error } = await supa
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, caddie_id, caddies!inner(status)")
    .eq("caddies.status", "Active");
  if (error) throw error;

  const exclude = new Set(options.excludeCaddieIds ?? []);
  const targets = (data ?? []).filter((r) => !exclude.has(String(r.caddie_id)));
  if (targets.length === 0) return result;

  await Promise.all(targets.map((row) => deliver(row, alert, result)));

  // One row per blast rather than per device: the shop cares that the call went
  // out, not which handset acknowledged it.
  await supa.from("notification_logs").insert({
    loop_id: alert.loopId ?? null,
    channel: "Push",
    template_key: alert.tag ?? "job_post",
    to_address: `${result.sent} device${result.sent === 1 ? "" : "s"}`,
    payload: { ...alert, ...result },
    status: result.sent > 0 ? "Sent" : "Failed",
    provider: "webpush",
    sent_at: new Date().toISOString(),
  });

  return result;
}

// ---------------------------------------------------------------------------
// The open board: releasing jobs on the shop's schedule
// ---------------------------------------------------------------------------

function courseDay(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * Open posted jobs to caddies when their time comes.
 *
 * Runs on every housekeeping sweep and straight after a job is posted, so an
 * urgent job never waits ten minutes for the next sweep. For each posted job
 * nobody can see yet, the rules (lib/caddie/release.ts) say one of three
 * things: not yet; give next-up first refusal; or open it to everyone. Jobs
 * opened in the same pass share one notification — five pings for one evening's
 * release is how a roster learns to ignore them.
 *
 * Visibility is recorded whether or not push is configured: the board must
 * work without notifications, it is simply slower to be noticed.
 */
export async function processBoard(
  loopIds?: string[],
): Promise<{ announced: number; offered: number }> {
  const out = { announced: 0, offered: 0 };
  const supa = createAdminClient("caddie");
  const settings = await getSettings();
  // First refusal goes to whoever is furthest behind on Fair share. With Fair
  // share off there is no such person, so first refusal is off too, whatever
  // its own switch says.
  const rules = {
    ...settings.release,
    priorityEnabled: settings.release.priorityEnabled && settings.fairShareEnabled,
  };
  const tz = settings.courseTimezone;

  let q = supa
    .from("loops")
    .select("*")
    .eq("open_board", true)
    .is("board_announced_at", null)
    .in("status", ["Unassigned", "Partially Assigned"])
    .gt("tee_time", new Date().toISOString())
    .order("tee_time", { ascending: true });
  if (loopIds && loopIds.length > 0) q = q.in("id", loopIds);
  const { data: rows, error } = await q;
  if (error) throw error;
  if (!rows || rows.length === 0) return out;

  const nowMs = Date.now();
  const { data: pending } = await supa
    .from("assignments")
    .select("loop_id, offer_expires_at")
    .in("loop_id", rows.map((r) => String(r.id)))
    .eq("offer_kind", "priority")
    .eq("confirmation_status", "Pending");
  const held = new Set(
    (pending ?? [])
      .filter((p) => !p.offer_expires_at || new Date(String(p.offer_expires_at)).getTime() > nowMs)
      .map((p) => String(p.loop_id)),
  );

  const toOpen: string[] = [];
  for (const r of rows) {
    const step = nextBoardStep({
      teeTimeIso: String(r.tee_time),
      postedAtIso: String(r.board_posted_at ?? r.updated_at ?? r.created_at),
      priorityOffered: !!r.priority_offered_at,
      priorityPending: held.has(String(r.id)),
      nowMs,
      rules,
      tz,
    });
    if (step === "wait") continue;
    if (step === "announce") {
      toOpen.push(String(r.id));
      continue;
    }

    const given = await givePriority(rowToLoop(r), settings.overlapGuardHours, rules.priorityMinutes, tz);
    // Nobody eligible for first refusal: no reason to hold the job back.
    if (given === 0) toOpen.push(String(r.id));
    else if (given > 0) out.offered += given;
  }

  if (toOpen.length > 0) {
    // Conditional, so two sweeps that overlap announce a job once.
    const { data: opened, error: upErr } = await supa
      .from("loops")
      .update({ board_announced_at: new Date().toISOString() })
      .in("id", toOpen)
      .is("board_announced_at", null)
      .select("id, tee_time, player_name");
    if (upErr) throw upErr;

    const list = (opened ?? []).sort((a, b) =>
      String(a.tee_time).localeCompare(String(b.tee_time)),
    );
    out.announced = list.length;
    if (list.length > 0) {
      const first = list[0];
      const when = `${new Date(String(first.tee_time)).toLocaleDateString("en-US", {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric",
      })} ${formatTee(String(first.tee_time), tz)}`;
      await notifyActiveCaddies({
        title: list.length === 1 ? "Loop available" : `${list.length} loops available`,
        body:
          list.length === 1
            ? `${first.player_name} — ${when}. First to claim gets it.`
            : `Earliest ${when}. First to claim gets each one.`,
        url: "/caddie",
        tag: `board-${list.map((l) => l.id).join("-").slice(0, 60)}`,
        loopId: String(first.id),
      });
    }
  }

  return out;
}

/**
 * Give next-up first refusal on one job. Returns how many were offered it;
 * 0 when nobody is eligible (so the job should open to everyone); -1 when
 * another sweep got there first (so this one should leave it alone).
 */
async function givePriority(
  loop: LoopRec,
  overlapGuardHours: number,
  minutes: number,
  tz: string,
): Promise<number> {
  const supa = createAdminClient("caddie");

  // Claim the job for first refusal before offering it, so two overlapping
  // sweeps can never give it to next-up twice.
  const now = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supa
    .from("loops")
    .update({ priority_offered_at: now })
    .eq("id", loop.id)
    .is("priority_offered_at", null)
    .select("id");
  if (claimErr) throw claimErr;
  if (!claimed || claimed.length === 0) return -1;

  const day = courseDay(loop.teeTime, tz);
  const [dayLoops, caddies, availability, ledger] = await Promise.all([
    loopsForDay(day, tz),
    listCaddies(),
    availabilityFor(day),
    caddieLedger(60),
  ]);

  // The same eligible pool the dispatch board would offer from: free that
  // day, not on another loop too close to this one, not already asked.
  const eligible = rankCandidates(loop, caddies, dayLoops, availability, overlapGuardHours)
    .filter((c) => !c.alreadyOffered && !c.conflict && c.availability !== "Unavailable")
    .map((c) => c.caddie.id);

  const accepted =
    dayLoops
      .find((d) => d.loop.id === loop.id)
      ?.crew.filter((m) => m.confirmationStatus === "Accepted").length ?? 0;
  const seats = Math.max(0, loop.caddiesRequired - accepted);
  // Furthest behind on the fair-share list goes first.
  const pick = nextUpOrder(ledger, eligible).slice(0, seats);
  if (pick.length === 0) return 0;

  const expires = new Date(Date.now() + minutes * 60_000).toISOString();
  const { error } = await supa.from("assignments").insert(
    pick.map((caddieId) => ({
      loop_id: loop.id,
      caddie_id: caddieId,
      offer_kind: "priority",
      offered_by: "next-up",
      offer_expires_at: expires,
    })),
  );
  if (error) throw error;

  const when = `${new Date(loop.teeTime).toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  })} ${formatTee(loop.teeTime, tz)}`;
  await notifyCaddies(pick, {
    title: "You're next up",
    body: `First refusal on ${loop.playerName}, ${when}. You have ${minutes} minutes before it opens to everyone.`,
    url: "/caddie",
    tag: `offer-${loop.id}`,
    loopId: loop.id,
  });

  return pick.length;
}
