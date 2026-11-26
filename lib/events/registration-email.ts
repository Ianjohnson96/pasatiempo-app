// The confirmation email for a dinner, clinic or other sign-up, and the
// ending every sign-up email shares (the event's own message, how to change
// it, who to ask). Pure: sending is done in actions.ts.

import type { Mail } from "../mail";
import { answerText, formatSlot, formatWhen } from "./format";
import { pageSettings } from "./page-settings";
import { eventContact } from "./theme";
import type { Answers, EventRec } from "./types";

export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Text lines as an email: plain text, and the same lines as simple HTML. */
export function linesToMail(to: string, subject: string, lines: string[]): Mail {
  const html = `<div>${lines
    .map((l) => (l === "" ? "<br>" : `<p style="margin:0">${esc(l)}</p>`))
    .join("")}</div>`;
  return { to, subject, text: lines.join("\n"), html };
}

/** The end of every sign-up email: the organisers' note, the change link, the contact. */
export function closingLines(
  event: EventRec,
  status: "confirmed" | "waitlist",
  pageUrl: string | null,
  change: "change or cancel" | "change or withdraw",
): string[] {
  const out: string[] = [];
  const { thankYou } = pageSettings(event);
  if (thankYou && status === "confirmed") out.push("", ...thankYou.split("\n"));
  if (pageUrl) out.push("", `To ${change}, open ${pageUrl} and choose "Manage my registration".`);
  const c = eventContact(event);
  out.push("", `Questions? Contact ${c.name} at ${c.email}.`);
  return out;
}

export interface SignupDetails {
  name: string;
  email: string;
  partySize: number;
  guestNames: string[];
  slotIds: string[];
  answers: Answers;
}

export function signupEmail(
  event: EventRec,
  reg: SignupDetails,
  status: "confirmed" | "waitlist",
  pageUrl: string | null,
): Mail {
  const subject =
    status === "waitlist"
      ? `${event.title}: you're on the waitlist`
      : `${event.title}: you're registered`;
  const first = reg.name.trim().split(/\s+/)[0] || reg.name;
  const lines: string[] = [
    `Hi ${first},`,
    "",
    status === "waitlist"
      ? `You're on the waitlist for ${event.title}. We'll be in touch if a spot opens.`
      : `You're registered for ${event.title}.`,
    "",
  ];

  if (event.scheduleMode === "slots") {
    const dates = event.slots.filter((s) => reg.slotIds.includes(s.id)).map(formatSlot);
    lines.push(dates.length === 1 ? `When: ${dates[0]}` : "When:", ...(dates.length > 1 ? dates.map((d) => `  ${d}`) : []));
  } else if (event.startsAt) {
    lines.push(`When: ${formatWhen(event.startsAt, event.endsAt)}`);
  }
  if (event.location) lines.push(`Where: ${event.location}`);
  if (reg.partySize > 1) {
    const guests = reg.guestNames.filter((g) => g.trim());
    lines.push(
      guests.length
        ? `Party of ${reg.partySize}: you and ${guests.join(", ")}`
        : `Party of ${reg.partySize}`,
    );
  }

  const answers = event.customFields
    .map((f) => ({ label: f.label, value: answerText(reg.answers[f.id]) }))
    .filter((a) => a.value.trim() !== "")
    .map((a) => `${a.label}: ${a.value}`);
  if (answers.length) lines.push("", ...answers);

  lines.push(...closingLines(event, status, pageUrl, "change or cancel"));
  return linesToMail(reg.email, subject, lines);
}
