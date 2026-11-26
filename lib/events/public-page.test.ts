import { describe, expect, test } from "vitest";
import { ctaState, mapUrl, priceFact, sectionLinks } from "./public-page";
import type { EventRec } from "./types";
import type { SeatInfo } from "@/components/events/RegistrationForm";

function ev(over: Partial<EventRec> = {}): EventRec {
  return {
    id: "e1",
    slug: "dinner",
    title: "Member Dinner",
    type: "dinner",
    description: "",
    info: "",
    location: "Hollins House",
    startsAt: "2026-12-05T02:00:00.000Z",
    endsAt: null,
    scheduleMode: "single",
    allowMultiSlot: false,
    slotsPrompt: "",
    slots: [],
    capacity: 40,
    rosterLimit: null,
    waitlistEnabled: false,
    allowGuests: false,
    maxGuests: null,
    collectGuestNames: false,
    inviteOnly: false,
    allowlist: [],
    inviteOnlyMessage: "",
    customFields: [],
    photos: [],
    galleryMode: "grid",
    theme: null,
    contactName: null,
    contactEmail: null,
    pricingEnabled: false,
    pricing: "",
    showRoster: false,
    rosterStyle: "first_initial",
    managers: [],
    createdBy: null,
    status: "open",
    createdAt: "",
    ...over,
  };
}

const open: SeatInfo = { remaining: 10, full: false, slots: [] };
const full: SeatInfo = { remaining: 0, full: true, slots: [] };

describe("ctaState", () => {
  test("open with room: Register now", () => {
    expect(ctaState(ev(), open, false)).toEqual({ kind: "register", label: "Register now" });
  });

  test("the register button uses the event's own wording", () => {
    const e = ev({ theme: { preset: "clubhouse", buttonLabel: "RSVP" } });
    expect(ctaState(e, open, false)).toEqual({ kind: "register", label: "RSVP" });
  });

  test("full without waitlist offers contact", () => {
    expect(ctaState(ev(), full, false)).toEqual({
      kind: "contact",
      name: "Ian Johnson",
      email: "Ijohnson@pasatiempo.com",
    });
  });

  test("full without waitlist names the event's own contact", () => {
    expect(
      ctaState(ev({ contactName: "Pat", contactEmail: "pat@x.com" }), full, false),
    ).toEqual({ kind: "contact", name: "Pat", email: "pat@x.com" });
  });

  test("full with waitlist shows Join the waitlist", () => {
    expect(ctaState(ev({ waitlistEnabled: true }), full, false)).toEqual({
      kind: "waitlist",
      label: "Join the waitlist",
    });
  });

  test("full tournament offers contact even with waitlist on", () => {
    expect(ctaState(ev({ type: "tournament", waitlistEnabled: true }), full, false).kind).toBe(
      "contact",
    );
  });

  test("a full roster offers contact", () => {
    expect(ctaState(ev({ waitlistEnabled: true }), open, true).kind).toBe("contact");
  });

  test("slots event is full only when every date is full", () => {
    const e = ev({ scheduleMode: "slots" });
    const some: SeatInfo = {
      remaining: null,
      full: false,
      slots: [
        { id: "a", remaining: 0, full: true },
        { id: "b", remaining: 3, full: false },
      ],
    };
    const all: SeatInfo = {
      remaining: null,
      full: false,
      slots: [
        { id: "a", remaining: 0, full: true },
        { id: "b", remaining: 0, full: true },
      ],
    };
    expect(ctaState(e, some, false).kind).toBe("register");
    expect(ctaState(e, all, false).kind).toBe("contact");
  });

  test("closed or draft event has no CTA", () => {
    expect(ctaState(ev({ status: "closed" }), open, false)).toEqual({ kind: "none" });
    expect(ctaState(ev({ status: "draft" }), open, false)).toEqual({ kind: "none" });
  });
});

describe("priceFact", () => {
  test("is null when pricing is off", () => {
    expect(priceFact(ev({ pricingEnabled: false, pricing: "Members — $85" }))).toBeNull();
  });
  test("is null when pricing is on but blank", () => {
    expect(priceFact(ev({ pricingEnabled: true, pricing: " \n " }))).toBeNull();
  });
  test("takes the first non-blank line, amount first", () => {
    expect(
      priceFact(ev({ pricingEnabled: true, pricing: "\n Members — $85 \nGuests — $95" })),
    ).toEqual({ amount: "$85", detail: "Members" });
  });
  test("a line without an 'item — amount' split stays whole", () => {
    expect(priceFact(ev({ pricingEnabled: true, pricing: "$320 per person" }))).toEqual({
      amount: "$320 per person",
      detail: "",
    });
  });
});

describe("sectionLinks", () => {
  test("lists the sections the page has, in page order", () => {
    const e = ev({
      description: "About",
      info: "Info",
      pricingEnabled: true,
      pricing: "Entry — $10",
      photos: ["a.jpg", "b.jpg"],
    });
    expect(sectionLinks(e).map((l) => l.id)).toEqual([
      "about",
      "details",
      "pricing",
      "photos",
      "register",
    ]);
  });
  test("a short page gets no links", () => {
    expect(sectionLinks(ev({ description: "About" }))).toEqual([]);
  });
  test("a closed event has no Register link", () => {
    const e = ev({ status: "closed", description: "A", info: "B", pricingEnabled: true, pricing: "x — $1" });
    expect(sectionLinks(e).map((l) => l.id)).toEqual(["about", "details", "pricing"]);
  });
  test("a multi-date event links its schedule", () => {
    const e = ev({
      scheduleMode: "slots",
      slots: [
        { id: "a", date: "2026-12-01", startTime: "", endTime: "", label: "", note: "", capacity: null },
        { id: "b", date: "2026-12-08", startTime: "", endTime: "", label: "", note: "", capacity: null },
      ],
      description: "A",
    });
    expect(sectionLinks(e).map((l) => l.id)).toEqual(["about", "schedule", "register"]);
  });
});

describe("mapUrl", () => {
  test("searches the location in Santa Cruz", () => {
    expect(mapUrl("Pasatiempo Golf Club · Hollins House")).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("Pasatiempo Golf Club · Hollins House, Santa Cruz, CA"),
    );
  });
  test("leaves a full address alone", () => {
    expect(mapUrl("20 Clubhouse Rd, Santa Cruz, CA 95060")).toBe(
      "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("20 Clubhouse Rd, Santa Cruz, CA 95060"),
    );
  });
  test("no location, no link", () => {
    expect(mapUrl("  ")).toBeNull();
  });
});
