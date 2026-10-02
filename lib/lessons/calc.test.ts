import { describe, expect, it } from "vitest";
import {
  addDays,
  aliasClash,
  cleanAliases,
  courseDay,
  courseMidnightIso,
  delta,
  groupByDay,
  courseLocalIso,
  isUuid,
  matchExisting,
  monthRange,
  parseDollars,
  parseScheduleParams,
  scaleBars,
  seqLabel,
  shiftAnchor,
  suggestForPackage,
  undoGroups,
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
  it("rejects a year the date maths cannot reach", () => {
    // monthRange(9999-12) would step into year 10000 and throw.
    expect(parseScheduleParams({ d: "9999-12-15" }, "2026-10-01").day).toBe(
      "2026-10-01",
    );
    expect(parseScheduleParams({ d: "1066-10-14" }, "2026-10-01").day).toBe(
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

describe("parseDollars", () => {
  it("reads a price", () => {
    expect(parseDollars("120")).toEqual({ ok: true, cents: 12000 });
    expect(parseDollars(" 87.5 ")).toEqual({ ok: true, cents: 8750 });
  });
  it("treats blank as no price, not $0", () => {
    expect(parseDollars("")).toEqual({ ok: true, cents: null });
    expect(parseDollars(null)).toEqual({ ok: true, cents: null });
  });
  it("refuses a negative or non-numeric price", () => {
    expect(parseDollars(-5).ok).toBe(false);
    expect(parseDollars("abc").ok).toBe(false);
    expect(parseDollars(Infinity).ok).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts a client id and refuses anything else", () => {
    expect(isUuid("4a8735af-9be2-4e60-babf-c10a8ccd3e31")).toBe(true);
    expect(isUuid("not-an-id")).toBe(false);
    expect(isUuid("4a8735af-9be2-4e60-babf-c10a8ccd3e3")).toBe(false);
  });
});

describe("suggestForPackage", () => {
  const L = (id: string, startsAt: string, status = "completed", packageId: string | null = null) => ({
    id,
    startsAt,
    status,
    packageId,
  });
  const pkg = { id: "p", size: 3, soldOn: "2026-06-01" };

  it("fills the package's room with the oldest unassigned lessons from the sale on", () => {
    const lessons = [
      L("in", "2026-06-02T17:00:00Z", "completed", "p"), // already 1 of 3
      L("c", "2026-06-20T17:00:00Z"),
      L("a", "2026-06-05T17:00:00Z"),
      L("b", "2026-06-10T17:00:00Z"),
    ];
    expect(suggestForPackage(pkg, lessons)).toEqual(["a", "b"]);
  });

  it("skips cancelled lessons, other packages' lessons and lessons before the sale", () => {
    const lessons = [
      L("before", "2026-06-01T05:00:00Z"), // 10pm May 31 Pacific
      L("x", "2026-06-03T17:00:00Z", "cancelled"),
      L("other", "2026-06-04T17:00:00Z", "completed", "q"),
      L("ok", "2026-06-05T17:00:00Z", "scheduled"),
    ];
    expect(suggestForPackage(pkg, lessons)).toEqual(["ok"]);
  });

  it("suggests nothing for a full package", () => {
    const full = ["1", "2", "3"].map((i) =>
      L(i, `2026-06-0${i}T17:00:00Z`, "completed", "p"),
    );
    expect(suggestForPackage(pkg, [...full, L("z", "2026-06-09T17:00:00Z")])).toEqual([]);
  });

  it("with no sale date, starts from the package's own first lesson", () => {
    // Seeded packages have no sold_on; lessons before the series began are
    // somebody else's story.
    const lessons = [
      L("before", "2025-03-01T17:00:00Z"),
      L("first", "2026-02-01T17:00:00Z", "completed", "p"),
      L("after", "2026-03-01T17:00:00Z"),
    ];
    expect(suggestForPackage({ ...pkg, soldOn: null }, lessons)).toEqual(["after"]);
  });

  it("uses every unassigned lesson when there is no date to go on at all", () => {
    const lessons = [L("old", "2025-03-01T17:00:00Z"), L("new", "2026-03-01T17:00:00Z")];
    expect(suggestForPackage({ ...pkg, soldOn: null }, lessons)).toEqual(["old", "new"]);
  });
});

describe("matchExisting", () => {
  const at = "2026-06-05T17:00:00Z";
  const C = (id: string, clientName: string, startsAt = at, calendarUid: string | null = null) => ({
    id,
    clientName,
    startsAt,
    calendarUid,
  });

  it("links to the one un-linked lesson at the same moment", () => {
    expect(
      matchExisting({ startsAt: at, titleRaw: "Adrian Moreno lesson +wife" }, [
        C("a", "Adrian Moreno"),
        C("other-time", "Adrian Moreno", "2026-06-06T17:00:00Z"),
      ]),
    ).toBe("a");
  });

  it("never re-links a lesson that already has a calendar entry", () => {
    expect(
      matchExisting({ startsAt: at, titleRaw: "x" }, [C("a", "X", at, "uid-1")]),
    ).toBeNull();
  });

  it("picks the client named in the title when two lessons share the moment", () => {
    expect(
      matchExisting(
        { startsAt: "2026-06-05T17:00:00.000Z", titleRaw: "Hoffman kids group lesson 4 [Nico]" },
        [C("m", "Meredith Hoffman"), C("k", "Hoffman kids group")],
      ),
    ).toBe("k");
  });

  it("refuses to guess between two lessons the title does not tell apart", () => {
    expect(
      matchExisting({ startsAt: at, titleRaw: "group lesson" }, [C("a", "Ann"), C("b", "Bob")]),
    ).toBeNull();
  });
});

describe("courseLocalIso", () => {
  it("turns a Pacific wall time into the right instant", () => {
    expect(courseLocalIso("2026-10-01", "14:30")).toBe("2026-10-01T21:30:00.000Z");
  });
  it("uses the offset after the change on DST days", () => {
    expect(courseLocalIso("2026-11-01", "10:00")).toBe("2026-11-01T18:00:00.000Z");
    expect(courseLocalIso("2026-03-08", "10:00")).toBe("2026-03-08T17:00:00.000Z");
  });
  it("refuses a malformed time", () => {
    expect(() => courseLocalIso("2026-10-01", "25:00")).toThrow();
  });
});

describe("cleanAliases", () => {
  it("trims, drops blanks, repeats and the client's own name", () => {
    expect(cleanAliases(["  Max ", "max", "", "Max Miceli", "M. Miceli"], "Max Miceli")).toEqual([
      "Max",
      "M. Miceli",
    ]);
  });
});

describe("aliasClash", () => {
  const others = [
    { id: "a", name: "Patsy Leung", aliases: ["Patsy"] },
    { id: "b", name: "Max Miceli", aliases: [] },
  ];
  it("refuses a spelling that is another client's name", () => {
    expect(aliasClash(["max miceli"], "me", others)).toMatch(/Max Miceli/);
  });
  it("refuses a spelling another client already uses", () => {
    expect(aliasClash(["PATSY"], "me", others)).toMatch(/Patsy Leung/);
  });
  it("ignores the client's own record", () => {
    expect(aliasClash(["Patsy"], "a", others)).toBeNull();
  });
  it("allows a new spelling", () => {
    expect(aliasClash(["Jonny D"], "me", others)).toBeNull();
  });
});

describe("undoGroups", () => {
  it("groups moved lessons by where each one came from", () => {
    const groups = undoGroups({ a: "p1", b: null, c: "p1", d: "p2" });
    expect(groups).toEqual(
      expect.arrayContaining([
        { packageId: "p1", lessonIds: ["a", "c"] },
        { packageId: null, lessonIds: ["b"] },
        { packageId: "p2", lessonIds: ["d"] },
      ]),
    );
    expect(groups).toHaveLength(3);
  });
});
