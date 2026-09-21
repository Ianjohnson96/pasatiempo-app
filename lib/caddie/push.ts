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

export interface PushResult {
  sent: number;
  failed: number;
  /** Devices the push service said are gone; deleted as we go. */
  pruned: number;
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

  const payload = JSON.stringify(alert);

  await Promise.all(
    targets.map(async (row) => {
      const sub: PushSubscription = {
        endpoint: String(row.endpoint),
        keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
      };
      try {
        await webpush.sendNotification(sub, payload);
        result.sent += 1;
        await supa
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("endpoint", sub.endpoint);
      } catch (e) {
        // 404/410 mean the browser threw the subscription away — uninstalled,
        // permission revoked, or a cleared profile. Keeping it would mean
        // failing against that endpoint for ever.
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await removePushSubscription(sub.endpoint);
          result.pruned += 1;
        } else {
          result.failed += 1;
        }
      }
    }),
  );

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
