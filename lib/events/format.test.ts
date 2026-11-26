import { describe, expect, it } from "vitest";
import { factDate, factTime, formatPhone, formatWhen, rosterName, shownAnswer } from "./format";

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

describe("formatPhone", () => {
  it("a 10-digit US number reads (xxx) xxx-xxxx", () => {
    expect(formatPhone("3868487621")).toBe("(386) 848-7621");
    expect(formatPhone("831.555.0100")).toBe("(831) 555-0100");
  });
  it("an 11-digit number with a leading 1 drops the 1", () => {
    expect(formatPhone("18177134704")).toBe("(817) 713-4704");
    expect(formatPhone("+1 817 713 4704")).toBe("(817) 713-4704");
  });
  it("anything else is left as typed", () => {
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone("555-0100")).toBe("555-0100");
    expect(formatPhone("")).toBe("");
  });
});

describe("rosterName", () => {
  it("capitalizes the last initial even when typed in lower case", () => {
    expect(rosterName("Ian johnson", "first_initial")).toBe("Ian J.");
    expect(rosterName("cary johnson", "first_initial")).toBe("Cary J.");
  });
  it("leaves full names as typed", () => {
    expect(rosterName("Ian johnson", "first_last")).toBe("Ian johnson");
  });
});

describe("shownAnswer", () => {
  const f = (type: string) => ({ type }) as never;
  it("a yes/no box reads Yes or No, never blank", () => {
    expect(shownAnswer(f("checkbox"), "Yes")).toBe("Yes");
    expect(shownAnswer(f("checkbox"), "")).toBe("No");
    expect(shownAnswer(f("checkbox"), undefined)).toBe("No");
  });
  it("anything else reads as typed or chosen", () => {
    expect(shownAnswer(f("short_text"), "Vegetarian")).toBe("Vegetarian");
    expect(shownAnswer(f("multi"), ["A", "B"])).toBe("A, B");
    expect(shownAnswer(f("short_text"), undefined)).toBe("");
  });
});
