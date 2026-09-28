import { createHmac, timingSafeEqual } from "node:crypto";

// The pure half of texting: reading a reply, writing a text that is cheap to
// send, and checking that a webhook really came from Twilio. No network and no
// database here, so every rule can be tested without either.

export type ReplyIntent = "accept" | "decline" | "stop" | "start" | "help" | "unknown";

// The carrier keywords. Twilio acts on these itself — it stops sending after
// STOP whatever this app thinks — so the app's job is only to agree with it.
const STOP_WORDS = new Set([
  "STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT",
]);
const START_WORDS = new Set(["START", "UNSTOP"]);
const HELP_WORDS = new Set(["HELP", "INFO"]);

// YES is deliberately not the prompt: Twilio treats YES as an opt-in keyword
// and may answer it with its own "you are resubscribed" text. Y is not a
// keyword, so the prompt asks for Y and N, and the fuller words still work.
const ACCEPT_WORDS = new Set(["Y", "YES", "YEP", "YEAH", "TAKE", "ACCEPT", "OK", "OKAY", "1"]);
const DECLINE_WORDS = new Set(["N", "NO", "NOPE", "PASS", "DECLINE", "2"]);

/** What a reply means. Only the first word counts: "Y see you there" is a yes. */
export function parseReply(body: string | null | undefined): ReplyIntent {
  const first = (body ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)[0] ?? "";
  if (!first) return "unknown";
  if (STOP_WORDS.has(first)) return "stop";
  if (START_WORDS.has(first)) return "start";
  if (HELP_WORDS.has(first)) return "help";
  if (ACCEPT_WORDS.has(first)) return "accept";
  if (DECLINE_WORDS.has(first)) return "decline";
  return "unknown";
}

/**
 * Keep a text inside the plain GSM alphabet.
 *
 * One em dash or curly quote switches the whole message to UCS-2, which cuts a
 * segment from 160 characters to 70 — the same offer then bills as three texts
 * instead of one. The app's notification copy uses those characters freely, so
 * they are swapped here rather than policed at every call site.
 */
export function toGsm(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[·•]/g, "|")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * The text a caddie receives.
 *
 * Every message names the sender — the carriers require it, and a caddie with
 * three golf clubs in their phone needs it. An offer ends with how to answer.
 */
export function composeText(opts: {
  title: string;
  body: string;
  link?: string | null;
  reply?: boolean;
}): string {
  // "Tap to accept" is push copy; on a text it is the reply line's job.
  const body = opts.body
    .replace(/\s*Tap to accept or decline\.?/gi, "")
    .replace(/\n+/g, " - ")
    .trim();
  const parts = [`Pasatiempo Caddies: ${opts.title}`, body];
  if (opts.reply) parts.push("Reply Y to take it or N to pass.");
  if (opts.link) parts.push(opts.link);
  return toGsm(parts.join("\n"));
}

/**
 * Twilio's request signature: HMAC-SHA1 over the full URL followed by every
 * POST parameter, sorted by name, as name+value with no separators. Base64.
 */
export function twilioSignature(
  url: string,
  params: Record<string, string>,
  authToken: string,
): string {
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

/** Constant-time check of the X-Twilio-Signature header. */
export function signatureMatches(
  url: string,
  params: Record<string, string>,
  authToken: string,
  header: string | null,
): boolean {
  if (!header || !authToken) return false;
  const want = Buffer.from(twilioSignature(url, params, authToken));
  const got = Buffer.from(header);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Escape text for a TwiML <Message>. */
export function twiml(message?: string | null): string {
  if (!message) return '<?xml version="1.0" encoding="UTF-8"?><Response/>';
  const safe = toGsm(message)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}
