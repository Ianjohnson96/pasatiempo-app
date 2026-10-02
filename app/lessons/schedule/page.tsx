import Link from "next/link";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import Agenda from "@/components/lessons/Agenda";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import {
  addDays,
  courseDay,
  courseMidnightIso,
  monthRange,
  parseScheduleParams,
  shiftAnchor,
  weekRange,
} from "@/lib/lessons/calc";
import { reviewCount, scheduleLessons } from "@/lib/lessons/data";

// Every lesson by week or month, past and booked, each with its place in
// its package. The URL carries the view (?view=week&d=2026-10-01), so the
// back button and a bookmarked week both work.
export const dynamic = "force-dynamic";

type Params = { view?: string | string[]; d?: string | string[] };

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

function short(day: string, withYear = false): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function monthTitle(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

const href = (view: string, d: string) =>
  `/lessons/schedule?view=${view}&d=${d}`;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const today = courseDay(new Date().toISOString());
  const { view, day } = parseScheduleParams(
    { view: first(sp.view), d: first(sp.d) },
    today,
  );
  const range = view === "week" ? weekRange(day) : monthRange(day);

  const [viewer, [lessons, waiting]] = await gateFirst(
    requireLessonBook(),
    Promise.all([
      scheduleLessons(courseMidnightIso(range.from), courseMidnightIso(range.to)),
      reviewCount(),
    ]),
  );

  const last = addDays(range.to, -1);
  const crossesYear = range.from.slice(0, 4) !== last.slice(0, 4);
  const title =
    view === "week"
      ? `${short(range.from)} – ${short(last, crossesYear)}`
      : monthTitle(range.from);
  const holdsToday = today >= range.from && today < range.to;

  const taught = lessons.filter((l) => l.status === "completed").length;
  const booked = lessons.filter((l) => l.status === "scheduled").length;
  const off = lessons.length - taught - booked;

  return (
    <>
      <LessonsHeader email={viewer.email} active="schedule" waiting={waiting} />
      <main className="container">
        <div className="lb-schedbar">
          <div className="seg" role="group" aria-label="View">
            <Link
              href={href("week", day)}
              className={view === "week" ? "segbtn on" : "segbtn"}
              aria-current={view === "week" ? "page" : undefined}
            >
              Week
            </Link>
            <Link
              href={href("month", day)}
              className={view === "month" ? "segbtn on" : "segbtn"}
              aria-current={view === "month" ? "page" : undefined}
            >
              Month
            </Link>
          </div>
          <div className="seg" role="group" aria-label="Move">
            <Link
              href={href(view, shiftAnchor(day, view, -1))}
              className="segbtn"
              aria-label={`Previous ${view}`}
            >
              &lsaquo;
            </Link>
            <Link
              href={href(view, today)}
              className={holdsToday ? "segbtn on" : "segbtn"}
            >
              Today
            </Link>
            <Link
              href={href(view, shiftAnchor(day, view, 1))}
              className="segbtn"
              aria-label={`Next ${view}`}
            >
              &rsaquo;
            </Link>
          </div>
        </div>

        <h1 className="lb-schedtitle">{title}</h1>
        <p className="lb-sub" style={{ marginTop: 0 }}>
          {taught} taught · {booked} booked
          {off > 0 && ` · ${off} cancelled or missed`}
        </p>

        <div style={{ marginTop: 14 }}>
          <Agenda
            lessons={lessons}
            today={today}
            empty={
              view === "week" ? "No lessons this week." : "No lessons this month."
            }
          />
        </div>
      </main>
    </>
  );
}
