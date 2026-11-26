import { describe, expect, it } from "vitest";
import { availability, existingSignup } from "./seats";
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
