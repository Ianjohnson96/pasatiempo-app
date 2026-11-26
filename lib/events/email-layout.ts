// The look of every sign-up email, as HTML that email programs render well
// (Outlook, Gmail, Apple Mail) and a plain-text copy that reads the same.
//
// Email HTML is not web HTML: no stylesheets or classes (many programs strip
// them), so every style is inline; layout is tables, 600px wide; fonts fall
// back to ones every computer has; nothing depends on images. Everything that
// comes from a person (names, answers, the organisers' words, links) is escaped.

import type { Mail } from "../mail";

export interface EmailDoc {
  to: string;
  subject: string;
  preheader: string; // the grey preview line inboxes show after the subject
  status: "confirmed" | "waitlist";
  greeting: string; // "Hi Pat,"
  heading: string; // the event's title
  intro: string; // "You're registered for …", or the event's own opening line
  details: { label: string; lines: string[] }[]; // When / Where / Party / Team
  note?: string; // e.g. "Pat entered this team for you."
  sections: { title: string; rows: { label: string; value: string }[] }[];
  message?: string; // the organisers' message (may have line breaks)
  signOff?: string;
  manage: { url: string; verb: "change or cancel" | "change or withdraw" } | null;
  contact: { name: string; email: string };
}

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

export function renderEmail(d: EmailDoc): Mail {
  return { to: d.to, subject: d.subject, text: renderText(d), html: renderHtml(d) };
}

// ---- Plain text ------------------------------------------------------------

function renderText(d: EmailDoc): string {
  const out: string[] = [d.greeting, "", d.intro, ""];
  for (const det of d.details) {
    if (det.lines.length === 1) out.push(`${det.label}: ${det.lines[0]}`);
    else out.push(`${det.label}:`, ...det.lines.map((l) => `  ${l}`));
  }
  if (d.note) out.push(d.note);
  for (const s of d.sections) {
    if (s.rows.length === 0) continue;
    out.push("", s.title.toUpperCase(), ...s.rows.map((r) => labelled(r.label, r.value)));
  }
  if (d.message) out.push("", d.message);
  if (d.signOff) out.push("", d.signOff);
  if (d.manage)
    out.push("", `To ${d.manage.verb}, open ${d.manage.url} and choose "Manage my registration".`);
  out.push("", `Questions? Contact ${d.contact.name} at ${d.contact.email}.`);
  return out.join("\n");
}

// ---- HTML --------------------------------------------------------------------

