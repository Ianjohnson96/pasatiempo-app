import { describe, expect, it } from "vitest";
import {
  computeFinance,
  feeForCents,
  formatCents,
  parseDollarsToCents,
} from "./finance";
import type { EventFinance, PrizePurchase } from "./finance-types";
import type { EventRec, Registration, RegStatus } from "./types";

// The payout math is the one place in this app where a bug moves real money,
// so it gets real tests. Fixtures mirror the actual clinic: $320 a head, seven
// Friday dates, four pros sharing the pot.

const PROS = [
  { id: "ian", name: "Ian" },
  { id: "justin", name: "Justin" },
  { id: "chris", name: "Chris" },
  { id: "tyler", name: "Tyler" },
];

function ev(dateCount: number): Pick<EventRec, "slots"> {
  return {
    slots: Array.from({ length: dateCount }, (_, i) => ({
      id: "d" + (i + 1),
      date: null,
      startTime: "",
      endTime: "",
      label: "",
      note: "",
      capacity: null,
    })),
  };
}

function reg(over: Partial<Registration> & { id: string }): Registration {
  return {
    eventId: "e1",
    name: over.id,
    email: over.id + "@example.com",
    phone: "",
    partySize: 1,
    guestNames: [],
    slotIds: [],
    answers: {},
    status: "confirmed" as RegStatus,
    createdAt: "2026-08-01T00:00:00Z",
    paid: false,
    feeCents: null,
    tender: null,
    paidOn: null,
    paymentNote: "",
    ...over,
  };
}

// n people, the first `paidCount` of them marked paid.
function people(n: number, paidCount: number): Registration[] {
  return Array.from({ length: n }, (_, i) =>
    reg({ id: "p" + (i + 1), paid: i < paidCount }),
  );
}

function fin(over: Partial<EventFinance> = {}): EventFinance {
  return {
    eventId: "e1",
    feeCents: 32_000,
    organizerName: "Ian",
    organizerCutCents: 32_000,
    instructors: PROS,
    presence: {},
    ...over,
  };
}

// Everyone present on every date.
function allPresent(dateCount: number, ids = PROS.map((p) => p.id)) {
  const presence: Record<string, string[]> = {};
  for (let i = 1; i <= dateCount; i++) presence["d" + i] = [...ids];
  return presence;
}

const noPrizes: PrizePurchase[] = [];

function prize(amountCents: number): PrizePurchase {
  return {
    id: "z" + amountCents,
    eventId: "e1",
    purchasedOn: "2026-09-11",
    description: "prizes",
    amountCents,
    createdAt: "2026-09-11T00:00:00Z",
  };
}

describe("the waterfall", () => {
  it("reproduces the clinic sheet: 10 paid, $320 cut, 7 dates", () => {
    const s = computeFinance(
      ev(7),
      people(25, 10),
      fin({ presence: allPresent(7) }),
      noPrizes,
    );
    expect(s.grossCents).toBe(320_000); // 10 x $320
    expect(s.paidCount).toBe(10);
    expect(s.unpaidCount).toBe(15);
    expect(s.outstandingCents).toBe(480_000); // 15 still to collect
    expect(s.organizerCutCents).toBe(32_000);
    expect(s.netPotCents).toBe(288_000); // $2,880
    expect(s.perClinicCents).toBe(41_142); // $411.42
  });

  it("subtracts prize spend before splitting", () => {
    const s = computeFinance(
      ev(7),
      people(10, 10),
      fin({ organizerCutCents: 0, presence: allPresent(7) }),
      [prize(50_000), prize(20_000)],
    );
    expect(s.prizeTotalCents).toBe(70_000);
    expect(s.netPotCents).toBe(250_000);
  });

  it("goes negative rather than hiding an overspend", () => {
    const s = computeFinance(
      ev(7),
      people(1, 1),
      fin({ organizerCutCents: 0, presence: allPresent(7) }),
      [prize(100_000)],
    );
    expect(s.netPotCents).toBe(-68_000);
  });
});

