import "@/app/globals.css";
import { redirect } from "next/navigation";
import AvailabilityCalendar, {
  type CalendarDay,
} from "@/components/caddie/AvailabilityCalendar";
import {
  addDays,
  availabilityForRange,
  courseToday,
  getSettings,
  openWorkFor,
} from "@/lib/caddie/data";
import { getCaddieSession } from "@/lib/caddie/session";

// A month out, in whole weeks so the list groups cleanly. Caddies plan around
// weekends, and a fortnight was not far enough to reach the one they care about.
const HORIZON_DAYS = 35;

export const dynamic = "force-dynamic";

export default async function CaddieAvailabilityPage() {
  const caddie = await getCaddieSession();
  // The proxy already bounces a missing cookie; this covers a cookie whose
  // session has been revoked or whose caddie is no longer active.
  if (!caddie) redirect("/caddie");

  const settings = await getSettings();
  const tz = settings.courseTimezone;
  const today = courseToday(tz);
  const last = addDays(today, HORIZON_DAYS - 1);

  const [submitted, work] = await Promise.all([
    availabilityForRange(caddie.id, today, last),
    openWorkFor(caddie.id),
  ]);

  // Days they are already committed to, so the calendar can flag a clash
  // before they mark themselves off.
  const courseDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const bookedDays = new Set(
    work
      .filter((w) => w.assignment.confirmationStatus === "Accepted")
      .map((w) => courseDate.format(new Date(w.loop.teeTime))),
  );

  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  });
  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });

  const days: CalendarDay[] = Array.from({ length: HORIZON_DAYS }, (_, i) => {
    const date = addDays(today, i);
    // Formatted in UTC from a UTC-midnight instant: the label must be the
    // calendar date itself, not that date shifted into another zone.
    const at = new Date(`${date}T00:00:00Z`);
    const entry = submitted.get(date);

    return {
      date,
      weekday: weekday.format(at),
      dayLabel: dayLabel.format(at),
      isToday: date === today,
      choice: entry
        ? entry.status === "Unavailable"
          ? "Off"
          : entry.slot
        : null,
      booked: bookedDays.has(date),
    };
  });

  return <AvailabilityCalendar days={days} caddieName={caddie.fullName} />;
}
