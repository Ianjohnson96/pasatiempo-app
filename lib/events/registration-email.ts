// The confirmation email for a dinner, clinic or other sign-up, and the
// parts every sign-up email shares (the event's own message, how to change
// it, who to ask). Pure: sending is done in actions.ts. The look is
// email-layout.ts.

import type { Mail } from "../mail";
import { esc, renderEmail, type EmailDoc } from "./email-layout";
import { formatSlot, formatWhen, shownAnswer } from "./format";
import { pageSettings } from "./page-settings";
import { eventContact } from "./theme";
import { teamEmails } from "./tournament-email";
import type { Answers, CustomField, EventRec } from "./types";

export { esc, labelled } from "./email-layout";

/** The end every sign-up email shares: the organisers' words, the change link, the contact. */
export function closingParts(
  event: EventRec,
  status: "confirmed" | "waitlist",
  pageUrl: string | null,
  verb: "change or cancel" | "change or withdraw",
): Pick<EmailDoc, "message" | "signOff" | "manage" | "contact"> {
  const { thankYou, email } = pageSettings(event);
  const confirmed = status === "confirmed";
  return {
    message: confirmed ? (thankYou ?? undefined) : undefined,
    signOff: confirmed ? (email.signOff ?? undefined) : undefined,
    manage: pageUrl ? { url: pageUrl, verb } : null,
    contact: eventContact(event),
  };
}

/** Answered questions as label/value rows; a yes/no box reads Yes or No. */
export function answerRows(fields: CustomField[], answers: Answers): { label: string; value: string }[] {
  return fields
    .map((f) => ({ label: f.label, value: shownAnswer(f, answers[f.id]) }))
    .filter((r) => r.value.trim() !== "");
}

/** "Hi Pat," from a full name. */
export const greetingFor = (name: string) => `Hi ${name.trim().split(/\s+/)[0] || name.trim()},`;

/** The inbox preview line: when and where. */
export function preheaderFor(event: EventRec, when: string | undefined): string {
  return [when, event.location].filter(Boolean).join(" · ");
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
  const waitlist = status === "waitlist";
  const details: EmailDoc["details"] = [];

  if (event.scheduleMode === "slots") {
    const dates = event.slots.filter((s) => reg.slotIds.includes(s.id)).map(formatSlot);
    if (dates.length) details.push({ label: "When", lines: dates });
  } else if (event.startsAt) {
    details.push({ label: "When", lines: [formatWhen(event.startsAt, event.endsAt)] });
  }
  if (event.location) details.push({ label: "Where", lines: [event.location] });
  if (reg.partySize > 1) {
    const guests = reg.guestNames.filter((g) => g.trim());
    details.push(
      guests.length
        ? { label: `Party of ${reg.partySize}`, lines: [`you and ${guests.join(", ")}`] }
        : { label: "Party", lines: [`${reg.partySize} people`] },
    );
  }

  return renderEmail({
    to: reg.email,
    subject: waitlist
      ? `${event.title}: you're on the waitlist`
      : (own.subject ?? `${event.title}: you're registered`),
    preheader: preheaderFor(event, details[0]?.label === "When" ? details[0].lines[0] : undefined),
    status,
    greeting: greetingFor(reg.name),
    heading: event.title,
    intro: waitlist
      ? `You're on the waitlist for ${event.title}. We'll be in touch if a spot opens.`
      : (own.intro ?? `You're registered for ${event.title}.`),
    details,
    sections: [{ title: "Your answers", rows: answerRows(event.customFields, reg.answers) }],
    ...closingParts(event, status, pageUrl, "change or cancel"),
  });
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

const TEST_NOTE =
  "This is a test of the confirmation email, sent to you from the event editor. " +
  "Members get the same email with their own details.";

/** A sample email readdressed to a staff member and marked as a test. */
export function testEmail(mail: Mail, to: string): Mail {
  return {
    to,
    subject: `[Test] ${mail.subject}`,
    text: `${TEST_NOTE}\n\n${mail.text}`,
    // the note goes just inside <body>, so the email stays a valid document
    html: mail.html.replace(
      /<body[^>]*>/,
      (body) =>
        `${body}
<div style="margin:0;padding:10px 16px;background:#faf3e2;border-bottom:1px solid #e6d4ad;font:14px/1.5 Helvetica, Arial, sans-serif;color:#5e3f0f;">${esc(TEST_NOTE)}</div>`,
    ),
  };
}
