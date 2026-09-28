import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "./data";
import { resolveOrigin } from "./origin";
import { composeText } from "./sms-words";
import type { SmsChannels } from "./types";

// Texting, through Twilio.
//
// A second road to the same caddie, not a replacement for push. Push is free
// and instant but only reaches a phone that has the portal on its home screen
// with alerts allowed; a text reaches any phone, and a caddie can answer an
// offer with one letter without opening anything.
//
// Nothing goes out unless all three are true: the Twilio keys are in the
// environment, the shop has switched texting on in Settings, and the caddie
// has agreed from their own phone. Each text is logged whether it went or not.

/** Whether the Twilio keys are present. Says nothing about registration. */
export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_FROM_NUMBER),
  );
}

/** The number caddies text back, formatted for a screen, or null. */
export function smsFromNumber(): string | null {
  return process.env.TWILIO_FROM_NUMBER ?? null;
}

/**
 * Where links in a text point.
 *
 * There is no request to read a host from when the ten-minute sweep sends a
 * reminder, so this leans on Vercel's own production hostname, with the same
 * guard as the sign-in links against a localhost value left in the settings.
 */
export function portalLink(path = "/caddie"): string {
  const origin = resolveOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    host: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
  });
  return origin + path;
}

export interface TextOutcome {
  ok: boolean;
  sid?: string;
  error?: string;
}

/**
 * Send one text. Never throws: a failed text must not undo the offer it was
 * about, which has already been written by the time this runs.
 */
export async function sendText(
  to: string,
  body: string,
  meta: { caddieId?: string | null; loopId?: string | null; template: string },
): Promise<TextOutcome> {
  let outcome: TextOutcome;
  if (!smsConfigured()) {
    outcome = { ok: false, error: "Twilio is not configured." };
  } else {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID as string;
      const form = new URLSearchParams({ To: to, Body: body });
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
        form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
      } else {
        form.set("From", process.env.TWILIO_FROM_NUMBER as string);
      }
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        sid?: string;
        message?: string;
        code?: number;
      };
      outcome = res.ok
        ? { ok: true, sid: json.sid }
        : {
            ok: false,
            error: `${json.code ?? res.status}: ${json.message ?? "Twilio refused the text."}`,
          };
    } catch (e) {
      outcome = { ok: false, error: e instanceof Error ? e.message : "Could not reach Twilio." };
    }
  }

  await createAdminClient("caddie")
    .from("notification_logs")
    .insert({
      caddie_id: meta.caddieId ?? null,
      loop_id: meta.loopId ?? null,
      channel: "SMS",
      template_key: meta.template,
      to_address: to,
      payload: { body },
      status: outcome.ok ? "Sent" : "Failed",
      provider: "twilio",
      provider_message_id: outcome.sid ?? null,
      error: outcome.error ?? null,
      sent_at: outcome.ok ? new Date().toISOString() : null,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return outcome;
}

export interface TextAlert {
  title: string;
  body: string;
  loopId?: string;
  tag?: string;
  /** Ask for a Y/N answer — only for offers the caddie can actually answer. */
  reply?: boolean;
}

/**
 * Text caddies who have agreed to it, for one kind of message.
 *
 * `caddieIds` null means everyone active who has texts on — the job-board
 * case. Returns how many texts Twilio accepted.
 */
export async function textCaddies(
  caddieIds: string[] | null,
  alert: TextAlert,
  kind: keyof SmsChannels,
  options: { excludeCaddieIds?: string[] } = {},
): Promise<number> {
  if (!smsConfigured()) return 0;
  if (caddieIds && caddieIds.length === 0) return 0;

  const settings = await getSettings();
  if (!settings.smsEnabled || !settings.sms[kind]) return 0;

  let q = createAdminClient("caddie")
    .from("caddies")
    .select("id, phone")
    .eq("status", "Active")
    .eq("sms_opt_in", true)
    .is("sms_opt_out_at", null)
    .not("phone", "is", null);
  if (caddieIds) q = q.in("id", caddieIds);
  const { data, error } = await q;
  if (error) return 0;

  const exclude = new Set(options.excludeCaddieIds ?? []);
  const body = composeText({
    title: alert.title,
    body: alert.body,
    link: portalLink(),
    reply: alert.reply,
  });

  const results = await Promise.all(
    (data ?? [])
      .filter((r) => !exclude.has(String(r.id)))
      .map((r) =>
        sendText(String(r.phone), body, {
          caddieId: String(r.id),
          loopId: alert.loopId ?? null,
          template: alert.tag?.split("-")[0] ?? kind,
        }),
      ),
  );
  return results.filter((r) => r.ok).length;
}
