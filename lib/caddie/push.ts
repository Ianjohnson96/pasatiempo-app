import webpush, { type PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

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
