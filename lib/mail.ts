import nodemailer, { type Transporter } from "nodemailer";
import { accessToken } from "./lessons/graph";

// Outgoing email for the app's own messages (event confirmations, caddie
// alerts, report reminders). Two ways to send, whichever is set up:
//
// 1. Microsoft 365, through the app login the lessons sync already uses
//    (MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET) plus the mailbox to send
//    from. No mailbox password is stored. The app registration needs the
//    Mail.Send APPLICATION permission with admin consent; narrow it to this
//    mailbox with an Exchange application access policy.
//      MAIL_SENDER=ijohnson@pasatiempo.com
//    Each message is saved in that mailbox's Sent Items.
//
// 2. An SMTP mailbox (as Supabase uses for password resets):
//      SMTP_HOST=smtp.office365.com  SMTP_PORT=587  SMTP_USER=…  SMTP_PASS=…
//      MAIL_FROM="Pasatiempo Pro Shop <noreply@pasatiempo.com>"
//
// With neither, nothing is sent, and callers say so.

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function mailRoute(): "graph" | "smtp" | null {
  const env = process.env;
  if (env.MAIL_SENDER && env.MS_TENANT_ID && env.MS_CLIENT_ID && env.MS_CLIENT_SECRET) return "graph";
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) return "smtp";
  return null;
}

export function mailConfigured(): boolean {
  return mailRoute() !== null;
}

// ---- Microsoft 365 (Graph sendMail) --------------------------------------------

/** "Pat Smith" <pat@x.com> or pat@x.com, as a Graph recipient. */
function recipient(to: string): { emailAddress: { name?: string; address: string } } {
  const m = to.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { emailAddress: { name: m[1].trim(), address: m[2].trim() } };
  return { emailAddress: { address: to.trim() } };
}

/** The request body for Graph's /users/{sender}/sendMail. */
export function graphMessage(m: Mail) {
  return {
    message: {
      subject: m.subject,
      body: m.html ? { contentType: "HTML", content: m.html } : { contentType: "Text", content: m.text },
      toRecipients: [recipient(m.to)],
    },
    saveToSentItems: true,
  };
}

async function sendViaGraph(m: Mail): Promise<void> {
  const token = await accessToken();
  const sender = encodeURIComponent(process.env.MAIL_SENDER!.trim());
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(graphMessage(m)),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000), // a slow Microsoft must not stall a registration
  });
  if (res.ok) return;
  // Microsoft's own code says what to fix (e.g. ErrorAccessDenied = Mail.Send
  // not granted, or the access policy doesn't include this mailbox).
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    detail = [body.error?.code, body.error?.message?.slice(0, 160)].filter(Boolean).join(": ");
  } catch {
    // no JSON body
  }
  throw new Error(`Microsoft 365 refused the email (HTTP ${res.status})${detail ? ` — ${detail}` : ""}`);
}

// ---- SMTP ------------------------------------------------------------------------

let transport: Transporter | null = null;

function transporter(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 587 upgrades with STARTTLS
      requireTLS: port === 587, // the usual submission port: refuse to send the password unencrypted
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // A hung SMTP server must not stall a registration for minutes.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transport;
}

/** Send one message. Returns an error message, or null when it went. */
export async function sendMail(m: Mail): Promise<string | null> {
  const route = mailRoute();
  if (!route) return "Email isn't set up.";
  try {
    if (route === "graph") await sendViaGraph(m);
    else await transporter().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...m });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
