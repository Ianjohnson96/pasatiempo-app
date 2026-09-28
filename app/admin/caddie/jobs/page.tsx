import Link from "next/link";
import { requireCaddieStaff } from "@/lib/caddie/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import MarkDroppedButton from "@/components/caddie/MarkDroppedButton";
import {
  addDays,
  courseToday,
  formatTee,
  getSettings,
  jobsBetween,
  listCaddies,
  type JobRow,
} from "@/lib/caddie/data";
import { dropLateness, type DropThresholds } from "@/lib/caddie/ledger";
import type { CaddieRec, CrewMember, LoopStatus } from "@/lib/caddie/types";

// Every job in date order, and who is filling it.
//
// The dispatch board is one day at a time, which is right for running the day
// and wrong for "what has Trevor got this month?" or "which of next week's
// loops are still short?". This is the whole sheet, a day under each heading.
//
// Everyone with Caddie Program access sees the jobs and who is on them, and
// can record a drop when a caddie rings in. The drop HISTORY — who handed back
// what, and how late — is shown to Caddie Program admins only, for the same
// reason the fair-share ledger is: a caddie's reliability record is the caddie
// master's business, not the counter's.
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<LoopStatus, string> = {
  Unassigned: "badge draft",
  "Partially Assigned": "badge gray",
  Assigned: "badge open",
  Completed: "badge closed",
  Cancelled: "badge closed",
};

