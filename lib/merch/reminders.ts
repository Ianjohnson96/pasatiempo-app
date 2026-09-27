import { createAdminClient, createHubClient } from "@/lib/supabase/admin";
import { openPeriods, periodStatus, remaining, shortDate, type Period, type PeriodStatus, type ReportItem, type Ticks } from "./schedule";

// Server side of the reporting calendar (lib/merch/schedule.ts): which
// checklists are open and how far along they are, for the hub dashboard and
// the daily reminder email (app/api/cron/merch).

/** Ticks for these checklist keys, from merch documents checklist/{key}. */
export async function loadTicks(keys: string[]): Promise<Record<string, Ticks>> {
  if (!keys.length) return {};
  const { data, error } = await createAdminClient("merch")
    .from("docs")
    .select("path, data")
    .eq("deleted", false)
    .in("path", keys.map((k) => "checklist/" + k));
  if (error) throw new Error("Couldn't read the checklists: " + error.message);
  return Object.fromEntries((data ?? []).map((d) => [d.path.slice("checklist/".length), (d.data as { items?: Ticks })?.items ?? {}]));
}

export interface OpenReport {
  period: Period;
  status: PeriodStatus;
  left: number;
}

/** Every open checklist and where it stands today. */
export async function reportStatus(today: string): Promise<OpenReport[]> {
  const periods = openPeriods(today);
  const ticks = await loadTicks(periods.map((p) => p.key));
  return periods.map((p) => ({ period: p, status: periodStatus(p, ticks[p.key], today), left: remaining(p, ticks[p.key]).length }));
}

/** Everyone who can open the Merchandise Program: its members and the super admins. */
export async function merchPeople(): Promise<{ email: string; name: string }[]> {
  const hub = createHubClient();
  const [{ data: people, error: e1 }, { data: access, error: e2 }] = await Promise.all([
    hub.from("people").select("email, name, super_admin, active").eq("active", true),
    hub.from("access").select("email").eq("app", "merch"),
  ]);
  if (e1 || e2) throw new Error("Couldn't read who has the Merchandise Program.");
  const members = new Set((access ?? []).map((a) => a.email));
  return (people ?? []).filter((p) => p.super_admin || members.has(p.email)).map((p) => ({ email: p.email, name: p.name }));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function when(p: Period, status: PeriodStatus, today: string): string {
  if (status === "overdue") return `overdue — was due ${shortDate(p.due)}`;
  if (p.due === today) return "due today";
  return `due ${shortDate(p.due)}`;
}

/** The reminder email: one section per checklist, listing what's still to do. */
export function reminderEmail(
  today: string,
  due: { period: Period; status: PeriodStatus; left: ReportItem[] }[],
  link: string,
): { subject: string; text: string; html: string } {
  // What's due today first, then what's late, then what's coming.
  const rank = (d: (typeof due)[number]) => (d.period.due === today ? 0 : d.status === "overdue" ? 1 : 2);
  due = [...due].sort((a, b) => rank(a) - rank(b));
  const subject = `Pro Shop reports: ${due.map((d) => `${d.period.label} ${d.status === "overdue" ? "overdue" : d.period.due === today ? "due today" : `due ${shortDate(d.period.due)}`}`).join(" · ")}`;
  const skuToday = due.some((d) => d.period.cadence === "monthly" && d.period.due === today && d.left.some((i) => i.k === "sku"));
  const note = skuToday ? "Run the SKU Analysis today: on-hand can't be recreated later." : "";
  const text = [
    note,
    ...due.map((d) => [`${d.period.label} (${when(d.period, d.status, today)}), ${d.left.length} left:`, ...d.left.map((i) => `  [ ] ${i.t} — ${i.d}`)].join("\n")),
    `Tick them off on the Reports tab: ${link}`,
    "You get this because you have access to the Merchandise Program.",
  ].filter(Boolean).join("\n\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#1d2a24;max-width:620px">
${note ? `<p style="background:#fbecea;border-left:4px solid #A4402C;padding:8px 12px;margin:0 0 14px"><b>${esc(note)}</b></p>` : ""}
${due.map((d) => `<h3 style="margin:16px 0 4px;font-size:15px">${esc(d.period.label)} <span style="font-weight:normal;color:${d.status === "overdue" ? "#A4402C" : "#5c6b63"}">· ${esc(when(d.period, d.status, today))}, ${d.left.length} left</span></h3>
<ul style="margin:4px 0 0;padding-left:20px">${d.left.map((i) => `<li style="margin:3px 0"><b>${esc(i.t)}</b><br><span style="color:#5c6b63">${esc(i.d)}</span></li>`).join("")}</ul>`).join("\n")}
<p style="margin:20px 0"><a href="${esc(link)}" style="background:#2E6B4F;color:#fff;padding:9px 16px;border-radius:4px;text-decoration:none;font-weight:bold">Open the Reports tab</a></p>
<p style="color:#8a958f;font-size:12px">You get this because you have access to the Merchandise Program.</p></div>`;
  return { subject, text, html };
}
