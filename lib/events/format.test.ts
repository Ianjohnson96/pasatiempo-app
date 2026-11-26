import { describe, expect, it } from "vitest";
import { factDate, factTime, formatWhen } from "./format";

// Node's ICU may put a narrow no-break space before AM/PM; normalise spaces.
const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("formatWhen", () => {
  it("shows Los Angeles time, whatever the server's time zone", () => {
    const out = norm(formatWhen("2027-06-14T14:30:00Z", null));
    expect(out).toContain("Jun 14");
    expect(out).toContain("7:30 AM");
  });

  it("keeps an evening start on the LA date", () => {
    const out = norm(formatWhen("2027-06-15T02:00:00Z", null));
    expect(out).toContain("Jun 14");
    expect(out).toContain("7:00 PM");
    expect(out).not.toContain("Jun 15");
  });

  it("treats a start and end on the same LA day as one day", () => {
    // 7:00 PM to 10:00 PM on Jun 14 in LA crosses midnight in UTC.
    const out = norm(formatWhen("2027-06-15T02:00:00Z", "2027-06-15T05:00:00Z"));
    expect(out).toContain("Jun 14");
    expect(out).toContain("7:00 PM – 10:00 PM");
    expect(out).not.toContain("Jun 15");
  });

  it("names the end date when the event runs past LA midnight", () => {
    const out = norm(formatWhen("2027-06-15T02:00:00Z", "2027-06-15T08:00:00Z"));
    expect(out).toContain("Jun 14");
    expect(out).toContain("Jun 15 1:00 AM");
  });

  it("says Date TBD with no start", () => {
    expect(formatWhen(null, null)).toBe("Date TBD");
  });
});

describe("fact date and time", () => {
  // 02:00 UTC on Dec 6 is 6:00 PM on Saturday Dec 5 at the club
  it("formats the date in the club's time zone", () => {
    expect(factDate("2026-12-06T02:00:00.000Z")).toBe("Saturday, December 5");
  });
  it("formats the time range in the club's time zone", () => {
    expect(norm(factTime("2026-12-06T02:00:00.000Z", null))).toBe("6:00 PM");
    expect(norm(factTime("2026-12-06T02:00:00.000Z", "2026-12-06T05:30:00.000Z"))).toBe(
      "6:00 PM – 9:30 PM",
    );
  });
});
