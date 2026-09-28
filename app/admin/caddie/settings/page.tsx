import { redirect } from "next/navigation";
import { requireCaddieStaff } from "@/lib/caddie/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import SettingsEditor from "@/components/caddie/SettingsEditor";
import { getSettings } from "@/lib/caddie/data";
import { dropAlertRecipients } from "@/lib/caddie/alerts";
import { mailConfigured } from "@/lib/mail";

// The rules the Caddie Program runs under: when jobs open, how drops are
// judged, how long offers last. Caddie Program admins only — the counter
// dispatches under these rules and does not get to change them. The gate is
// here as well as on the tab, because a hidden link is not a permission.
export const dynamic = "force-dynamic";

export default async function CaddieSettingsPage() {
  const viewer = await requireCaddieStaff();
  if (!viewer.isGlobalAdmin) redirect("/admin/caddie");

  const [s, everyone] = await Promise.all([getSettings(), dropAlertRecipients()]);
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
          }}
          alertRecipients={admins}
          mailReady={mailConfigured()}
        />
      </main>
    </>
  );
}
