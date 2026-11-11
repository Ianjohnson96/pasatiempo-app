import { describe, expect, it } from "vitest";
import { availability } from "./seats";
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