const dayHeading = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default async function CaddieJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ caddie?: string; when?: string }>;
}) {
  const viewer = await requireCaddieStaff();
  const isAdmin = viewer.isGlobalAdmin;
  const { caddie: caddieParam, when: whenParam } = await searchParams;
  const when = whenParam === "past" ? "past" : "upcoming";

  const settings = await getSettings();
  const tz = settings.courseTimezone;
  // Where "late" and "same day" fall, as set in Settings.
  const t: DropThresholds = {
    lateHours: settings.dropLateHours,
    sameDayHours: settings.dropSameDayHours,
  };
  const today = courseToday(tz);
  // Upcoming reaches half a year out, because bookings do; past reaches back
  // two months, which is as far as anyone asks "who did that loop?".
  const [fromDay, toDay] =
    when === "past" ? [addDays(today, -60), addDays(today, -1)] : [today, addDays(today, 180)];

  const [allJobs, caddies] = await Promise.all([
    jobsBetween(fromDay, toDay, tz),
    listCaddies(),
  ]);
  // Past runs newest first: the question is nearly always about last week.
  const jobs = when === "past" ? [...allJobs].reverse() : allJobs;

  const focus = caddies.find((c) => c.id === caddieParam) ?? null;
  const has = (j: JobRow, status: string) =>
    focus ? j.crew.some((m) => m.caddieId === focus.id && m.confirmationStatus === status) : false;

  const live = jobs.filter((j) => j.loop.status !== "Cancelled");
  const seats = live.reduce((n, j) => n + j.loop.caddiesRequired, 0);
  const filled = live.reduce((n, j) => n + accepted(j.crew).length, 0);
  const drops = jobs.reduce(
    (n, j) => n + j.crew.filter((m) => m.confirmationStatus === "Dropped").length,
    0,
  );

  const signedUp = focus ? jobs.filter((j) => has(j, "Accepted")) : [];
  const dropped = focus ? jobs.filter((j) => has(j, "Dropped")) : [];

  return (
    <>
      <CaddieHeader email={viewer.email} active="jobs" isGlobalAdmin={isAdmin} />
      <main className="container">
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          <div>
            <h2 className="section-title" style={{ marginBottom: 2 }}>
              {focus ? focus.fullName : when === "past" ? "Past jobs" : "Upcoming jobs"}
            </h2>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {when === "past" ? "The last 60 days, newest first." : "Today onwards, in date order."}
            </p>
          </div>

          {/* A plain form, so filtering works with or without JavaScript and
              the filter lives in the address — a link to "Trevor's jobs" can
              be sent to someone. */}
          <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select name="caddie" defaultValue={focus?.id ?? ""} aria-label="Caddie" style={selectStyle}>
              <option value="">All jobs</option>
              {[...caddies]
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
            </select>
            <select name="when" defaultValue={when} aria-label="When" style={selectStyle}>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past 60 days</option>
            </select>
            <button type="submit" className="btn secondary small">
              Show
            </button>
            {(focus || when === "past") && (
              <Link href="/admin/caddie/jobs" className="btn ghost small">
                Clear
              </Link>
            )}
          </form>
        </div>

        {!focus && (
          <div className="card" style={{ marginTop: 16, display: "flex", gap: 28, flexWrap: "wrap" }}>
            <Stat num={live.length} lbl="jobs" />
            <Stat num={`${filled} / ${seats}`} lbl="caddies filled" />
            <Stat num={seats - filled} lbl="still to fill" warn={seats - filled > 0} />
            {isAdmin && <Stat num={drops} lbl="handed back" warn={drops > 0} />}
          </div>
        )}

        {focus ? (
          <>
            <h3 className="section-title" style={{ marginTop: 22 }}>
              Signed up for · {signedUp.length}
            </h3>
            {signedUp.length === 0 ? (
              <p className="muted">
                {focus.fullName} has no {when === "past" ? "loops in the last 60 days" : "upcoming loops"}.
              </p>
            ) : (
              <JobList jobs={signedUp} tz={tz} t={t} isAdmin={isAdmin} focus={focus} />
            )}

            {isAdmin && (
              <>
                <h3 className="section-title" style={{ marginTop: 26 }}>
                  Handed back · {dropped.length}
                </h3>
                {dropped.length === 0 ? (
                  <p className="muted">
                    {focus.fullName} hasn&apos;t given any {when === "past" ? "recent" : "upcoming"} loops back.
                  </p>
                ) : (
                  <JobList jobs={dropped} tz={tz} t={t} isAdmin={isAdmin} focus={focus} />
                )}
              </>
            )}
          </>
        ) : jobs.length === 0 ? (
          <p className="muted" style={{ marginTop: 18 }}>
            No {when === "past" ? "jobs in the last 60 days" : "upcoming jobs"}.
          </p>
        ) : (
          <JobList jobs={jobs} tz={tz} t={t} isAdmin={isAdmin} focus={null} />
        )}
      </main>
    </>
  );
}

const accepted = (crew: CrewMember[]) => crew.filter((m) => m.confirmationStatus === "Accepted");

/** Jobs grouped under a heading for each day, in the order given. */
function JobList({
  jobs,
  tz,
  t,
  isAdmin,
  focus,
}: {
  jobs: JobRow[];
  tz: string;
  t: DropThresholds;
  isAdmin: boolean;
  focus: CaddieRec | null;
}) {
  const days: { day: string; jobs: JobRow[] }[] = [];
  for (const j of jobs) {
    const last = days[days.length - 1];
    if (last && last.day === j.day) last.jobs.push(j);
    else days.push({ day: j.day, jobs: [j] });
  }

  return (
    <div style={{ display: "grid", gap: 18, marginTop: 12 }}>
      {days.map((d) => (
        <section key={d.day}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>
            {dayHeading.format(new Date(`${d.day}T00:00:00Z`))}
          </h4>
          <div className="evlist">
            {d.jobs.map((j) => (
              <JobLine key={j.loop.id} job={j} tz={tz} t={t} isAdmin={isAdmin} focus={focus} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function JobLine({
  job,
  tz,
  t,
  isAdmin,
  focus,
}: {
  job: JobRow;
  tz: string;
  t: DropThresholds;
  isAdmin: boolean;
  focus: CaddieRec | null;
}) {
  const { loop, crew, started } = job;
  const on = accepted(crew);
  const pending = crew.filter((m) => m.confirmationStatus === "Pending").length;
  const handedBack = crew.filter((m) => m.confirmationStatus === "Dropped");
  const noShows = crew.filter((m) => m.confirmationStatus === "No Show");
  const short = Math.max(0, loop.caddiesRequired - on.length);
  const cancelled = loop.status === "Cancelled";

  return (
    <div className="evrow" style={{ opacity: cancelled ? 0.55 : 1, alignItems: "flex-start" }}>
      <div style={{ minWidth: 76, fontWeight: 600, fontSize: 16 }}>{formatTee(loop.teeTime, tz)}</div>

      <div className="ev-main">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="ev-title">{loop.playerName}</span>
          <span className={STATUS_BADGE[loop.status]}>{loop.status}</span>
        </div>
        <div className="ev-meta">
          <span>
            {loop.caddiesRequired > 1 ? `${loop.caddiesRequired} × ` : ""}
            {loop.loopType}
          </span>
          {!cancelled && short > 0 && (
            <span style={{ color: "var(--warn)", fontWeight: 600 }}>needs {short} more</span>
          )}
          {!cancelled && pending > 0 && (
            <span>
              {pending} {pending === 1 ? "offer" : "offers"} out
            </span>
          )}
        </div>

        {/* Who is on it. */}
        {on.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
            {on.map((m) => (
              <span key={m.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  className={focus && m.caddieId === focus.id ? "badge open" : "badge gray"}
                  style={{ fontSize: 13 }}
                >
                  {m.caddie.fullName}
                </span>
                {!started && !cancelled && (
                  <MarkDroppedButton assignmentId={m.id} caddieName={m.caddie.fullName} />
                )}
              </span>
            ))}
          </div>
        )}

        {/* Who handed it back — the caddie master's record, admins only. */}
        {isAdmin && (handedBack.length > 0 || noShows.length > 0) && (
          <div className="ev-meta" style={{ marginTop: 8 }}>
            {handedBack.map((m) => (
              <DropNote key={m.id} member={m} teeTime={loop.teeTime} tz={tz} t={t} />
            ))}
            {noShows.map((m) => (
              <span key={m.id} style={{ color: "var(--danger)", fontWeight: 600 }}>
                No show: {m.caddie.fullName}
                {m.markedBy ? ` (marked by ${m.markedBy})` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Trevor handed back · within 24h · Oct 1, 3:12 PM · by the caddie" */
function DropNote({
  member,
  teeTime,
  tz,
  t,
}: {
  member: CrewMember;
  teeTime: string;
  tz: string;
  t: DropThresholds;
}) {
  const late = dropLateness(member.droppedAt, teeTime, t);
  const when = member.droppedAt
    ? new Date(member.droppedAt).toLocaleString("en-US", {
        timeZone: tz,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <span>
      <span style={{ textDecoration: "line-through" }}>{member.caddie.fullName}</span> handed back
      {late && late !== "early" && (
        <span className="badge closed" style={{ marginLeft: 6 }}>
          {late === "same day" ? "same day" : "within 24h"}
        </span>
      )}
      {when && <> · {when}</>}
      {member.markedBy ? ` · recorded by ${member.markedBy}` : " · by the caddie"}
    </span>
  );
}

function Stat({ num, lbl, warn }: { num: number | string; lbl: string; warn?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontWeight: 600, color: warn ? "var(--warn)" : "var(--ink)" }}>{num}</div>
      <div className="muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {lbl}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 14,
};
