import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/events/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import {
  addDays,
  availabilityBetween,
  courseToday,
  getSettings,
  listCaddies,
  zonedMidnight,
} from "@/lib/caddie/data";

// Who is around this week.
//
// The dispatch board answers "who can take THIS loop"; this answers the
// question the shop asks on a Thursday looking at the weekend — who have we
// actually got. A week of columns, one row per caddie.
//
// Deliberately a plain server component: week navigation is links, so there is
// no client JavaScript on this page at all.
export const dynamic = "force-dynamic";

const DAYS = 7;

const CELL: Record<string, { label: string; cls: string }> = {
  "All Day": { label: "All day", cls: "badge open" },
  AM: { label: "AM", cls: "badge open" },
  PM: { label: "PM", cls: "badge open" },
  Off: { label: "Off", cls: "badge closed" },
};

function TodayLine({
  label,
  people,
  muted,
}: {
  label: string;
  people: { id: string; fullName: string; tierName: string | null }[];
  muted?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
      <span
        className="muted"
        style={{ fontSize: 13, minWidth: 74, flex: "0 0 auto" }}
      >
        {label}
      </span>
      {people.length === 0 ? (
        <span className="muted">nobody yet</span>
      ) : (
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {people.map((p) => (
            <span
              key={p.id}
              className="pill"
              style={{ opacity: muted ? 0.6 : 1 }}
            >
              {p.tierName && (
                <span className="badge gray" style={{ marginRight: 6 }}>
                  {p.tierName}
                </span>
              )}
              {p.fullName}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export default async function AdminAvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const settings = await getSettings();
  const tz = settings.courseTimezone;
  const today = courseToday(tz);

  const { from: requested } = await searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? "")
    ? (requested as string)
    : today;
  const to = addDays(from, DAYS - 1);

  const [caddies, grid] = await Promise.all([
    listCaddies(),
    availabilityBetween(from, to),
  ]);

  const roster = caddies
    .filter((c) => c.status === "Active")
    .sort(
      (a, b) =>
        a.tierOrder - b.tierOrder || a.fullName.localeCompare(b.fullName),
    );

  const dates = Array.from({ length: DAYS }, (_, i) => addDays(from, i));

  // Labels come from a UTC-midnight instant formatted in UTC: the column head
  // must be the calendar date itself, not that date shifted into a zone.
  const head = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
  const range = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "long",
    day: "numeric",
  });

  // What each caddie said, resolved to the cell we draw.
  const cellFor = (caddieId: string, date: string) => {
    const entry = grid.get(caddieId)?.get(date);
    if (!entry) return null;
    return entry.status === "Unavailable" ? CELL.Off : CELL[entry.slot];
  };

  // Per-day tallies, counting each half separately — "All day" answers both.
  const tally = dates.map((date) => {
    let am = 0;
    let pm = 0;
    for (const c of roster) {
      const entry = grid.get(c.id)?.get(date);
      if (!entry || entry.status === "Unavailable") continue;
      if (entry.slot === "All Day" || entry.slot === "AM") am += 1;
      if (entry.slot === "All Day" || entry.slot === "PM") pm += 1;
    }
    return { am, pm };
  });

  const answered = roster.filter((c) =>
    dates.some((d) => grid.get(c.id)?.has(d)),
  ).length;

  // Today, spelled out by name. The grid answers "this week"; the question the
  // shop actually asks at 6am is "who have I got right now", and counting
  // badges across a row to work that out is not an answer.
  const todayAm: typeof roster = [];
  const todayPm: typeof roster = [];
  const todayOff: typeof roster = [];
  for (const c of roster) {
    const entry = grid.get(c.id)?.get(today);
    if (!entry) continue;
    if (entry.status === "Unavailable") {
      todayOff.push(c);
      continue;
    }
    if (entry.slot === "All Day" || entry.slot === "AM") todayAm.push(c);
    if (entry.slot === "All Day" || entry.slot === "PM") todayPm.push(c);
  }
  const todayInRange = dates.includes(today);
  const todaySilent = roster.length - todayAm.length - todayOff.length;

  return (
    <>
      <CaddieHeader email={viewer.email} active="availability" />

      <main className="container">
        <div className="page-head">
          <div>
            <h1>Who&apos;s free</h1>
            <div className="sub">
              {range.format(zonedMidnight(from, tz))} –{" "}
              {range.format(zonedMidnight(to, tz))} · {answered} of{" "}
              {roster.length} caddies answered
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              className="btn secondary small"
              href={`/admin/caddie/availability?from=${addDays(from, -DAYS)}`}
            >
              ← Previous
            </Link>
            {from !== today && (
              <Link
                className="btn ghost small"
                href="/admin/caddie/availability"
              >
                This week
              </Link>
            )}
            <Link
              className="btn secondary small"
              href={`/admin/caddie/availability?from=${addDays(from, DAYS)}`}
            >
              Next →
            </Link>
          </div>
        </div>

        {roster.length > 0 && todayInRange && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="ev-title" style={{ fontSize: 17 }}>
              Today
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <TodayLine label="Morning" people={todayAm} />
              <TodayLine label="Afternoon" people={todayPm} />
              {todayOff.length > 0 && (
                <TodayLine label="Off" people={todayOff} muted />
              )}
            </div>
            {todaySilent > 0 && (
              <p className="muted" style={{ fontSize: 13, marginBottom: 0, marginTop: 12 }}>
                {todaySilent} {todaySilent === 1 ? "caddie has" : "caddies have"}{" "}
                not answered for today.
              </p>
            )}
          </div>
        )}

        {roster.length === 0 ? (
          <div className="empty">
            No active caddies yet.{" "}
            <Link href="/admin/caddie/roster">Add some →</Link>
          </div>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", minWidth: 150 }}>Caddie</th>
                  {dates.map((d, i) => (
                    <th key={d} style={{ textAlign: "center", minWidth: 74 }}>
                      <div>{head.format(new Date(`${d}T00:00:00Z`))}</div>
                      <div
                        className="muted"
                        style={{ fontWeight: 400, fontSize: 11, marginTop: 2 }}
                      >
                        {tally[i].am}a / {tally[i].pm}p
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map((c) => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {c.tierName && (
                        <span className="badge gray" style={{ marginRight: 8 }}>
                          {c.tierName}
                        </span>
                      )}
                      {c.fullName}
                    </td>
                    {dates.map((d) => {
                      const cell = cellFor(c.id, d);
                      return (
                        <td key={d} style={{ textAlign: "center" }}>
                          {cell ? (
                            <span className={cell.cls}>{cell.label}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
          A dash means they have not answered, which is not the same as being
          off. The counts under each date are how many are free that morning and
          that afternoon.
        </p>
      </main>
    </>
  );
}
