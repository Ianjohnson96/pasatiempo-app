// Which origin an invite link gets built from.
//
// An invite link is minted once, printed on a handout or texted, and then
// opened on somebody else's phone days later. A link pointing at the machine
// that made it is not visibly broken when it is created — it breaks later, in
// a caddie's hand, which is the worst possible moment to find out.
//
// So a configured origin is treated as a suggestion rather than an order: it
// wins when it is plausible, and loses to the request's own host when it
// plainly is not.

/** The hostname from a Host header, minus the port and any IPv6 brackets. */
export function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase();
  if (!h) return "";

  // [::1]:3000 — the brackets exist precisely because the address is full of
  // colons, so the port cannot be found by scanning for one.
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end === -1 ? h.slice(1) : h.slice(1, end);
  }

  const colon = h.lastIndexOf(":");
  if (colon !== -1 && /^\d+$/.test(h.slice(colon + 1))) return h.slice(0, colon);
  return h;
}

/** Hosts that only mean anything on the machine that served the request. */
export function isLoopback(host: string): boolean {
  const name = hostnameOf(host);
  return (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name === "::1" ||
    name === "0.0.0.0" ||
    /^127\./.test(name)
  );
}

/**
 * Pick the origin to build absolute links from.
 *
 * Split out of the server action so it can be tested without a request: the
 * failure this guards against only shows up in production, which is the one
 * place it must not be discovered.
 */
export function resolveOrigin(opts: {
  configured?: string | null;
  host?: string | null;
  proto?: string | null;
}): string {
  const host = opts.host?.trim() || "localhost:3000";
  const proto = opts.proto?.trim() || (isLoopback(host) ? "http" : "https");
  const fromRequest = `${proto}://${host}`;

  const configured = opts.configured?.trim().replace(/\/+$/, "");
  if (!configured) return fromRequest;

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    // Something that is not a URL cannot be repaired by using it anyway.
    return fromRequest;
  }

  // mailto:, file: and friends are not origins a phone can open.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fromRequest;
  }

  // The decisive case: the setting points at the machine running the app, but
  // the request came from somewhere else. That is a development value left in
  // a production environment, and honouring it mints links only the developer
  // can open — which is exactly how the first batch of caddie invites died.
  if (isLoopback(parsed.host) && !isLoopback(host)) return fromRequest;

  return configured;
}
