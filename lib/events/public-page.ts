// Rules for the public sign-up page's hero button, sticky bar and facts strip.
// Pure, so the page, the editor preview and tests share one answer.

import type { SeatInfo } from "@/components/events/RegistrationForm";
import { pageSettings } from "./page-settings";
import { eventContact } from "./theme";
import type { EventRec } from "./types";

export type Cta =
  | { kind: "register"; label: string }
  | { kind: "waitlist"; label: "Join the waitlist" }
  | { kind: "contact"; name: string; email: string }
  | { kind: "none" };

/** What the page's main button should do. Never a dead, disabled button. */
export function ctaState(event: EventRec, seats: SeatInfo, rosterFull: boolean): Cta {
  if (event.status !== "open") return { kind: "none" };
  const full =
    event.scheduleMode === "slots"
      ? seats.slots.length > 0 && seats.slots.every((s) => s.full)
      : seats.full;
  if (rosterFull || (full && (!event.waitlistEnabled || event.type === "tournament"))) {
    return { kind: "contact", ...eventContact(event) };
  }
  if (full) return { kind: "waitlist", label: "Join the waitlist" };
  return { kind: "register", label: pageSettings(event).buttonLabel };
}

/**
 * The price shown with the key facts: the first pricing line, only when
 * pricing is turned on, split so the amount leads ("Team entry — $2,400" →
 * $2,400 over "Team entry"). Pricing off may mean "charged to your account",
 * so the page never claims an event is free.
 */
export function priceFact(event: EventRec): { amount: string; detail: string } | null {
  if (!event.pricingEnabled) return null;
  const line = event.pricing
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return null;
  const m = line.match(/^(.*\S)\s+[—–]\s+(\S.*)$/);
  return m ? { amount: m[2], detail: m[1] } : { amount: line, detail: "" };
}

export interface SectionLink {
  id: string; // the section's element id on the page
  label: string;
}

/**
 * Jump links for a long sign-up page, in page order: only the sections this
 * event shows, and none at all when there are fewer than three.
 */
export function sectionLinks(event: EventRec): SectionLink[] {
  const links: SectionLink[] = [];
  if (event.description) links.push({ id: "about", label: "About" });
  if (event.info) links.push({ id: "details", label: "Details" });
  if (event.pricingEnabled && event.pricing.trim()) links.push({ id: "pricing", label: "Pricing" });
  if (event.scheduleMode === "slots" && event.slots.length > 1)
    links.push({ id: "schedule", label: "Schedule" });
  if (event.photos.length > 1) links.push({ id: "photos", label: "Photos" });
  if (event.status === "open") links.push({ id: "register", label: "Register" });
  return links.length >= 3 ? links : [];
}

/** A map search for the event's location; the club's town is added when the text doesn't name it. */
export function mapUrl(location: string): string | null {
  const where = location.trim();
  if (!where) return null;
  const query = /santa cruz|\b\d{5}\b/i.test(where) ? where : `${where}, Santa Cruz, CA`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
