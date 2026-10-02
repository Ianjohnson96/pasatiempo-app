// Links that hand a client's number or address to the phone's own apps.
//
// Nothing is ever sent from the server: tapping Text opens Messages with the
// words filled in, and Ian presses send from his own number.

function dialable(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const plus = phone.trim().startsWith("+") ? "+" : "";
  const digits = phone.replace(/\D/g, "");
  // Seven digits is the shortest number worth dialling.
  return digits.length >= 7 ? plus + digits : null;
}

export function telHref(phone: string | null | undefined): string | null {
  const n = dialable(phone);
  return n ? `tel:${n}` : null;
}

/** "?&body=" is the one form both iOS and Android Messages accept. */
export function smsHref(
  phone: string | null | undefined,
  body: string,
): string | null {
  const n = dialable(phone);
  return n ? `sms:${n}?&body=${encodeURIComponent(body)}` : null;
}

export function mailHref(email: string | null | undefined): string | null {
  const e = email?.trim();
  return e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? `mailto:${e}` : null;
}

export function firstName(name: string): string {
  const f = name.trim().split(/\s+/)[0] ?? "";
  return f ? f[0].toUpperCase() + f.slice(1) : "";
}

/** The nudge for a client on their last lesson. Editable before sending. */
export function nextPackageText(name: string, size: number): string {
  return `Hi ${firstName(name)}, you've got one lesson left in your package. Want me to set up the next ${size}?`;
}
