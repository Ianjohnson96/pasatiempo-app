// Builds the two confirmation emails for a tournament team. Pure: sending is
// done elsewhere; the look is email-layout.ts. Each email carries only the
// recipient's own personal details (never the partner's email or GHIN).

import type { Mail } from "../mail";
import { renderEmail } from "./email-layout";
import { formatWhen } from "./format";
import { pageSettings } from "./page-settings";
import { answerRows, closingParts, greetingFor, preheaderFor } from "./registration-email";
import type { Answers, EventRec, Player } from "./types";

function buildOne(
  event: EventRec,
  recipient: Player,
  member: Player,
  guest: Player,
  teamAnswers: Answers,
  status: "confirmed" | "waitlist",
  pageUrl: string | null,
): Mail {
  const words = pageSettings(event).email;
  const waitlist = status === "waitlist";
  const when = event.startsAt ? formatWhen(event.startsAt, event.endsAt) : undefined;
  const details = [
    ...(when ? [{ label: "When", lines: [when] }] : []),
    ...(event.location ? [{ label: "Where", lines: [event.location] }] : []),
    { label: "Team", lines: [`${member.name} & ${guest.name}`] },
  ];
  const yours = [
    ...(recipient.ghin.trim() ? [{ label: "Your GHIN #", value: recipient.ghin.trim() }] : []),
    ...answerRows(
      event.customFields.filter((f) => f.scope === "player"),
      recipient.answers,
    ),
  ];
  const team = answerRows(
    event.customFields.filter((f) => f.scope === "team"),
    teamAnswers,
  );

  return renderEmail({
    to: recipient.email,
    subject: waitlist
      ? `${event.title}: you're on the waitlist`
      : (words.subject ?? `${event.title}: your team entry`),
    preheader: preheaderFor(event, when),
    status,
    greeting: greetingFor(recipient.name),
    heading: event.title,
    intro: waitlist
      ? "Your team is on the waitlist; we'll be in touch if a spot opens."
      : (words.intro ?? "Your team is confirmed."),
    details,
    note: recipient.role === "guest" ? `${member.name} entered this team for you.` : undefined,
    sections: [
      { title: "Your details", rows: yours },
      { title: "Team answers", rows: team },
    ],
    ...closingParts(event, status, pageUrl, "change or withdraw"),
  });
}

export function teamEmails(
  event: EventRec,
  players: Player[],
  teamAnswers: Answers,
  status: "confirmed" | "waitlist",
  pageUrl: string | null = null,
): Mail[] {
  const member = players.find((p) => p.role === "member") ?? players[0];
  const guest = players.find((p) => p.role === "guest") ?? players[1];
  return [
    buildOne(event, member, member, guest, teamAnswers, status, pageUrl),
    buildOne(event, guest, member, guest, teamAnswers, status, pageUrl),
  ];
}
