import Link from "next/link";
import { requireCaddieStaff } from "@/lib/caddie/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import {
  addDays,
  courseToday,
  getSettings,
  loopsBetweenByDay,
} from "@/lib/caddie/data";

// The month at a glance: where the open jobs are.
//
// The dispatch board answers "what is happening today". This answers "which
// days still need caddies", which is the question you ask on a Tuesday looking
// at the weekend. Every cell links into that day's board, so posting forward is
// click-the-day rather than navigate-then-add.
export const dynamic = "force-dynamic";

/** "yyyy-mm" -> the first of that month, or today's month if malformed. */
function monthStart(month: string | undefined, today: string): string {
  return /^\d{4}-\d{2}$/.test(month ?? "")
    ? `${month}-01`
    : `${today.slice(0, 7)}-01`;
}

/** "7:00 AM" -> "7a", "2:10 PM" -> "2:10p". A month cell has no room for more. */
function compactTime(label: string): string {
  return label
    .replace(/:00/, "")
    .replace(/\s?AM/i, "a")
    .replace(/\s?PM/i, "p");
}

function shiftMonth(firstOfMonth: string, delta: number): string {
  const [y, m] = firstOfMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CaddieCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const viewer = await requireCaddieStaff();

  const settings = await getSettings();
  const tz = settings.courseTimezone;
  const today = courseToday(tz);

  const { month } = await searchParams;
  const first = monthStart(month, today);
  const thisMonth = first.slice(0, 7);

  // Pad out to whole weeks, Sunday first, so the grid always has square edges.
  const firstWeekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  const gridStart = addDays(first, -firstWeekday);
  const CELLS = 42; // six weeks covers every possible month layout
  const gridEnd = addDays(gridStart, CELLS - 1);

  const byDay = await loopsBetweenByDay(gridStart, gridEnd, tz);

  const cells = Array.from({ length: CELLS }, (_, i) => addDays(gridStart, i));
  const inMonth = (d: string) => d.slice(0, 7) === thisMonth;

  const isShort = (l: { accepted: number; required: number; status: string }) =>
    l.status !== "Cancelled" && l.accepted < l.required;

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${first}T00:00:00Z`));

  // Totals for the month itself, not the padding days either side.
  let monthOpen = 0;
  let monthTotal = 0;
  for (const [date, loops] of byDay) {
    if (!inMonth(date)) continue;
    for (const l of loops) {
      if (l.status === "Cancelled") continue;
      monthTotal += 1;
      if (isShort(l)) monthOpen += 1;
    }
  }

  return (
    <>
      <CaddieHeader email={viewer.email} active="calendar" />

      <main className="container">
        <div className="page-head">
          <div>
            <h1>Job Calendar</h1>
            <div className="sub">
              {monthLabel} · {monthTotal} {monthTotal === 1 ? "loop" : "loops"}
              {monthOpen > 0 && ` · ${monthOpen} still need caddies`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              className="btn secondary small"
              href={`/admin/caddie/calendar?month=${shiftMonth(first, -1)}`}
            >
              ←
            </Link>
            {thisMonth !== today.slice(0, 7) && (
              <Link className="btn ghost small" href="/admin/caddie/calendar">
                This month
              </Link>
            )}
            <Link
              className="btn secondary small"
              href={`/admin/caddie/calendar?month=${shiftMonth(first, 1)}`}
            >
              →
            </Link>
          </div>
        </div>

        <div className="card">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: 6,
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="muted"
                style={{ fontSize: 12, textAlign: "center", paddingBottom: 4 }}
              >
                {d}
              </div>
            ))}

            {cells.map((date) => {
              const loops = (byDay.get(date) ?? []).filter(
                (l) => l.status !== "Cancelled",
              );
              const isToday = date === today;
              const dim = !inMonth(date);
              const past = date < today;
              const short = loops.filter(isShort).length;

              // Times only, as chips that wrap. A month cell is about 100px
              // wide: a player name truncates to "ZZ P..." there, which tells
              // you nothing, while the tee times tell you where the day's load
              // sits. Names are on the tooltip and one click away on the sheet.
              const SHOWN = 6;
              const visible = loops.slice(0, SHOWN);

              return (
                <Link
                  key={date}
                  href={`/admin/caddie?day=${date}`}
                  title={`Open the sheet for ${date}`}
                  style={{
                    display: "block",
                    minHeight: 96,
                    padding: "6px 7px",
                    borderRadius: 8,
                    border: `1px solid ${
                      isToday ? "var(--accent)" : "var(--line)"
                    }`,
                    background: "var(--panel)",
                    color: "inherit",
                    textDecoration: "none",
                    opacity: dim ? 0.38 : past ? 0.72 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontWeight: isToday ? 700 : 500, fontSize: 13 }}>
                      {Number(date.slice(8, 10))}
                    </span>
                    {short > 0 && (
                      <span
                        title={`${short} still short of caddies`}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--danger)",
                        }}
                      >
                        {short} short
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 3,
                      alignContent: "flex-start",
                    }}
                  >
                    {visible.map((l) => {
                      const filled = !isShort(l);
                      return (
                        <span
                          key={l.id}
                          title={`${l.teeLabel} · ${l.playerName} · ${l.loopType} · ${l.accepted}/${l.required} confirmed`}
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            lineHeight: 1.6,
                            padding: "0 5px",
                            borderRadius: 4,
                            whiteSpace: "nowrap",
                            color: filled ? "#0f5132" : "#7a1f1f",
                            background: filled ? "#d6efe0" : "#fadcdc",
                            border: `1px solid ${filled ? "#aedcc4" : "#f0b8b8"}`,
                          }}
                        >
                          {compactTime(l.teeLabel)}
                        </span>
                      );
                    })}

                    {loops.length > SHOWN && (
                      <span className="muted" style={{ fontSize: 10, lineHeight: 1.7 }}>
                        +{loops.length - SHOWN}
                      </span>
                    )}

                    {loops.length === 0 && !dim && (
                      <span className="muted" style={{ fontSize: 11 }}>
                        —
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Every job on the month, filled and unfilled — one chip per tee time.
          Red is still short of caddies, green is covered. Hover a chip for the
          player and loop type; click any day to open its sheet and add loops.
          Cancelled loops are not shown.
        </p>
      </main>
    </>
  );
}
