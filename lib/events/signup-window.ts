// When people can sign up for an event, and change or withdraw on their own,
// plus the event's other sign-up rules (stored together in events.rules).
//
// An event's status (draft / open / closed) is set by hand. On top of it an
// open event can carry dates: sign-ups open at `opensAt` and close at the entry
// deadline `closesAt`. Pure, so the page, the server actions and the editor
// agree, and every answer is relative to the `now` passed in.

import { CLUB_TIME_ZONE } from "./format";
import { eventContact } from "./theme";
import type { EventRec } from "./types";

export interface SignupRules {
  opensAt: string | null; // ISO; sign-ups open at this moment
  closesAt: string | null; // ISO; the entry deadline
  changesAfterClose: boolean; // members may still change or withdraw after the deadline (until the event starts)
  autoPromote: boolean; // when a spot opens, the next waitlisted entry moves up on its own
}

type Ruled = Pick<EventRec, "status" | "rules" | "startsAt" | "contactName" | "contactEmail">;

const iso = (v: unknown): string | null =>
  typeof v === "string" && v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;

/** Stored rules, cleaned; null when nothing is set. */
export function parseRules(raw: unknown): SignupRules | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: SignupRules = {
    opensAt: iso(r.opensAt),
    closesAt: iso(r.closesAt),
    changesAfterClose: r.changesAfterClose === true,
    autoPromote: r.autoPromote === true,
  };
  return out.opensAt || out.closesAt || out.autoPromote ? out : null;
}

export type SignupPhase = "draft" | "closed" | "soon" | "open" | "deadline";

export function signupPhase(ev: Pick<Ruled, "status" | "rules">, now: Date): SignupPhase {
  if (ev.status !== "open") return ev.status;
  const r = ev.rules;
  if (r?.opensAt && now < new Date(r.opensAt)) return "soon";
  if (r?.closesAt && now >= new Date(r.closesAt)) return "deadline";
  return "open";
}

/** The event as the sign-up page should treat it now: not open outside its dates. */
export function liveEvent<T extends Pick<Ruled, "status" | "rules">>(ev: T, now: Date): T {
  const p = signupPhase(ev, now);
  return p === "soon" || p === "deadline" ? { ...ev, status: "closed" } : ev;
}

const day = (d: Date) =>
  d.toLocaleDateString("en-US", { timeZone: CLUB_TIME_ZONE, weekday: "short", month: "short", day: "numeric" });
const time = (d: Date) =>
  d.toLocaleTimeString("en-US", { timeZone: CLUB_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: CLUB_TIME_ZONE });
/** Whole calendar days (club time) from a to b. */
const daysBetween = (a: Date, b: Date) =>
  Math.round((Date.parse(dayKey(b)) - Date.parse(dayKey(a))) / 86_400_000);

export interface WindowNote {
  tone: "soon" | "open" | "last" | "closed";
  text: string;
}

/** One line about the sign-up dates for the page, or null when there's nothing to say. */
export function windowNote(ev: Pick<Ruled, "status" | "rules">, now: Date): WindowNote | null {
  const phase = signupPhase(ev, now);
  const r = ev.rules;
  if (phase === "soon" && r?.opensAt) {
    const o = new Date(r.opensAt);
    return { tone: "soon", text: `Sign-ups open ${day(o)} at ${time(o)}` };
  }
  if (phase === "deadline" && r?.closesAt)
    return { tone: "closed", text: `Sign-ups closed ${day(new Date(r.closesAt))}` };
  if (phase === "open" && r?.closesAt) {
    const c = new Date(r.closesAt);
    const days = daysBetween(now, c);
    if (days === 0) return { tone: "last", text: `Sign-ups close today at ${time(c)}` };
    if (days === 1) return { tone: "last", text: `Sign-ups close tomorrow at ${time(c)}` };
    const left = days <= 7 ? ` · ${days} days left` : "";
    return { tone: "open", text: `Sign-ups close ${day(c)} at ${time(c)}${left}` };
  }
  return null;
}

/** The deadline for the page's key facts. */
export function deadlineFact(ev: Pick<Ruled, "rules">): { k: string; v: string; sub: string } | null {
  const c = ev.rules?.closesAt;
  if (!c) return null;
  const d = new Date(c);
  return { k: "Entry deadline", v: day(d), sub: time(d) };
}

/**
 * Why a member can't change or withdraw on their own right now, or null when
 * they can. After the deadline that goes through the event's contact, unless
 * the event allows changes until it starts.
 */
export function selfServiceError(ev: Ruled, now: Date): string | null {
  const c = eventContact(ev);
  const who = `${c.name} at ${c.email}`;
  const phase = signupPhase(ev, now);
  if (phase === "open") return null;
  if (phase === "deadline") {
    const started = ev.startsAt != null && now >= new Date(ev.startsAt);
    if (ev.rules?.changesAfterClose && !started) return null;
    return `The entry deadline has passed — to change or withdraw, email ${who}.`;
  }
  if (phase === "soon") return null; // nobody can be signed up yet, unless staff added them
  return `This event is closed — to change or withdraw, email ${who}.`;
}

/** The editor's check on the two dates. */
export function windowError(r: { opensAt: string | null; closesAt: string | null }): string | null {
  if (r.opensAt && r.closesAt && new Date(r.closesAt) <= new Date(r.opensAt))
    return "The entry deadline must be after sign-ups open.";
  return null;
}
