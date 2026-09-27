import nodemailer, { type Transporter } from "nodemailer";

// Outgoing email for the app's own messages (report reminders). It uses the
// same kind of SMTP mailbox Supabase sends password resets through
// (supabase/auth-email-setup.md), e.g. noreply@pasatiempo.com on Microsoft 365:
//
//   SMTP_HOST=smtp.office365.com  SMTP_PORT=587  SMTP_USER=noreply@pasatiempo.com
//   SMTP_PASS=…  MAIL_FROM="Pasatiempo Pro Shop <noreply@pasatiempo.com>"
//
// Without SMTP_HOST, SMTP_USER and SMTP_PASS nothing is sent, and callers say so.

let transport: Transporter | null = null;

export function mailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter(): Transporter {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 587 upgrades with STARTTLS
      requireTLS: port === 587, // the usual submission port: refuse to send the password unencrypted
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Send one message. Returns an error message, or null when it went. */
export async function sendMail(m: Mail): Promise<string | null> {
  if (!mailConfigured()) return "Email isn't set up.";
  try {
    await transporter().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, ...m });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
