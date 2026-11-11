import { describe, expect, it } from "vitest";
import { dateBoxParts, fillLabel, fillPercent, teamLines } from "./cards";

describe("fillLabel", () => {
  it("counts teams for a tournament", () => {
    expect(fillLabel({ type: "tournament" }, 28, 36)).toBe("28 of 36 teams");
  });
  it("counts spots when capped", () => {
    expect(fillLabel({ type: "dinner" }, 42, 60)).toBe("42 of 60 spots");
  });
  it("says signed up when unlimited", () => {
    expect(fillLabel({ type: "dinner" }, 42, null)).toBe("42 signed up");
  });
});

describe("fillPercent", () => {
  it("rounds, caps at 100, and is 0 when unlimited", () => {
    expect(fillPercent(28, 36)).toBe(78);
    expect(fillPercent(40, 36)).toBe(100);
    expect(fillPercent(5, null)).toBe(0);
  });
});

describe("dateBoxParts", () => {
  const single = (startsAt: string | null) =>
    ({ startsAt, scheduleMode: "single" }) as const;
  it("reads month and day from startsAt", () => {
    const iso = "2026-07-18T18:00:00-07:00";
    expect(dateBoxParts(single(iso), [])).toEqual({ month: "Jul", day: "18" });
  });
  it("uses the club's (Los Angeles) date, not the server's", () => {
    // 02:00 UTC on Jun 15 is 7:00 PM on Jun 14 in California.
    expect(dateBoxParts(single("2027-06-15T02:00:00Z"), [])).toEqual({
      month: "Jun",
      day: "14",
    });
  });
  it("is null with no date at all", () => {
    expect(dateBoxParts(single(null), [])).toBeNull();
    expect(dateBoxParts(single(null), [{ date: null }])).toBeNull();
  });
  it("uses the earliest dated slot for a slots event", () => {
    const ev = { startsAt: null, scheduleMode: "slots" } as const;
    expect(
      dateBoxParts(ev, [{ date: "2026-08-21" }, { date: null }, { date: "2026-08-07" }]),
    ).toEqual({ month: "Aug", day: "7" });
  });
});

describe("teamLines", () => {
  const reg = (status: string, m: string, g?: string) =>
    ({
      status, name: m,
      players: g
        ? [
            { role: "member", name: m, email: "m@x.com", ghin: "1234567", answers: {} },
            { role: "guest", name: g, email: "g@x.com", ghin: "7654321", answers: {} },
          ]
        : null,
    }) as never;
  it("lists confirmed teams as member & guest, names only", () => {
    const out = teamLines(
      [reg("confirmed", "Ann Smith", "Bob Jones"), reg("waitlist", "No Body", "Wait Er"), reg("cancelled", "X Y", "Z W")],
      "first_last",
    );
    expect(out).toEqual(["Ann Smith & Bob Jones"]);
  });
  it("honours first-initial style", () => {
    expect(teamLines([reg("confirmed", "Ann Smith", "Bob Jones")], "first_initial")).toEqual(["Ann S. & Bob J."]);
  });
});
