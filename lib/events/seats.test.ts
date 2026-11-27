import { describe, expect, it } from "vitest";
import { availability, existingSignup, promotable } from "./seats";
import type { EventRec, Registration } from "./types";

const ev = (type: EventRec["type"], capacity: number) =>
  ({ type, capacity, slots: [] }) as unknown as EventRec;

const reg = (id: string, status: Registration["status"], partySize = 2) =>
  ({ id, status, partySize, slotIds: [] }) as unknown as Registration;

describe("availability", () => {
  const regs = [reg("a", "confirmed"), reg("b", "confirmed")];

  it("counts a tournament team as one seat", () => {
    const a = availability(ev("tournament", 2), regs);
    expect(a.taken).toBe(2);
    expect(a.full).toBe(true);
  });

  it("counts the whole party on a dinner", () => {
    expect(availability(ev("dinner", 4), regs).taken).toBe(4);
  });

  it("ignores waitlisted and cancelled registrations", () => {
    const more = [...regs, reg("c", "waitlist"), reg("d", "cancelled")];
    expect(availability(ev("tournament", 5), more).taken).toBe(2);
  });
});

describe("existingSignup", () => {
  const r = (over: Partial<Registration>): Registration =>
    ({
      id: "r1",
      email: "Pat@Example.com",
      status: "confirmed",
      slotIds: [],
      ...over,
    }) as Registration;
  const single = { scheduleMode: "single" } as EventRec;
  const slots = { scheduleMode: "slots" } as EventRec;

  it("finds an active sign-up with the same email, ignoring case and spaces", () => {
    expect(existingSignup(single, [r({})], " pat@example.COM ", [])?.id).toBe("r1");
    expect(existingSignup(single, [r({ status: "waitlist" })], "pat@example.com", [])?.id).toBe("r1");
  });

  it("lets someone who cancelled sign up again", () => {
    expect(existingSignup(single, [r({ status: "cancelled" })], "pat@example.com", [])).toBeNull();
  });

  it("ignores other people", () => {
    expect(existingSignup(single, [r({})], "sam@example.com", [])).toBeNull();
  });

  it("on a multi-date event, allows new dates but not a date already held", () => {
    const held = [r({ slotIds: ["a", "b"] })];
    expect(existingSignup(slots, held, "pat@example.com", ["c"])).toBeNull();
    expect(existingSignup(slots, held, "pat@example.com", ["c", "b"])?.id).toBe("r1");
  });
});

describe("promotable", () => {
  const w = (id: string, createdAt: string, partySize = 1) =>
    ({ id, status: "waitlist", partySize, slotIds: [], createdAt, email: `${id}@x.y` }) as unknown as Registration;
  const single = (type: EventRec["type"], capacity: number | null) =>
    ({ type, capacity, scheduleMode: "single", rosterLimit: null, slots: [] }) as unknown as EventRec;

  it("moves up the earliest waitlisted teams into open spots", () => {
    const regs = [reg("a", "confirmed"), w("late", "2027-04-03"), w("early", "2027-04-01"), w("mid", "2027-04-02")];
    expect(promotable(single("tournament", 3), regs).map((r) => r.id)).toEqual(["early", "mid"]);
  });
  it("nothing when the field is full or nobody is waiting", () => {
    expect(promotable(single("tournament", 1), [reg("a", "confirmed"), w("x", "2027-04-01")])).toEqual([]);
    expect(promotable(single("tournament", 3), [reg("a", "confirmed")])).toEqual([]);
  });
  it("keeps the order: a party too big for the spots left waits, and so does everyone behind it", () => {
    const regs = [reg("a", "confirmed", 2), w("big", "2027-04-01", 3), w("small", "2027-04-02", 1)];
    expect(promotable(single("dinner", 4), regs)).toEqual([]);
  });
  it("an event with no limit lets everyone in", () => {
    expect(promotable(single("dinner", null), [w("x", "2027-04-01", 4)]).map((r) => r.id)).toEqual(["x"]);
  });
  it("multi-date events are left to staff", () => {
    const slots = { ...single("clinic", 5), scheduleMode: "slots" } as EventRec;
    expect(promotable(slots, [w("x", "2027-04-01")])).toEqual([]);
  });
});
