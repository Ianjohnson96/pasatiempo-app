import { describe, expect, it } from "vitest";
import { teamNumbers, tournamentRows } from "./csv";
import type { EventRec, Registration } from "./types";

function reg(
  id: string,
  createdAt: string,
  status: Registration["status"],
): Registration {
  return {
    id,
    eventId: "e1",
    name: "Mem " + id,
    email: `${id}@x.com`,
    phone: "",
    partySize: 2,
    guestNames: [],
    slotIds: [],
    answers: {},
    players: [
      { role: "member", name: "Mem" + id, email: `${id}m@x.com`, ghin: "1", answers: {} },
      { role: "guest", name: "Gst" + id, email: `${id}g@x.com`, ghin: "2", answers: {} },
    ],
    emailFailed: false,
    status,
    createdAt,
    paid: false,
    feeCents: null,
    tender: null,
    paidOn: null,
    paymentNote: "",
  };
}

const ev = {
  id: "e1",
  title: "T",
  type: "tournament",
  customFields: [],
  slots: [],
} as unknown as EventRec;

describe("teamNumbers", () => {
  // A confirmed, B moved to the waitlist, C confirmed, D cancelled, given
  // out of entry order.
  const regs = [
    reg("C", "2026-11-03T00:00:00Z", "confirmed"),
    reg("D", "2026-11-02T12:00:00Z", "cancelled"),
    reg("A", "2026-11-01T00:00:00Z", "confirmed"),
    reg("B", "2026-11-02T00:00:00Z", "waitlist"),
  ];

  it("numbers confirmed and waitlisted teams together in entry order", () => {
    const n = teamNumbers(regs);
    expect(n.get("A")).toBe(1);
    expect(n.get("B")).toBe(2);
    expect(n.get("C")).toBe(3);
  });

  it("gives cancelled teams no number", () => {
    const n = teamNumbers(regs);
    expect(n.has("D")).toBe(false);
    expect(n.size).toBe(3);
  });

  it("matches the CSV's Team # column", () => {
    const rows = tournamentRows(ev, regs).slice(1);
    const byMember = new Map(rows.map((r) => [r[2], r[0]]));
    expect(byMember.get("MemA")).toBe("1");
    expect(byMember.get("MemB")).toBe("2");
    expect(byMember.get("MemC")).toBe("3");
    expect(byMember.get("MemD")).toBe("");
  });

  it("does not reorder the caller's array", () => {
    const copy = [...regs];
    teamNumbers(regs);
    expect(regs).toEqual(copy);
  });
});
