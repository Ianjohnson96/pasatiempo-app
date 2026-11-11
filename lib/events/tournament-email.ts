// Builds the two confirmation emails for a tournament team. Pure: sending is
// done elsewhere. Each email carries only the recipient's own personal details
// (never the partner's email or GHIN).

import type { Mail } from "../mail";
import { answerText, formatWhen } from "./format";
import type { Answers, EventRec, Player } from "./types";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function answerLines(
  event: EventRec,
  scope: "player" | "team",
  answers: Answers,
): string[] {
  const lines: string[] = [];
  for (const f of event.customFields) {
    if (f.scope !== scope) continue;
    const v = answerText(answers[f.id]);
    if (v.trim() === "") continue;
    lines.push(`${f.label}: ${v}`);
  }
  return lines;
}

function buildOne(
  event: EventRec,
  recipient: Player,
  member: Player,
  guest: Player,
  teamAnswers: Answers,
  status: "confirmed" | "waitlist",
): Mail {
  const subject =
    status === "waitlist"
      ? `${event.title}: you're on the waitlist`
      : `${event.title}: your team entry`;
  const statusLine =
    status === "waitlist"
      ? "Your team is on the waitlist; we'll be in touch if a spot opens."
      : "Your team is confirmed.";

  const lines: string[] = [event.title, formatWhen(event.startsAt, event.endsAt)];
  if (event.location) lines.push(event.location);
  lines.push("", `Team: ${member.name} & ${guest.name}`);
  if (recipient.role === "guest") {
    lines.push(`${member.name} entered this team for you.`);
  }
  const own = answerLines(event, "player", recipient.answers);
  const team = answerLines(event, "team", teamAnswers);
  if (own.length || team.length) lines.push("", ...own, ...team);
  lines.push("", statusLine, "", "Questions? Contact the golf shop.");

  const text = lines.join("\n");
  const html = `<div>${lines
    .map((l) => (l === "" ? "<br>" : `<p style="margin:0">${esc(l)}</p>`))
    .join("")}</div>`;

  return { to: recipient.email, subject, text, html };
}

export function teamEmails(
  event: EventRec,
  players: Player[],
  teamAnswers: Answers,
  status: "confirmed" | "waitlist",
): Mail[] {
  const member = players.find((p) => p.role === "member") ?? players[0];
  const guest = players.find((p) => p.role === "guest") ?? players[1];
  return [
    buildOne(event, member, member, guest, teamAnswers, status),
    buildOne(event, guest, member, guest, teamAnswers, status),
  ];
}
