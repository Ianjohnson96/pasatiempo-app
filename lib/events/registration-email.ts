// The confirmation email for a dinner, clinic or other sign-up, and the
// ending every sign-up email shares (the event's own message, how to change
// it, who to ask). Pure: sending is done in actions.ts.

import type { Mail } from "../mail";
import { answerText, formatSlot, formatWhen } from "./format";
import { pageSettings } from "./page-settings";
import { eventContact } from "./theme";
import { teamEmails } from "./tournament-email";
import type { Answers, EventRec } from "./types";

export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** "Label: answer", without a second mark after a question ("Coming? Yes"). */
export function labelled(label: string, value: string): string {
  const l = label.trim();
  return /[?:]$/.test(l) ? `${l} ${value}` : `${l}: ${value}`;
}

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
  const { thankYou, email } = pageSettings(event);
  if (status === "confirmed") {
    if (thankYou) out.push("", ...thankYou.split("\n"));
    if (email.signOff) out.push("", ...email.signOff.split("\n"));
  }
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
  const own = pageSettings(event).email;
  const subject =
    status === "waitlist"
      ? `${event.title}: you're on the waitlist`
      : (own.subject ?? `${event.title}: you're registered`);
  const first = reg.name.trim().split(/\s+/)[0] || reg.name;
  const lines: string[] = [
    `Hi ${first},`,
    "",
    status === "waitlist"
      ? `You're on the waitlist for ${event.title}. We'll be in touch if a spot opens.`
      : (own.intro ?? `You're registered for ${event.title}.`),
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
    .map((a) => labelled(a.label, a.value));
  if (answers.length) lines.push("", ...answers);

  lines.push(...closingLines(event, status, pageUrl, "change or cancel"));
  return linesToMail(reg.email, subject, lines);
}

/**
 * The confirmation email as a sample member would get it, for the editor's
 * preview: the real email, built from made-up details.
 */
export function sampleEmail(event: EventRec, pageUrl: string | null): Mail {
  const answers: Answers = {};
  for (const f of event.customFields) answers[f.id] = "(their answer)";
  if (event.type === "tournament") {
    const player = (role: "member" | "guest", name: string) => ({
      role,
      name,
      email: `${name.split(" ")[0].toLowerCase()}@example.com`,
      ghin: "1234567",
      answers,
    });
    return teamEmails(
      event,
      [player("member", "Pat Member"), player("guest", "Sam Guest")],
      answers,
      "confirmed",
      pageUrl,
    )[0];
  }
  const guests = event.allowGuests ? ["Lee Guest"] : [];
  return signupEmail(
    event,
    {
      name: "Pat Member",
      email: "pat@example.com",
      partySize: 1 + guests.length,
      guestNames: guests,
      slotIds: event.slots.slice(0, 1).map((s) => s.id),
      answers,
    },
    "confirmed",
    pageUrl,
  );
}
