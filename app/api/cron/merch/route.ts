import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/hub/log";
import { mailConfigured, sendMail } from "@/lib/mail";
import { loadTicks, merchPeople, reminderEmail } from "@/lib/merch/reminders";
import { openPeriods, pacificToday, remindersFor } from "@/lib/merch/schedule";

// The Pro Shop's report reminder, run each morning by Vercel Cron (vercel.json).
// On a reminder day (lib/merch/schedule.ts) everyone with the Merchandise
// Program gets one email listing what's still unticked. Nothing is sent on
// other days, or once a checklist is finished.
//
// A marker document (remindersSent/{date}) makes a retried run a no-op.

export const dynamic = "force-dynamic";

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : "https://pasatiempo-app.vercel.app";
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const today = pacificToday();
  try {
    const periods = openPeriods(today).filter((p) => p.remind.includes(today));
    if (!periods.length) return NextResponse.json({ today, sent: 0, reason: "not a reminder day" });
    const due = remindersFor(today, await loadTicks(periods.map((p) => p.key)));
    if (!due.length) return NextResponse.json({ today, sent: 0, reason: "everything due is ticked" });
    if (!mailConfigured()) return NextResponse.json({ today, sent: 0, reason: "email isn't set up (SMTP_HOST, SMTP_USER, SMTP_PASS)" });

    const supa = createAdminClient("merch");
    const marker = `remindersSent/${today}`;
    const { data: already } = await supa.from("docs").select("path").eq("path", marker).eq("deleted", false).maybeSingle();
    if (already) return NextResponse.json({ today, sent: 0, reason: "already sent today" });

    const mail = reminderEmail(today, due, `${siteUrl()}/merch#reports`);
    const people = await merchPeople();
    const failed: string[] = [];
    for (const p of people) {
      const err = await sendMail({ to: p.name ? `"${p.name.replace(/"/g, "")}" <${p.email}>` : p.email, ...mail });
      if (err) failed.push(`${p.email}: ${err}`);
    }
    const sent = people.length - failed.length;
    if (sent) {
      await supa.rpc("put_doc", { p_path: marker, p_data: { at: new Date().toISOString(), to: sent, periods: due.map((d) => d.period.key) }, p_by: "reminders", p_if_version: null });
      await logActivity({ actor: null, app: "merch", action: "merch.reminder_sent", detail: { to: sent, periods: due.map((d) => d.period.label).join(", "), failed: failed.length } });
    }
    if (failed.length) console.error("merch reminder: some emails failed", failed);
    return NextResponse.json({ today, sent, failed: failed.length, periods: due.map((d) => d.period.key) }, { status: failed.length && !sent ? 502 : 200 });
  } catch (e) {
    console.error("merch reminder", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
