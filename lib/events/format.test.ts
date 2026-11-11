import { describe, expect, it } from "vitest";
import { formatWhen } from "./format";

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
