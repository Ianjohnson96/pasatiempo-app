import { redirect } from "next/navigation";
import { requireCaddieStaff } from "@/lib/caddie/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import SettingsEditor from "@/components/caddie/SettingsEditor";
import { headers } from "next/headers";
import { caddieReach, getSettings } from "@/lib/caddie/data";
import { dropAlertRecipients } from "@/lib/caddie/alerts";
import { resolveOrigin } from "@/lib/caddie/origin";
import { smsConfigured, smsFromNumber } from "@/lib/caddie/sms";
import { mailConfigured } from "@/lib/mail";

// The rules the Caddie Program runs under: when jobs open, how drops are
// judged, how long offers last. Caddie Program admins only — the counter
// dispatches under these rules and does not get to change them. The gate is
// here as well as on the tab, because a hidden link is not a permission.
export const dynamic = "force-dynamic";

export default async function CaddieSettingsPage() {
  const viewer = await requireCaddieStaff();
  if (!viewer.isGlobalAdmin) redirect("/admin/caddie");

  const [s, everyone, reach, h] = await Promise.all([
    getSettings(),
    dropAlertRecipients(),
    caddieReach(),
    headers(),
  ]);
  // The address to paste into Twilio. From this request's own host, because
  // the page is being looked at on the deployment Twilio has to reach.
  const origin = resolveOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    host: h.get("x-forwarded-host") ?? h.get("host"),
    proto: h.get("x-forwarded-proto"),
  });
  const reachList = [...reach.values()];
  // Shown separately from the extra addresses, which the form edits.
  const extras = new Set(s.dropAlertEmails.map((e) => e.toLowerCase()));
  const admins = everyone.filter((e) => !extras.has(e));

  return (
    <>
      <CaddieHeader email={viewer.email} active="settings" isGlobalAdmin />
      <main className="container" style={{ maxWidth: 760 }}>
        <h2 className="section-title" style={{ marginBottom: 2 }}>
          Settings
        </h2>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          The rules the Caddie Program runs under. Rates and the tier waterfall have their own
          tabs.
        </p>

        <SettingsEditor
          initial={{
            dropLateHours: s.dropLateHours,
            dropSameDayHours: s.dropSameDayHours,
            offerExpiryMinutes: s.offerExpiryMinutes,
            broadcastExpiryMinutes: s.broadcastExpiryMinutes,
            overlapGuardHours: s.overlapGuardHours,
            reminderHoursBefore: s.reminderHoursBefore,
            completeAfterHours: s.completeAfterHours,
            claimLimit: s.claimLimit,
            dropAlertEmails: s.dropAlertEmails.join(", "),
            inviteDays: Math.max(1, Math.round(s.inviteMinutes / 1440)),
            sessionDays: s.sessionDays,
            availabilityMonths: s.availabilityMonths,
            release: s.release,
            fairShareEnabled: s.fairShareEnabled,
            smsEnabled: s.smsEnabled,
            sms: s.sms,
          }}
          alertRecipients={admins}
          mailReady={mailConfigured()}
          texting={{
            configured: smsConfigured(),
            fromNumber: smsFromNumber(),
            webhookUrl: process.env.TWILIO_WEBHOOK_URL ?? `${origin}/api/caddie/sms`,
            termsUrl: `${origin}/caddie/texts`,
            optedIn: reachList.filter((r) => r.texts).length,
            active: reachList.length,
          }}
        />
      </main>
    </>
  );
}