describe("what counts as collected", () => {
  it("prefers a person's fee override over the event default", () => {
    const s = computeFinance(
      ev(1),
      [
        reg({ id: "a", paid: true }), // default $320
        reg({ id: "b", paid: true, feeCents: 10_000 }), // comped to $100
      ],
      fin({ organizerCutCents: 0 }),
      noPrizes,
    );
    expect(s.grossCents).toBe(42_000);
  });

  it("excludes cancelled sign-ups even when they were marked paid", () => {
    const s = computeFinance(
      ev(1),
      [
        reg({ id: "a", paid: true }),
        reg({ id: "b", paid: true, status: "cancelled" }),
      ],
      fin({ organizerCutCents: 0 }),
      noPrizes,
    );
    expect(s.grossCents).toBe(32_000);
    expect(s.paidCount).toBe(1);
  });

  it("counts only confirmed people as outstanding", () => {
    const s = computeFinance(
      ev(1),
      [
        reg({ id: "a" }), // confirmed, unpaid -> outstanding
        reg({ id: "b", status: "waitlist" }), // not owed yet
        reg({ id: "c", status: "cancelled" }),
      ],
      fin(),
      noPrizes,
    );
    expect(s.outstandingCents).toBe(32_000);
    expect(s.unpaidCount).toBe(1);
  });

  it("keeps money a waitlisted person actually paid", () => {
    const s = computeFinance(
      ev(1),
      [reg({ id: "a", paid: true, status: "waitlist" })],
      fin({ organizerCutCents: 0 }),
      noPrizes,
    );
    expect(s.grossCents).toBe(32_000);
  });

  it("feeForCents falls back to the event fee", () => {
    expect(feeForCents({ feeCents: null }, { feeCents: 32_000 })).toBe(32_000);
    expect(feeForCents({ feeCents: 500 }, { feeCents: 32_000 })).toBe(500);
  });
});

describe("the per-date split", () => {
  it("pays every pro marked present — the bug the sheet has", () => {
    // The spreadsheet's COUNTIF spans only three rows, so Tyler is marked
    // present and paid nothing. All four must share here.
    const s = computeFinance(
      ev(7),
      people(10, 10),
      fin({ organizerCutCents: 0, presence: allPresent(7) }),
      noPrizes,
    );
    const byName = Object.fromEntries(
      s.payouts.map((p) => [p.instructor.name, p]),
    );
    expect(byName.Tyler.datesWorked).toBe(7);
    expect(byName.Tyler.owedCents).toBeGreaterThan(0);
    expect(byName.Tyler.owedCents).toBe(byName.Justin.owedCents);
  });

  it("splits a date only among those present that day", () => {
    const s = computeFinance(
      ev(2),
      people(10, 10),
      fin({
        organizerCutCents: 0,
        organizerName: "",
        presence: { d1: ["ian", "justin"], d2: ["chris"] },
      }),
      noPrizes,
    );
    expect(s.perClinicCents).toBe(160_000);
    const byName = Object.fromEntries(
      s.payouts.map((p) => [p.instructor.name, p]),
    );
    expect(byName.Ian.owedCents).toBe(80_000);
    expect(byName.Justin.owedCents).toBe(80_000);
    expect(byName.Chris.owedCents).toBe(160_000);
    expect(byName.Tyler.owedCents).toBe(0);
  });

  it("leaves an unstaffed date's share unallocated", () => {
    const s = computeFinance(
      ev(2),
      people(10, 10),
      fin({
        organizerCutCents: 0,
        organizerName: "",
        presence: { d1: ["ian"] }, // nobody on d2
      }),
      noPrizes,
    );
    expect(s.sharesTotalCents).toBe(160_000);
    expect(s.remainderCents).toBe(160_000);
  });

  it("ignores a presence entry for a pro who was removed", () => {
    const s = computeFinance(
      ev(1),
      people(10, 10),
      fin({
        organizerCutCents: 0,
        organizerName: "",
        instructors: [{ id: "ian", name: "Ian" }],
        presence: { d1: ["ian", "ghost"] },
      }),
      noPrizes,
    );
    // The whole date goes to Ian, not half of it to a pro who no longer exists.
    expect(s.payouts).toHaveLength(1);
    expect(s.payouts[0].owedCents).toBe(320_000);
    expect(s.remainderCents).toBe(0);
  });

  it("does not divide by zero when the event has no dates", () => {
    const s = computeFinance(ev(0), people(10, 10), fin(), noPrizes);
    expect(s.dateCount).toBe(0);
    expect(s.perClinicCents).toBe(0);
    expect(s.sharesTotalCents).toBe(0);
    expect(s.remainderCents).toBe(s.netPotCents);
  });
});

