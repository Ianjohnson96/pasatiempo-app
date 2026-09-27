import { describe, expect, it } from "vitest";
import { ITEMS, openPeriods, pacificToday, periodStatus, remindersFor, upcoming } from "./schedule";

const keys = (today: string) => openPeriods(today).map((p) => p.key);
const all = (items: { k: string }[]) => Object.fromEntries(items.map((i) => [i.k, true]));

describe("report schedule", () => {
  it("shows this week and the month-end from three days before the last day", () => {
    expect(keys("2026-09-26")).toEqual(["2026-08", "wk-2026-09-21"]); // August's is still open, and overdue
    expect(keys("2026-09-27")).toEqual(["wk-2026-09-21", "2026-09"]);
    expect(keys("2026-09-30")).toEqual(["wk-2026-09-28", "2026-09"]);
  });

  it("keeps a month-end open through the next month until the following one opens", () => {
    expect(keys("2026-10-15")).toContain("2026-09");
    expect(keys("2026-10-27")).toContain("2026-09");
    expect(keys("2026-10-28")).not.toContain("2026-09");
    expect(keys("2026-10-28")).toContain("2026-10");
  });

  it("adds the quarterly count at quarter end, the buying reviews in Aug/Nov/Feb, and year-end around Apr 30", () => {
    expect(keys("2026-10-31")).toContain("q-2026-10");
    expect(keys("2026-11-05")).toEqual(expect.arrayContaining(["q-2026-10", "season-2026-11", "2026-10"]));
    expect(keys("2027-02-01")).toContain("season-2027-02");
    expect(keys("2027-04-23")).toContain("fy-2027");
    expect(keys("2027-04-22")).not.toContain("fy-2027");
    expect(keys("2027-01-31")).toContain("q-2027-01");
  });

  it("wraps year boundaries", () => {
    expect(keys("2027-01-02")).toContain("2026-12");
    expect(openPeriods("2027-01-02").find((p) => p.key === "2026-12")?.late).toBe("2027-01-04");
  });

  it("is upcoming, then due, then overdue, until everything is ticked", () => {
    const p = openPeriods("2026-09-27").find((x) => x.key === "2026-09")!;
    expect(periodStatus(p, {}, "2026-09-28")).toBe("upcoming");
    expect(periodStatus(p, {}, "2026-09-30")).toBe("due");
    expect(periodStatus(p, { sku: true }, "2026-10-03")).toBe("due");
    expect(periodStatus(p, { sku: true }, "2026-10-04")).toBe("overdue");
    expect(periodStatus(p, all(ITEMS.monthly), "2026-10-10")).toBe("done");
  });

  it("reminds on the set days only, and not once everything is ticked", () => {
    expect(remindersFor("2026-09-27", {}).map((r) => r.period.key)).toEqual(["2026-09"]);
    expect(remindersFor("2026-09-28", {}).map((r) => r.period.key)).toEqual(["wk-2026-09-28"]);
    expect(remindersFor("2026-09-29", {})).toEqual([]);
    // Sep 30, 2026 is a Wednesday: the week's "still to do" reminder goes out with the month-end one.
    expect(remindersFor("2026-09-30", {}).map((r) => r.period.key)).toEqual(["wk-2026-09-28", "2026-09"]);
    expect(remindersFor("2026-10-04", { "2026-09": all(ITEMS.monthly) })).toEqual([]);
    const left = remindersFor("2026-10-04", { "2026-09": { sku: true, daily: true } })[0];
    expect(left.status).toBe("overdue");
    expect(left.left.map((i) => i.k)).not.toContain("sku");
  });

  it("lists the next checklist of each rhythm", () => {
    expect(upcoming("2026-09-27").map((p) => `${p.cadence} ${p.due}`)).toEqual([
      "weekly 2026-09-28",
      "monthly 2026-10-31",
      "quarterly 2026-11-10",
      "seasonal 2026-11-15",
      "yearly 2027-04-30",
    ]);
  });

  it("uses the Pacific date", () => {
    expect(pacificToday(new Date("2026-10-01T03:00:00Z"))).toBe("2026-09-30");
    expect(pacificToday(new Date("2026-10-01T15:00:00Z"))).toBe("2026-10-01");
  });
});
