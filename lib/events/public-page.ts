// Rules for the public sign-up page's hero button, sticky bar and facts strip.
// Pure, so the page, the editor preview and tests share one answer.

import type { SeatInfo } from "@/components/events/RegistrationForm";
import { eventContact } from "./theme";
import type { EventRec } from "./types";

export type Cta =
  | { kind: "register"; label: "Register now" }
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
  return { kind: "register", label: "Register now" };
}

/**
 * The price shown with the key facts: the first pricing line, only when
 * pricing is turned on. Pricing off may mean "charged to your account", so
 * the page never claims an event is free.
 */
export function priceFact(event: EventRec): string | null {
  if (!event.pricingEnabled) return null;
  const line = event.pricing
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  return line ?? null;
}