describe("the organizer", () => {
  it("takes the cut off the top AND earns per-clinic shares", () => {
    const s = computeFinance(
      ev(7),
      people(10, 10),
      fin({ presence: allPresent(7) }),
      noPrizes,
    );
    const ian = s.payouts.find((p) => p.instructor.name === "Ian");
    const justin = s.payouts.find((p) => p.instructor.name === "Justin");
    expect(ian).toBeDefined();
    expect(justin).toBeDefined();
    expect(ian!.isOrganizer).toBe(true);
    expect(ian!.organizerCutCents).toBe(32_000);
    expect(ian!.sharesCents).toBe(justin!.sharesCents);
    expect(ian!.owedCents).toBe(justin!.owedCents + 32_000);
  });

  it("gives the cut to nobody when no name is set", () => {
    const s = computeFinance(
      ev(1),
      people(10, 10),
      fin({ organizerName: "", presence: { d1: ["ian"] } }),
      noPrizes,
    );
    expect(s.payouts.every((p) => p.organizerCutCents === 0)).toBe(true);
    // The cut still leaves the pot even when it isn't attributed to a pro.
    expect(s.netPotCents).toBe(288_000);
  });
});

describe("reconciliation", () => {
  // The invariant that makes the page trustworthy: nothing silently vanishes.
  const cases: Array<{
    name: string;
    dates: number;
    signups: number;
    paid: number;
    cut: number;
    prizes: PrizePurchase[];
  }> = [
    {
      name: "7 dates, 4 pros",
      dates: 7,
      signups: 25,
      paid: 10,
      cut: 32_000,
      prizes: [],
    },
    {
      name: "awkward divisor",
      dates: 3,
      signups: 7,
      paid: 7,
      cut: 0,
      prizes: [prize(1_111)],
    },
    {
      name: "prime everything",
      dates: 11,
      signups: 13,
      paid: 13,
      cut: 777,
      prizes: [prize(9_999)],
    },
    {
      name: "negative pot",
      dates: 7,
      signups: 2,
      paid: 1,
      cut: 32_000,
      prizes: [prize(500_000)],
    },
  ];

  for (const c of cases) {
    it("balances: " + c.name, () => {
      const s = computeFinance(
        ev(c.dates),
        people(c.signups, c.paid),
        fin({ organizerCutCents: c.cut, presence: allPresent(c.dates) }),
        c.prizes,
      );
      // shares + unallocated == net pot
      expect(s.sharesTotalCents + s.remainderCents).toBe(s.netPotCents);
      // and the whole waterfall closes back to what was collected
      expect(
        s.organizerCutCents +
          s.prizeTotalCents +
          s.sharesTotalCents +
          s.remainderCents,
      ).toBe(s.grossCents);
    });
  }
});

describe("money formatting", () => {
  it("formats dollars and cents", () => {
    expect(formatCents(41_142)).toBe("$411.42");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(-32_000)).toBe("-$320.00");
  });

  it("parses what a human types", () => {
    expect(parseDollarsToCents("320")).toBe(32_000);
    expect(parseDollarsToCents("$320.50")).toBe(32_050);
    expect(parseDollarsToCents("1,200")).toBe(120_000);
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
  });
});
