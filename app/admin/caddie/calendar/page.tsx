import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/events/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import {
  addDays,
  courseToday,
  getSettings,
  loopCountsBetween,
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
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

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

  const counts = await loopCountsBetween(gridStart, gridEnd, tz);

  const cells = Array.from({ length: CELLS }, (_, i) => addDays(gridStart, i));
  const inMonth = (d: string) => d.slice(0, 7) === thisMonth;

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${first}T00:00:00Z`));

  // Totals for the month itself, not the padding days either side.
  let monthOpen = 0;
  let monthTotal = 0;
  for (const [date, c] of counts) {
    if (!inMonth(date)) continue;
    monthOpen += c.open;
    monthTotal += c.total;
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
              const c = counts.get(date);
              const isToday = date === today;
              const dim = !inMonth(date);
              const past = date < today;

              return (
                <Link
                  key={date}
                  href={`/admin/caddie?day=${date}`}
                  title={`Open the sheet for ${date}`}
                  style={{
                    display: "block",
                    minHeight: 74,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: `1px solid ${
                      isToday ? "var(--accent)" : "var(--line)"
                    }`,
                    background: "var(--panel)",
                    color: "inherit",
                    textDecoration: "none",
                    opacity: dim ? 0.38 : past ? 0.7 : 1,
                  }}
                >
                  <div
                    style={{
                      fontWeight: isToday ? 700 : 500,
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    {Number(date.slice(8, 10))}
                  </div>

                  {c && c.total > 0 ? (
                    <div style={{ display: "grid", gap: 3 }}>
                      {c.open > 0 && (
                        <span className="badge draft">{c.open} open</span>
                      )}
                      {c.assigned > 0 && (
                        <span className="badge open">{c.assigned} set</span>
                      )}
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: 11 }}>
                      {dim ? "" : "—"}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          Click any day to open its sheet and add loops. Amber still needs
          caddies; green is covered. Cancelled loops are not counted.
        </p>
      </main>
    </>
  );
}
