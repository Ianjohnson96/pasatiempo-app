"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAvailability, type AvailabilityChoice } from "@/lib/caddie/actions";

// The caddie tells the shop which days they can work.
//
// Two weeks, one row per day, four taps. No save button: each tap writes
// straight away and the row shows its own state, because a caddie filling this
// in on a phone should never wonder whether it took.

export interface CalendarDay {
  date: string; // "yyyy-mm-dd"
  weekday: string; // "Mon"
  dayLabel: string; // "Sep 21"
  isToday: boolean;
  /** What they have already said, or null if they have not answered. */
  choice: Exclude<AvailabilityChoice, "Clear"> | null;
  /** They already hold an accepted loop that day. */
  booked: boolean;
}

const OPTIONS: { key: Exclude<AvailabilityChoice, "Clear">; label: string }[] = [
  { key: "AM", label: "AM" },
  { key: "PM", label: "PM" },
  { key: "All Day", label: "All day" },
  { key: "Off", label: "Off" },
];

export default function AvailabilityCalendar({
  days,
  caddieName,
}: {
  days: CalendarDay[];
  caddieName: string;
}) {
  const router = useRouter();
  const [saving, start] = useTransition();
  // Which row is mid-write, so only that row dims rather than the whole page.
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Tapping the choice you already have clears it — back to "not answered",
  // which the shop reads differently from a deliberate "Off".
  function choose(day: CalendarDay, key: Exclude<AvailabilityChoice, "Clear">) {
    const next: AvailabilityChoice = day.choice === key ? "Clear" : key;
    setError(null);
    setPendingDate(day.date);
    start(async () => {
      const res = await setAvailability(day.date, next);
      setPendingDate(null);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  const answered = days.filter((d) => d.choice).length;

  return (
    <main
      className="container narrow"
      style={{ maxWidth: 520, paddingTop: 24, paddingBottom: 48 }}
    >
      <p className="eyebrow" style={{ marginBottom: 2 }}>
        Pasatiempo Caddies
      </p>
      <h1 style={{ fontSize: 26, margin: 0 }}>Your availability</h1>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {caddieName} · {answered} of {days.length} days answered
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
        Tap the part of the day you can work. Tap it again to go back to no
        answer. Saved as you go.
      </p>

      {error && (
        <p className="notice err" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}

      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
        {days.map((day, i) => {
          const rowBusy = saving && pendingDate === day.date;
          return (
            <Fragment key={day.date}>
            {/* A month of rows reads as one wall without a break in it. */}
            {i > 0 && i % 7 === 0 && (
              <div
                className="muted"
                style={{
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: "1px solid var(--line)",
                }}
              >
                {i === 7 ? "Next week" : `In ${i / 7} weeks`}
              </div>
            )}
            <div
              className="card"
              style={{
                padding: "10px 12px",
                opacity: rowBusy ? 0.55 : 1,
                borderColor: day.isToday ? "var(--accent)" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 38 }}>
                  {day.weekday}
                </span>
                <span className="muted">{day.dayLabel}</span>
                {day.isToday && <span className="badge open">today</span>}
                {day.booked && <span className="badge gray">on a loop</span>}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {OPTIONS.map((opt) => {
                  const on = day.choice === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={saving}
                      onClick={() => choose(day, opt.key)}
                      aria-pressed={on}
                      className={
                        on
                          ? opt.key === "Off"
                            ? "btn danger small"
                            : "btn small"
                          : "btn secondary small"
                      }
                      style={{ flex: 1 }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            </Fragment>
          );
        })}
      </div>

      <p style={{ marginTop: 28 }}>
        <Link href="/caddie">← Back to your loops</Link>
      </p>
    </main>
  );
}
