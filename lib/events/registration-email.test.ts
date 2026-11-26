import { describe, expect, it } from "vitest";
import { signupEmail } from "./registration-email";
import type { EventRec } from "./types";

const base = {
  slug: "holiday-dinner",
  title: "Holiday Dinner",
  type: "dinner",
  location: "Hollins House",
  startsAt: "2026-12-12T02:00:00.000Z",
  endsAt: null,
  scheduleMode: "single",
  slots: [],
  customFields: [
    { id: "diet", label: "Dietary needs", type: "short_text", required: false, options: [], scope: "player" },
    { id: "seat", label: "Seat near the fire?", type: "short_text", required: false, options: [], scope: "player" },
  ],
  theme: null,
  contactName: null,
  contactEmail: null,
} as unknown as EventRec;

const reg = {
  name: "Pat Smith",
  email: "pat@example.com",
  partySize: 2,
  guestNames: ["Lee Wong"],
  slotIds: [],
  answers: { diet: "Vegetarian", seat: "" },
};
const url = "https://club.test/events/e/holiday-dinner";

describe("signupEmail", () => {
  it("confirms the sign-up with its details", () => {
    const m = signupEmail(base, reg, "confirmed", url);
    expect(m.to).toBe("pat@example.com");
    expect(m.subject).toBe("Holiday Dinner: you're registered");
    expect(m.text).toContain("Hi Pat,");
    expect(m.text).toContain("You're registered for Holiday Dinner.");
    expect(m.text).toContain("Hollins House");
    expect(m.text).toContain("Party of 2: you and Lee Wong");
    expect(m.text).toContain("Dietary needs: Vegetarian");
    expect(m.text).not.toContain("Seat near the fire?");
    expect(m.text).toContain(`To change or cancel, open ${url} and choose "Manage my registration".`);
    expect(m.text).toContain("Questions? Contact Ian Johnson at Ijohnson@pasatiempo.com.");
  });

  it("a waitlist email says so", () => {
    const m = signupEmail(base, reg, "waitlist", url);
    expect(m.subject).toBe("Holiday Dinner: you're on the waitlist");
    expect(m.text).toContain("You're on the waitlist for Holiday Dinner.");
  });

  it("carries the event's own message and contact", () => {
    const ev = {
      ...base,
      theme: { preset: "clubhouse", thankYou: "Jackets suggested.\nThe bar opens at 6." },
      contactName: "Sam",
      contactEmail: "sam@club.test",
    } as EventRec;
    const m = signupEmail(ev, reg, "confirmed", url);
    expect(m.text).toContain("Jackets suggested.\nThe bar opens at 6.");
    expect(m.text).toContain("Questions? Contact Sam at sam@club.test.");
  });

  it("the message is for confirmed sign-ups only", () => {
    const ev = { ...base, theme: { preset: "clubhouse", thankYou: "See you there!" } } as EventRec;
    expect(signupEmail(ev, reg, "waitlist", url).text).not.toContain("See you there!");
  });

  it("lists the dates chosen on a multi-date event", () => {
    const ev = {
      ...base,
      scheduleMode: "slots",
      slots: [
        { id: "a", date: "2026-12-01", startTime: "09:00", endTime: "", label: "", note: "", capacity: null },
        { id: "b", date: "2026-12-08", startTime: "09:00", endTime: "", label: "", note: "", capacity: null },
      ],
    } as unknown as EventRec;
    const m = signupEmail(ev, { ...reg, partySize: 1, guestNames: [], slotIds: ["b"] }, "confirmed", url);
    expect(m.text).toContain("Dec 8");
    expect(m.text).not.toContain("Dec 1,");
    expect(m.text).not.toContain("Party of");
  });

  it("escapes what members typed in the HTML copy", () => {
    const m = signupEmail(base, { ...reg, name: "<b>Pat</b>", answers: { diet: "<script>" } }, "confirmed", url);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
});
