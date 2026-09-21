import { redirect } from "next/navigation";
import AvailabilityPlanner, {
  type PlannerDay,
} from "@/components/caddie/AvailabilityPlanner";
import {
  addDays,
  availabilityForRange,
  awayPeriodsFor,
  courseToday,
  getSettings,
  openWorkFor,
  resolveDay,
  usualWeekFor,
} from "@/lib/caddie/data";
import { getCaddieSession } from "@/lib/caddie/session";
import type { DefaultSlot } from "@/lib/caddie/types";

export const dynamic = "force-dynamic";

export default async function CaddieAvailabilityPage() {
  const caddie = await getCaddieSession();
  // The proxy bounces a missing cookie; this covers one that has been revoked
  // or whose caddie is no longer active.
  if (!caddie) redirect("/caddie");

  const settings = await getSettings();
  const tz = settings.courseTimezone;
  const today = courseToday(tz);

  // Months rather than a fortnight — a caddie booking a trip in November needs
  // November to exist on the page.
  const horizon = Math.max(1, settings.availabilityMonths) * 31;
  const last = addDays(today, horizon - 1);

  const [overrides, usual, away, work] = await Promise.all([
    availabilityForRange(caddie.id, today, last),
    usualWeekFor(caddie.id),
    awayPeriodsFor(caddie.id, today),
    openWorkFor(caddie.id),
  ]);

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

  const monthName = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });

  const days: PlannerDay[] = Array.from({ length: horizon }, (_, i) => {
    const date = addDays(today, i);
    // Formatted in UTC from a UTC-midnight instant: the label must be the
    // calendar date itself, not that date shifted into another zone.
    const at = new Date(`${date}T00:00:00Z`);
    const resolved = resolveDay(date, {
      away,
      override: overrides.get(date),
      usual,
    });

    // Compared against the previous day rather than carried in a mutable
    // variable, so the label falls out of the date alone.
    const prev = i === 0 ? null : addDays(today, i - 1);
    const monthLabel =
      !prev || prev.slice(0, 7) !== date.slice(0, 7)
        ? monthName.format(at)
        : "";

    return {
      date,
      weekday: at.getUTCDay(),
      dayNumber: at.getUTCDate(),
      monthLabel,
      isToday: date === today,
      isPast: date < today,
      slot: resolved.slot,
      status: resolved.status,
      source: resolved.source,
      reason: resolved.reason,
      booked: bookedDays.has(date),
    };
  });

  const usualRecord = Object.fromEntries(usual) as Record<number, DefaultSlot>;

  return (
    <AvailabilityPlanner
      caddieName={caddie.fullName}
      usual={usualRecord}
      away={away}
      days={days}
      today={today}
    />
  );
}
