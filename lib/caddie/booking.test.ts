import { describe, expect, it } from "vitest";
import { planBooking } from "./booking";

const START = Date.parse("2026-09-22T19:00:00.000Z"); // 12:00 course time
const at = (mins: number) => new Date(START + mins * 60_000).toISOString();

describe("planBooking", () => {
  it("a single group is not numbered", () => {
    const rows = planBooking({
      startMs: START,
      name: "Whitmore",
      groups: [[{ loopType: "Single Bag", count: 1 }]],
    });
    expect(rows).toEqual([
      {
        teeTime: at(0),
        playerName: "Whitmore",
        loopType: "Single Bag",
        caddiesRequired: 1,
      },
    ]);
  });

  it("puts two double bags on one tee time as one loop needing two caddies", () => {
    const rows = planBooking({
      startMs: START,
      name: "Reed",
      groups: [[{ loopType: "Double Bag", count: 2 }]],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].caddiesRequired).toBe(2);
    expect(rows[0].loopType).toBe("Double Bag");
  });

  it("mixes types within one group", () => {
    const rows = planBooking({
      startMs: START,
      name: "Reed",
      groups: [
        [
          { loopType: "Double Bag", count: 1 },
          { loopType: "Single Bag", count: 1 },
        ],
      ],
    });
    expect(rows.map((r) => r.loopType)).toEqual(["Double Bag", "Single Bag"]);
    expect(new Set(rows.map((r) => r.teeTime)).size).toBe(1);
  });

  it("pairs a double bag with a two-person forecaddie", () => {
    const rows = planBooking({
      startMs: START,
      name: "Reed",
      groups: [
        [
          { loopType: "Double Bag", count: 1 },
          { loopType: "Forecaddie 1-2", count: 1 },
        ],
      ],
    });
    expect(rows.map((r) => r.loopType)).toEqual([
      "Double Bag",
      "Forecaddie 1-2",
    ]);
  });

  it("spaces tee times ten minutes apart by default", () => {
    const rows = planBooking({
      startMs: START,
      name: "Outing",
      groups: Array.from({ length: 3 }, () => [
        { loopType: "Forecaddie 3-4" as const, count: 1 },
      ]),
    });
    expect(rows.map((r) => r.teeTime)).toEqual([at(0), at(10), at(20)]);
  });

  // The case from the shop: sixteen players, four groups, only the first and
  // the fourth want a caddie.
  it("skips groups that want nobody but keeps their place in the numbering", () => {
    const rows = planBooking({
      startMs: START,
      name: "Sixteen",
      groups: [
        [{ loopType: "Forecaddie 3-4", count: 1 }],
        [],
        [],
        [{ loopType: "Forecaddie 3-4", count: 1 }],
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].playerName).toBe("Sixteen (1 of 4)");
    expect(rows[1].playerName).toBe("Sixteen (4 of 4)");
    // The fourth group tees off thirty minutes after the first, not ten.
    expect(rows[1].teeTime).toBe(at(30));
  });

  it("drops needs with no caddies rather than writing a zero", () => {
    const rows = planBooking({
      startMs: START,
      name: "Reed",
      groups: [
        [
          { loopType: "Single Bag", count: 0 },
          { loopType: "Double Bag", count: 1 },
        ],
      ],
    });
    expect(rows.map((r) => r.loopType)).toEqual(["Double Bag"]);
  });

  it("returns nothing when no group wants a caddie", () => {
    expect(
      planBooking({ startMs: START, name: "Reed", groups: [[], []] }),
    ).toEqual([]);
  });

  it("clamps a silly count into the range the column allows", () => {
    const rows = planBooking({
      startMs: START,
      name: "Reed",
      groups: [[{ loopType: "Single Bag", count: 99 }]],
    });
    expect(rows[0].caddiesRequired).toBe(8);
  });

  it("honours an explicit interval when one is given", () => {
    const rows = planBooking({
      startMs: START,
      name: "Outing",
      groups: [
        [{ loopType: "Single Bag", count: 1 }],
        [{ loopType: "Single Bag", count: 1 }],
      ],
      intervalMinutes: 8,
    });
    expect(rows.map((r) => r.teeTime)).toEqual([at(0), at(8)]);
  });
});
