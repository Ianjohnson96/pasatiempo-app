import { describe, expect, test } from "vitest";
import { calendarEntries, googleCalendarUrl, icsText } from "./calendar";
import type { EventRec, Slot } from "./types";

const slot = (over: Partial<Slot>): Slot => ({
  id: "s1",
  date: "2026-09-04",
  startTime: "16:00",
  endTime: "17:30",
  label: "",
  note: "",
  capacity: 8,
  ...over,
});

const ev = (over: Partial<EventRec> = {}) =>
  ({
    slug: "dinner",
    title: "Member Dinner",
    location: "Hollins House",
    scheduleMode: "single",
    startsAt: null,
    endsAt: null,
    slots: [],
    ...over,
  }) as EventRec;

describe("calendarEntries", () => {
  test("a single-date event is one timed entry in club time", () => {
    // 02:00 UTC on Dec 6 is 6:00 PM on Dec 5 in Los Angeles
    const [e, ...rest] = calendarEntries(ev({ startsAt: "2026-12-06T02:00:00.000Z" }), []);
    expect(rest).toEqual([]);
    expect(e).toEqual({
      title: "Member Dinner",
      start: "20261205T180000",
      end: "20261205T200000", // no end given: two hours
      allDay: false,
      location: "Hollins House",
    });
  });

  test("an end time is used when there is one", () => {
    const [e] = calendarEntries(
      ev({ startsAt: "2026-12-06T02:00:00.000Z", endsAt: "2026-12-06T05:30:00.000Z" }),
      [],
    );
    expect(e.end).toBe("20261205T213000");
  });

  test("slots: only the chosen, dated ones", () => {
    const e = ev({
      scheduleMode: "slots",
      slots: [
        slot({ id: "a" }),
        slot({ id: "b", date: "2026-09-11", label: "Putting" }),
        slot({ id: "c", date: null }),
        slot({ id: "d", date: "2026-09-18" }),
      ],
    });
    const entries = calendarEntries(e, ["a", "b", "c"]);
    expect(entries.map((x) => x.start)).toEqual(["20260904T160000", "20260911T160000"]);
    expect(entries[1].title).toBe("Member Dinner — Putting");
  });

  test("a slot with no start time is an all-day entry", () => {
    const [e] = calendarEntries(
      ev({ scheduleMode: "slots", slots: [slot({ startTime: "", endTime: "" })] }),
      ["s1"],
    );
    expect(e).toMatchObject({ allDay: true, start: "20260904", end: "20260905" });
  });

  test("an event with no date has nothing to add", () => {
    expect(calendarEntries(ev(), [])).toEqual([]);
  });
});

describe("icsText", () => {
  const entries = [
    { title: "Lunch, wine; fun", start: "20261205T180000", end: "20261205T200000", allDay: false, location: "Hollins House" },
    { title: "Clinic", start: "20260904", end: "20260905", allDay: true, location: "" },
  ];
  const ics = icsText(entries, "reg-1");

  test("is a calendar with one event per entry and CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });

  test("timed entries carry the club's time zone; all-day ones are dates", () => {
    expect(ics).toContain("DTSTART;TZID=America/Los_Angeles:20261205T180000");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260904");
  });

  test("escapes commas and semicolons in text", () => {
    expect(ics).toContain("SUMMARY:Lunch\\, wine\\; fun");
  });

  test("gives every event a distinct UID", () => {
    const uids = ics.split("\r\n").filter((l) => l.startsWith("UID:"));
    expect(new Set(uids).size).toBe(2);
  });
});

describe("googleCalendarUrl", () => {
  test("fills a Google Calendar template in club time", () => {
    const u = new URL(
      googleCalendarUrl({ title: "Member Dinner", start: "20261205T180000", end: "20261205T200000", allDay: false, location: "Hollins House" }),
    );
    expect(u.origin + u.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("text")).toBe("Member Dinner");
    expect(u.searchParams.get("dates")).toBe("20261205T180000/20261205T200000");
    expect(u.searchParams.get("ctz")).toBe("America/Los_Angeles");
    expect(u.searchParams.get("location")).toBe("Hollins House");
  });
});
