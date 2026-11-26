import { describe, expect, test } from "vitest";
import { pageSettings } from "./page-settings";
import { parseTheme } from "./theme";

describe("parseTheme: page settings", () => {
  test("keeps trimmed wording and drops blanks", () => {
    const t = parseTheme({
      preset: "clubhouse",
      buttonLabel: "  RSVP  ",
      kicker: "   ",
      headings: { about: " The day ", info: "", register: 7 },
    });
    expect(t?.buttonLabel).toBe("RSVP");
    expect(t?.kicker).toBeUndefined();
    expect(t?.headings).toEqual({ about: "The day" });
  });
  test("cuts over-long wording to its limit", () => {
    const t = parseTheme({ preset: "clubhouse", buttonLabel: "x".repeat(60), kicker: "y".repeat(90) });
    expect(t?.buttonLabel).toHaveLength(28);
    expect(t?.kicker).toHaveLength(40);
  });
  test("hero style must be one of the three", () => {
    expect(parseTheme({ preset: "clubhouse", heroStyle: "banner" })?.heroStyle).toBe("banner");
    expect(parseTheme({ preset: "clubhouse", heroStyle: "huge" })?.heroStyle).toBeUndefined();
  });
  test("hideSpots only when true", () => {
    expect(parseTheme({ preset: "clubhouse", hideSpots: true })?.hideSpots).toBe(true);
    expect(parseTheme({ preset: "clubhouse", hideSpots: "yes" })?.hideSpots).toBeUndefined();
  });
});

describe("pageSettings", () => {
  test("no theme gives today's page", () => {
    expect(pageSettings({ type: "dinner", theme: null })).toEqual({
      kicker: "Dinner / Social",
      buttonLabel: "Register now",
      heroStyle: "photo",
      showSpots: true,
      headings: {
        about: "About this event",
        info: "What you need to know",
        register: "Register",
      },
    });
  });
  test("the event's own wording wins", () => {
    const s = pageSettings({
      type: "tournament",
      theme: {
        preset: "invitational",
        buttonLabel: "Enter your team",
        kicker: "Since 1952",
        heroStyle: "plain",
        hideSpots: true,
        headings: { register: "Enter" },
      },
    });
    expect(s.kicker).toBe("Since 1952");
    expect(s.buttonLabel).toBe("Enter your team");
    expect(s.heroStyle).toBe("plain");
    expect(s.showSpots).toBe(false);
    expect(s.headings).toEqual({
      about: "About this event",
      info: "What you need to know",
      register: "Enter",
    });
  });
});
