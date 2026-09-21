"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addAwayPeriod,
  removeAwayPeriod,
  setAvailability,
  setUsualDay,
  type AvailabilityChoice,
} from "@/lib/caddie/actions";
import type { AwayPeriod, DefaultSlot } from "@/lib/caddie/types";

// Telling the shop when you can work, months ahead.
//
// Ninety taps is not a plan, so this asks for the two things that actually
// describe a caddie's life — the week they usually work, and the weeks they are
// gone — and then only wants taps for the exceptions.

export interface PlannerDay {
  date: string; // "yyyy-mm-dd"
  weekday: number;
  dayNumber: number;
  /** Set on the first day of each month, to break the list up. */
  monthLabel: string;
  isToday: boolean;
  isPast: boolean;
  slot: "AM" | "PM" | "All Day" | null;
  status: "Available" | "Unavailable" | "Pending" | "Unknown";
  source: "away" | "day" | "usual" | "none";
  reason?: string;
  booked: boolean;
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SLOT_CHOICES: { key: DefaultSlot; label: string }[] = [
  { key: "AM", label: "AM" },
  { key: "PM", label: "PM" },
  { key: "All Day", label: "All day" },
  { key: "Off", label: "Off" },
];

export default function AvailabilityPlanner({
  caddieName,
  usual,
  away,
  days,
  today,
}: {
  caddieName: string;
  /** weekday -> standing slot; a missing key means never said. */
  usual: Record<number, DefaultSlot>;
  away: AwayPeriod[];
  days: PlannerDay[];
  today: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"week" | "away" | "days">("week");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  const upcomingAway = away.filter((a) => a.endsOn >= today);
  const answered = days.filter((d) => d.source !== "none").length;

  return (
    <main
      className="container narrow"
      style={{ maxWidth: 560, paddingTop: 24, paddingBottom: 48 }}
    >
      <p className="eyebrow" style={{ marginBottom: 2 }}>
        Pasatiempo Caddies
      </p>
      <h1 style={{ fontSize: 26, margin: 0 }}>Your availability</h1>
      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        {caddieName} · {answered} of {days.length} days answered
      </div>

      {error && (
        <p className="notice err" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}

      <div className="seg" style={{ marginTop: 18 }}>
        <button
          className={tab === "week" ? "segbtn on" : "segbtn"}
          onClick={() => setTab("week")}
        >
          Usual week
        </button>
        <button
          className={tab === "away" ? "segbtn on" : "segbtn"}
          onClick={() => setTab("away")}
        >
          Time away{upcomingAway.length > 0 && ` (${upcomingAway.length})`}
        </button>
        <button
          className={tab === "days" ? "segbtn on" : "segbtn"}
          onClick={() => setTab("days")}
        >
          Day by day
        </button>
      </div>

      {tab === "week" && (
        <section style={{ marginTop: 18 }}>
          <p className="muted" style={{ fontSize: 14 }}>
            Set this once and it applies to every week from now on. You can
            still change any single day on the Day by day tab.
          </p>

          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {WEEKDAYS.map((label, weekday) => {
              const current = usual[weekday];
              return (
                <div
                  key={weekday}
                  className="card"
                  style={{ padding: "10px 12px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    {!current && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        not set
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {SLOT_CHOICES.map((opt) => {
                      const on = current === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          disabled={busy}
                          aria-pressed={on}
                          aria-label={`${label}: ${opt.label}`}
                          className={
                            on
                              ? opt.key === "Off"
                                ? "btn danger small"
                                : "btn small"
                              : "btn secondary small"
                          }
                          style={{ flex: 1 }}
                          onClick={() =>
                            run(() => setUsualDay(weekday, on ? null : opt.key))
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "away" && (
        <section style={{ marginTop: 18 }}>
          <p className="muted" style={{ fontSize: 14 }}>
            Going away? Put the dates in once. You will not be offered loops
            between them, whatever your usual week says.
          </p>

          <AwayForm
            busy={busy}
            today={today}
            onSubmit={(v) => run(() => addAwayPeriod(v))}
          />

          {upcomingAway.length === 0 ? (
            <p className="muted" style={{ marginTop: 16 }}>
              Nothing booked.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
              {upcomingAway.map((a) => (
                <div
                  key={a.id}
                  className="card"
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <span>
                    <strong>{formatRange(a.startsOn, a.endsOn)}</strong>
                    {a.reason && <span className="muted"> · {a.reason}</span>}
                  </span>
                  <button
                    className="btn ghost small"
                    disabled={busy}
                    onClick={() => run(() => removeAwayPeriod(a.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "days" && (
        <section style={{ marginTop: 18 }}>
          <p className="muted" style={{ fontSize: 14 }}>
            Every day for the next few months. Days you have not touched follow
            your usual week; tap to change just that one.
          </p>

          <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
            {days.map((day) => (
              <Fragment key={day.date}>
                {day.monthLabel && (
                  <h2
                    className="section-title"
                    style={{ marginTop: 18, marginBottom: 2 }}
                  >
                    {day.monthLabel}
                  </h2>
                )}
                <DayRow
                  day={day}
                  busy={busy}
                  onSet={(c) => run(() => setAvailability(day.date, c))}
                />
              </Fragment>
            ))}
          </div>
        </section>
      )}

      <p style={{ marginTop: 28 }}>
        <Link href="/caddie">← Back to your loops</Link>
      </p>
    </main>
  );
}

function DayRow({
  day,
  busy,
  onSet,
}: {
  day: PlannerDay;
  busy: boolean;
  onSet: (choice: AvailabilityChoice) => void;
}) {
  // Away days are not editable here — the period owns them, and letting a tap
  // half-override a holiday is how you end up on a tee sheet from Mexico.
  const locked = day.source === "away";

  return (
    <div
      className="card"
      style={{
        padding: "8px 10px",
        opacity: day.isPast ? 0.5 : 1,
        borderColor: day.isToday ? "var(--accent)" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: locked ? 0 : 8,
        }}
      >
        <span style={{ fontWeight: 600, minWidth: 34 }}>{day.dayNumber}</span>
        <span className="muted" style={{ minWidth: 38 }}>
          {WEEKDAYS[day.weekday].slice(0, 3)}
        </span>
        {day.isToday && <span className="badge open">today</span>}
        {day.booked && <span className="badge gray">on a loop</span>}
        {locked && (
          <span className="badge closed">
            Away{day.reason ? ` · ${day.reason}` : ""}
          </span>
        )}
        {!locked && day.source === "usual" && (
          <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
            usual week
          </span>
        )}
      </div>

      {!locked && (
        <div style={{ display: "flex", gap: 6 }}>
          {SLOT_CHOICES.map((opt) => {
            const on =
              opt.key === "Off"
                ? day.status === "Unavailable"
                : day.status === "Available" && day.slot === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={busy}
                aria-pressed={on}
                aria-label={`${day.date}: ${opt.label}`}
                className={
                  on
                    ? opt.key === "Off"
                      ? "btn danger small"
                      : "btn small"
                    : "btn secondary small"
                }
                style={{
                  flex: 1,
                  // A day merely following the pattern is shown, not asserted.
                  opacity: on && day.source === "usual" ? 0.75 : 1,
                }}
                onClick={() =>
                  onSet(
                    on && day.source === "day"
                      ? "Clear"
                      : (opt.key as AvailabilityChoice),
                  )
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AwayForm({
  busy,
  today,
  onSubmit,
}: {
  busy: boolean;
  today: string;
  onSubmit: (v: { startsOn: string; endsOn: string; reason: string }) => void;
}) {
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [reason, setReason] = useState("");

  return (
    <form
      className="card"
      style={{ marginTop: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ startsOn, endsOn, reason });
        setReason("");
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <label style={{ flex: "1 1 130px" }}>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
            From
          </div>
          <input
            type="date"
            value={startsOn}
            required
            onChange={(e) => {
              setStartsOn(e.target.value);
              if (e.target.value > endsOn) setEndsOn(e.target.value);
            }}
            style={{ ...inputStyle, width: "100%" }}
          />
        </label>
        <label style={{ flex: "1 1 130px" }}>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
            To (included)
          </div>
          <input
            type="date"
            value={endsOn}
            min={startsOn}
            required
            onChange={(e) => setEndsOn(e.target.value)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </label>
        <label style={{ flex: "1 1 150px" }}>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
            Reason (optional)
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Holiday"
            style={{ ...inputStyle, width: "100%" }}
          />
        </label>
        <button className="btn" type="submit" disabled={busy}>
          Add
        </button>
      </div>
    </form>
  );
}

/** "Oct 3 – 17" within a month, "Sep 28 – Oct 4" across one. */
function formatRange(startsOn: string, endsOn: string): string {
  const fmt = (d: string, withMonth: boolean) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      day: "numeric",
      ...(withMonth ? { month: "short" } : {}),
    }).format(new Date(`${d}T00:00:00Z`));

  if (startsOn === endsOn) return fmt(startsOn, true);
  // The month belongs on the first date; repeating it on the second only
  // helps when the range actually crosses into a new one.
  const sameMonth = startsOn.slice(0, 7) === endsOn.slice(0, 7);
  return `${fmt(startsOn, true)} – ${fmt(endsOn, !sameMonth)}`;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 15,
};
