// "Add to calendar" for a member's confirmation: one entry per dated session
// they chose (or the event's one date), in the club's wall-clock time.

import { CLUB_TIME_ZONE } from "./format";
import type { EventRec } from "./types";

export interface CalendarEntry {
  title: string;
  start: string; // "YYYYMMDDTHHMMSS" club time, or "YYYYMMDD" when allDay
  end: string; // exclusive end; the next day for an all-day entry
  allDay: boolean;
  location: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

// A wall-clock moment, handled as if it were UTC so arithmetic is plain.
function stamp(d: Date, withTime: boolean): string {
  const date = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  return withTime
    ? `${date}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
    : date;
}

function wall(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "0:0").split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm));
}

/** An instant's wall-clock time at the club. */
function clubWall(iso: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CLUB_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return new Date(
    Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second),
  );
}

const TWO_HOURS = 2 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export function calendarEntries(event: EventRec, slotIds: string[]): CalendarEntry[] {
  const location = event.location ?? "";
  if (event.scheduleMode === "slots") {
    return event.slots
      .filter((s) => slotIds.includes(s.id) && s.date)
      .map((s) => {
        const title = s.label ? `${event.title} — ${s.label}` : event.title;
        if (!s.startTime) {
          const day = wall(s.date!, "");
          return {
            title,
            start: stamp(day, false),
            end: stamp(new Date(day.getTime() + ONE_DAY), false),
            allDay: true,
            location,
          };
        }
        const start = wall(s.date!, s.startTime);
        const end = s.endTime ? wall(s.date!, s.endTime) : new Date(start.getTime() + TWO_HOURS);
        return { title, start: stamp(start, true), end: stamp(end, true), allDay: false, location };
      });
  }
  if (!event.startsAt) return [];
  const start = clubWall(event.startsAt);
  const end = event.endsAt ? clubWall(event.endsAt) : new Date(start.getTime() + TWO_HOURS);
  return [
    { title: event.title, start: stamp(start, true), end: stamp(end, true), allDay: false, location },
  ];
}

export function googleCalendarUrl(e: CalendarEntry): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${e.start}/${e.end}`,
    ctz: CLUB_TIME_ZONE,
  });
  if (e.location) q.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

// RFC 5545 lines fold at 75 octets; continuation lines start with a space.
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

// The club's time zone, so calendars that need a definition (Outlook) agree.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${CLUB_TIME_ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0800",
  "TZOFFSETTO:-0700",
  "TZNAME:PDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0800",
  "TZNAME:PST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** An .ics file for the entries; `uid` makes each event's UID unique and stable. */
export function icsText(entries: CalendarEntry[], uid: string, now = new Date()): string {
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pasatiempo//Event Planner//EN", "CALSCALE:GREGORIAN", ...VTIMEZONE];
  entries.forEach((e, i) => {
    const when = e.allDay
      ? [`DTSTART;VALUE=DATE:${e.start}`, `DTEND;VALUE=DATE:${e.end}`]
      : [`DTSTART;TZID=${CLUB_TIME_ZONE}:${e.start}`, `DTEND;TZID=${CLUB_TIME_ZONE}:${e.end}`];
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}-${i}@events.pasatiempo`,
      `DTSTAMP:${dtstamp}`,
      ...when,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
