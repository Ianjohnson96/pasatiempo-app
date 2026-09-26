import { describe, expect, it } from "vitest";
import {
  dropLateness,
  nextUpOrder,
  summariseLedger,
  type LedgerEvent,
} from "./ledger";
import type { RateCard } from "./types";

const TEE = "2026-09-25T19:00:00.000Z";
const before = (hours: number) =>
  new Date(Date.parse(TEE) - hours * 3_600_000).toISOString();

const RATES: RateCard = {
  "Single Bag": 10000,
  "Double Bag": 18000,
  "Forecaddie 1-2": 12000,
  "Forecaddie 3-4": 20000,
};

function ev(over: Partial<LedgerEvent> = {}): LedgerEvent {
  return {
    caddieId: "c1",
    status: "Accepted",
    loopType: "Single Bag",
    teeTime: TEE,
    loopStatus: "Completed",
    droppedAt: null,
    ...over,
  };
}

describe("dropLateness", () => {
  it("is null when nothing was dropped", () => {
    expect(dropLateness(null, TEE)).toBeNull();
  });

  it("a week out is early", () => {
    expect(dropLateness(before(24 * 7), TEE)).toBe("early");
  });

  it("just outside a day is still early", () => {
    expect(dropLateness(before(25), TEE)).toBe("early");
  });

  it("inside a day is late", () => {
    expect(dropLateness(before(12), TEE)).toBe("late");
  });

  it("inside four hours is same day — the one that cannot be refilled", () => {
    expect(dropLateness(before(2), TEE)).toBe("same day");
  });

  it("after the tee time has passed counts as same day, not early", () => {
    expect(
      dropLateness(new Date(Date.parse(TEE) + 60_000).toISOString(), TEE),
    ).toBe("same day");
  });
});

describe("summariseLedger", () => {
  it("counts a completed accepted loop as worked, and pays it", () => {
    const rows = summariseLedger([ev({ loopType: "Double Bag" })], RATES);
    const r = rows.get("c1")!;
    expect(r.loopsWorked).toBe(1);
    expect(r.earnedCents).toBe(18000);
    expect(r.offered).toBe(1);
    expect(r.accepted).toBe(1);
  });

  // Otherwise a caddie climbs the fairness order by booking work he has not
  // done, and gets passed over for loops he could actually have taken.
  it("does not pay for a loop that has not happened yet", () => {
    const rows = summariseLedger([ev({ loopStatus: "Unassigned" })], RATES);
    const r = rows.get("c1")!;
    expect(r.accepted).toBe(1);
    expect(r.loopsWorked).toBe(0);
    expect(r.earnedCents).toBe(0);
  });

  it("does not pay for a cancelled loop", () => {
    const rows = summariseLedger([ev({ loopStatus: "Cancelled" })], RATES);
    expect(rows.get("c1")!.loopsWorked).toBe(0);
  });

  it("separates declining from ignoring", () => {
    const rows = summariseLedger(
      [ev({ status: "Declined" }), ev({ status: "Expired" })],
      RATES,
    );
    const r = rows.get("c1")!;
    expect(r.declined).toBe(1);
    expect(r.ignored).toBe(1);
    expect(r.offered).toBe(2);
  });

  it("counts a late hand-back separately from an early one", () => {
    const rows = summariseLedger(
      [
        ev({ status: "Dropped", droppedAt: before(24 * 5) }),
        ev({ status: "Dropped", droppedAt: before(3) }),
      ],
      RATES,
    );
    const r = rows.get("c1")!;
    expect(r.dropped).toBe(2);
    expect(r.droppedLate).toBe(1);
  });

  // The shop pulling an offer is not the caddie's doing and must never look
  // like it on his record.
  it("holds nothing against a caddie for a withdrawn offer", () => {
    const rows = summariseLedger([ev({ status: "Withdrawn" })], RATES);
    const r = rows.get("c1")!;
    expect(r.offered).toBe(1);
    expect(r.declined).toBe(0);
    expect(r.dropped).toBe(0);
    expect(r.ignored).toBe(0);
    expect(r.noShows).toBe(0);
  });

  it("records a no show", () => {
    const rows = summariseLedger([ev({ status: "No Show" })], RATES);
    expect(rows.get("c1")!.noShows).toBe(1);
  });

  it("pays nothing for a loop type with no rate set", () => {
    const rows = summariseLedger([ev()], {});
    const r = rows.get("c1")!;
    expect(r.loopsWorked).toBe(1);
    expect(r.earnedCents).toBe(0);
  });

  it("keeps caddies apart", () => {
    const rows = summariseLedger(
      [ev(), ev({ caddieId: "c2", loopType: "Forecaddie 3-4" })],
      RATES,
    );
    expect(rows.get("c1")!.earnedCents).toBe(10000);
    expect(rows.get("c2")!.earnedCents).toBe(20000);
  });
});

describe("nextUpOrder", () => {
  it("puts the caddie who has earned least first", () => {
    const rows = summariseLedger(
      [
        ev({ caddieId: "rich", loopType: "Forecaddie 3-4" }),
        ev({ caddieId: "poor", loopType: "Single Bag" }),
      ],
      RATES,
    );
    expect(nextUpOrder(rows, ["rich", "poor"])).toEqual(["poor", "rich"]);
  });

  it("a caddie with no history at all is furthest behind", () => {
    const rows = summariseLedger([ev({ caddieId: "worked" })], RATES);
    expect(nextUpOrder(rows, ["worked", "new"])).toEqual(["new", "worked"]);
  });

  // Equal effort, unequal money: the man who earned more over the same number
  // of loops has had the better of it, so the other goes first.
  it("breaks a tie on money by who worked fewer loops", () => {
    const rows = summariseLedger(
      [
        ev({ caddieId: "two", loopType: "Single Bag" }),
        ev({ caddieId: "two", loopType: "Single Bag" }),
        ev({ caddieId: "one", loopType: "Double Bag" }),
        ev({ caddieId: "one", loopType: "Single Bag" }),
      ],
      RATES,
    );
    // "two" earned 20000 over 2 loops; "one" earned 28000 over 2.
    expect(nextUpOrder(rows, ["one", "two"])).toEqual(["two", "one"]);
  });
});