const C = {
  page: "#f5f1e6",
  card: "#fbf8f1",
  club: "#173a2a",
  brass: "#a2814a",
  brassInk: "#7d6332",
  ink: "#1b201d",
  muted: "#5b635d",
  line: "#ddd4c0",
  ivory: "#f5f1e6",
  waitBg: "#faf3e2",
  waitInk: "#5e3f0f",
  okBg: "#e9efe8",
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Escaped text with its line breaks kept. */
const lines = (s: string) => esc(s).replace(/\n/g, "<br>");

function renderHtml(d: EmailDoc): string {
  const waitlist = d.status === "waitlist";
  const banner = waitlist ? "You're on the waitlist" : "You're registered";

  const detailRows = d.details
    .map(
      (det) => `
<tr>
  <td valign="top" style="padding:8px 12px 8px 0;width:96px;font:600 11px/1.6 ${SANS};letter-spacing:1.5px;text-transform:uppercase;color:${C.brassInk};">${esc(det.label)}</td>
  <td valign="top" style="padding:8px 0;font:15px/1.5 ${SANS};color:${C.ink};">${det.lines.map(esc).join("<br>")}</td>
</tr>`,
    )
    .join("");

  const sections = d.sections
    .filter((s) => s.rows.length > 0)
    .map(
      (s) => `
<tr><td style="padding:24px 32px 0;">
  <p style="margin:0 0 8px;font:600 11px/1.4 ${SANS};letter-spacing:1.5px;text-transform:uppercase;color:${C.brassInk};">${esc(s.title)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
    ${s.rows
      .map(
        (r) => `
    <tr>
      <td valign="top" style="padding:7px 12px 7px 0;border-top:1px solid ${C.line};font:14px/1.45 ${SANS};color:${C.muted};width:45%;">${esc(r.label)}</td>
      <td valign="top" style="padding:7px 0;border-top:1px solid ${C.line};font:500 14px/1.45 ${SANS};color:${C.ink};">${esc(r.value)}</td>
    </tr>`,
      )
      .join("")}
  </table>
</td></tr>`,
    )
    .join("");

  const message = d.message
    ? `
<tr><td style="padding:24px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:14px 18px;border-left:3px solid ${C.brass};background:${C.page};font:italic 16px/1.55 ${SERIF};color:${C.ink};">${lines(d.message)}</td></tr>
  </table>
</td></tr>`
    : "";

  const signOff = d.signOff
    ? `
<tr><td style="padding:18px 32px 0;font:15px/1.5 ${SERIF};color:${C.ink};">${lines(d.signOff)}</td></tr>`
    : "";

  const button = d.manage
    ? `
<tr><td style="padding:28px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr><td bgcolor="${C.club}" style="background:${C.club};border-radius:2px;">
      <a href="${esc(d.manage.url)}" target="_blank" style="display:inline-block;padding:13px 26px;font:600 13px/1 ${SANS};letter-spacing:1.5px;text-transform:uppercase;color:${C.ivory};text-decoration:none;">Manage my registration</a>
    </td></tr>
  </table>
  <p style="margin:10px 0 0;font:13px/1.5 ${SANS};color:${C.muted};">To ${esc(d.manage.verb)}, use the button above, or open <a href="${esc(d.manage.url)}" target="_blank" style="color:${C.club};">${esc(d.manage.url)}</a>.</p>
</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(d.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">${esc(d.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${C.card};border:1px solid ${C.line};">

<tr><td bgcolor="${C.club}" style="background:${C.club};padding:18px 32px;font:600 11px/1.4 ${SANS};letter-spacing:3px;text-transform:uppercase;color:${C.ivory};">Pasatiempo Golf Club</td></tr>

<tr><td style="padding:28px 32px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${waitlist ? C.waitBg : C.okBg}" style="background:${waitlist ? C.waitBg : C.okBg};padding:6px 12px;border-radius:2px;font:600 11px/1.4 ${SANS};letter-spacing:1.5px;text-transform:uppercase;color:${waitlist ? C.waitInk : C.club};">${esc(banner)}</td>
  </tr></table>
  <h1 style="margin:16px 0 0;font:500 28px/1.2 ${SERIF};color:${C.club};">${esc(d.heading)}</h1>
</td></tr>

<tr><td style="padding:20px 32px 0;font:15px/1.6 ${SANS};color:${C.ink};">
  <p style="margin:0 0 10px;">${esc(d.greeting)}</p>
  <p style="margin:0;">${lines(d.intro)}</p>
</td></tr>

<tr><td style="padding:20px 32px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid ${C.brass};border-bottom:1px solid ${C.line};">
    ${detailRows}
  </table>
  ${d.note ? `<p style="margin:10px 0 0;font:14px/1.5 ${SANS};color:${C.muted};">${esc(d.note)}</p>` : ""}
</td></tr>
${sections}${message}${signOff}${button}

<tr><td style="padding:32px 32px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.line};"><tr>
    <td style="padding-top:16px;font:14px/1.6 ${SANS};color:${C.muted};">Questions? Contact ${esc(d.contact.name)} at <a href="mailto:${esc(d.contact.email)}" style="color:${C.club};">${esc(d.contact.email)}</a>.</td>
  </tr></table>
</td></tr>

</table>
<p style="margin:16px 0 0;font:italic 13px/1.5 ${SERIF};color:${C.muted};">Pasatiempo Golf Club · Est. 1929</p>
</td></tr>
</table>
</body>
</html>`;
}
