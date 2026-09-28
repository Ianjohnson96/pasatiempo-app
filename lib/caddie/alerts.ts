import { createAdminClient, createHubClient } from "@/lib/supabase/admin";
import { mailConfigured, sendMail } from "@/lib/mail";
import { formatTee, getSettings } from "./data";
import { dropLateness } from "./ledger";

// Telling the shop when a caddie hands a loop back.
//
// A drop reopens the loop on the Jobs and Dispatch screens, but nobody is
// looking at a screen at 7am when a caddie gives back the 8:10. The shop needs
// to hear it, the way it would have if he had rung.
//
// Best-effort by design: a missing mailbox or a failed send must never stop a
// caddie handing a loop back — the drop is the thing that matters, the email is
// only the news of it.

/**
 * Who to tell: every active Caddie Program admin and super admin, plus any
 * extra addresses set in Settings. Read from the access list rather than
 * stored separately, so granting someone admin is enough to put them on it.
 */
export async function dropAlertRecipients(): Promise<string[]> {
  const hub = createHubClient();
  const [{ data: people }, { data: admins }, settings] = await Promise.all([
    hub.from("people").select("email, super_admin, active"),
    hub.from("access").select("email").eq("app", "caddie").eq("role", "admin"),
    getSettings(),
  ]);

  const active = new Set(
    (people ?? []).filter((p) => p.active !== false).map((p) => String(p.email).toLowerCase()),
  );
  const supers = (people ?? [])
    .filter((p) => p.super_admin && p.active !== false)
    .map((p) => String(p.email).toLowerCase());
  const caddieAdmins = (admins ?? [])
    .map((a) => String(a.email).toLowerCase())
    .filter((e) => active.has(e));

  return [...new Set([...supers, ...caddieAdmins, ...settings.dropAlertEmails.map((e) => e.toLowerCase())])];
}

/** Email the shop about one drop. Never throws. */
export async function alertShopOfDrop(assignmentId: string): Promise<void> {
  try {
    if (!mailConfigured()) return;

    const supa = createAdminClient("caddie");
    const { data: row } = await supa
      .from("assignments")
      .select("dropped_at, loops!inner(id, tee_time, player_name, loop_type), caddies!inner(full_name)")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!row) return;

    const loop = row.loops as unknown as {
      id: string;
      tee_time: string;
      player_name: string;
      loop_type: string;
    };
    const caddie = row.caddies as unknown as { full_name: string };

    const [settings, to] = await Promise.all([getSettings(), dropAlertRecipients()]);
    if (to.length === 0) return;

    const tz = settings.courseTimezone;
    const late = dropLateness(row.dropped_at ? String(row.dropped_at) : null, loop.tee_time, {
      lateHours: settings.dropLateHours,
      sameDayHours: settings.dropSameDayHours,
    });
    const day = new Date(loop.tee_time).toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    const tee = formatTee(loop.tee_time, tz);
    const urgency =
      late === "same day" ? "Same day — " : late === "late" ? "Within a day — " : "";

    const subject = `${urgency}${caddie.full_name} handed back ${loop.player_name}, ${day} ${tee}`;
    const lines = [
      `${caddie.full_name} can no longer make this loop, and it is open again:`,
      "",
      `  ${loop.player_name} — ${loop.loop_type}`,
      `  ${day} at ${tee}`,
      "",
      late === "same day"
        ? "It tees off within a few hours."
        : late === "late"
          ? "It tees off within a day."
          : "There is still time to fill it.",
      "",
      "Offer it from the Dispatch board, or see it on the Jobs tab.",
    ];

    const error = await sendMail({
      to: to.join(", "),
      subject,
      text: lines.join("\n"),
      html: lines
        .map((l) => (l ? `<p style="margin:0 0 4px">${escapeHtml(l)}</p>` : "<br>"))
        .join(""),
    });

    await supa.from("notification_logs").insert({
      loop_id: loop.id,
      channel: "Email",
      template_key: "drop_alert",
      to_address: to.join(", "),
      payload: { assignmentId, subject },
      status: error ? "Failed" : "Sent",
      provider: "smtp",
      sent_at: new Date().toISOString(),
    });
  } catch {
    // The drop has already been recorded; news of it failing is not a reason
    // to tell the caddie something went wrong.
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
