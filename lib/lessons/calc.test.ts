import { describe, expect, it } from "vitest";
import {
  addDays,
  courseDay,
  courseMidnightIso,
  delta,
  groupByDay,
  monthRange,
  parseScheduleParams,
  scaleBars,
  seqLabel,
  shiftAnchor,
  weekRange,
} from "./calc";

// The lesson book's dates are Pacific, and the server is UTC. Every test
// here is a place where getting that wrong moves a lesson to the wrong day.

describe("courseDay", () => {
  it("puts an 11:30pm Pacific lesson on its Pacific day, not UTC's", () => {
    expect(courseDay("2026-10-01T06:30:00Z")).toBe("2026-09-30");
  });
});

describe("courseMidnightIso", () => {
  it("is 07:00Z during daylight time", () => {
    expect(courseMidnightIso("2026-10-01")).toBe("2026-10-01T07:00:00.000Z");
  });
  it("is 08:00Z during standard time", () => {
    expect(courseMidnightIso("2026-12-01")).toBe("2026-12-01T08:00:00.000Z");
  });
  it("uses the offset in force at midnight on the day DST ends", () => {
    expect(courseMidnightIso("2026-11-01")).toBe("2026-11-01T07:00:00.000Z");
  });
});

describe("ranges", () => {
  it("adds days across a month end", () => {
    expect(addDays("2026-09-29", 3)).toBe("2026-10-02");
  });
  it("starts the week on Monday", () => {
    const w = weekRange("2026-10-01");
    expect(w.from).toBe("2026-09-28");
    expect(w.to).toBe("2026-10-05");
    expect(w.days).toHaveLength(7);
    expect(w.days[6]).toBe("2026-10-04");
  });
  it("treats a Sunday as the end of its week", () => {
    expect(weekRange("2026-10-04").from).toBe("2026-09-28");
  });
  it("covers the whole month", () => {
    expect(monthRange("2026-10-15")).toEqual({
      from: "2026-10-01",
      to: "2026-11-01",
    });
    expect(monthRange("2026-12-31").to).toBe("2027-01-01");
  });
  it("moves a month without skipping February", () => {
    expect(shiftAnchor("2026-01-31", "month", 1)).toBe("2026-02-01");
  });
  it("moves a week", () => {
    expect(shiftAnchor("2026-10-01", "week", -1)).toBe("2026-09-24");
  });
});

describe("parseScheduleParams", () => {
  it("falls back to this week on garbage", () => {
    expect(parseScheduleParams({ view: "year", d: "nonsense" }, "2026-10-01"))
      .toEqual({ view: "week", day: "2026-10-01" });
  });
  it("rejects an impossible date", () => {
    expect(parseScheduleParams({ d: "2026-02-31" }, "2026-10-01").day).toBe(
      "2026-10-01",
    );
  });
  it("keeps valid input", () => {
    expect(parseScheduleParams({ view: "month", d: "2026-07-04" }, "2026-10-01"))
      .toEqual({ view: "month", day: "2026-07-04" });
  });
});

describe("groupByDay", () => {
  it("groups by Pacific day, in order", () => {
    const g = groupByDay([
      { startsAt: "2026-10-02T06:30:00Z" },
      { startsAt: "2026-10-01T17:00:00Z" },
      { startsAt: "2026-10-02T17:00:00Z" },
    ]);
    expect(g.map((x) => x.day)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(g[0].items.map((i) => i.startsAt)).toEqual([
      "2026-10-01T17:00:00Z",
      "2026-10-02T06:30:00Z",
    ]);
  });
});

describe("seqLabel", () => {
  it("numbers a lesson inside its package", () => {
    expect(
      seqLabel({ seq: 3, packageSize: 5, packageId: "p", status: "completed" }),
    ).toBe("3 of 5");
  });
  it("still numbers a lesson past the package size", () => {
    expect(
      seqLabel({ seq: 6, packageSize: 5, packageId: "p", status: "completed" }),
    ).toBe("6 of 5");
  });
  it("calls a lesson with no package a one-off", () => {
    expect(
      seqLabel({ seq: null, packageSize: null, packageId: null, status: "completed" }),
    ).toBe("one-off");
  });
  it("gives a cancelled lesson no number", () => {
    expect(
      seqLabel({ seq: null, packageSize: 5, packageId: "p", status: "cancelled" }),
    ).toBe("");
  });
});

describe("scaleBars", () => {
  it("draws nothing, not NaN, when every value is zero", () => {
    expect(scaleBars([0, 0], 100)).toEqual([0, 0]);
  });
  it("scales to the tallest bar", () => {
    expect(scaleBars([5, 10], 100)).toEqual([50, 100]);
  });
});

describe("delta", () => {
  it("gives a rounded percentage", () => {
    expect(delta(16, 9)).toEqual({ diff: 7, pct: 78 });
  });
  it("has no percentage against zero", () => {
    expect(delta(5, 0)).toEqual({ diff: 5, pct: null });
  });
});
