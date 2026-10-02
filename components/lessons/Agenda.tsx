import Link from "next/link";
import { addDays, groupByDay, seqLabel } from "@/lib/lessons/calc";
import { formatTime, type NumberedLesson } from "@/lib/lessons/types";

// Lessons grouped by day: the dashboard's "this week" and the Schedule tab.
//
// Each row answers the question Ian has on the tee - who, when, and which
// lesson of their package this is - and flags the two things that cost him
// money if missed: an unpaid package, and the last lesson of one (the moment
// to sell the next).

function dayHeading(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const STATUS_CHIP: Partial<Record<NumberedLesson["status"], string>> = {
  cancelled: "Cancelled",
  no_show: "No-show",
};

function Row({ l }: { l: NumberedLesson }) {
  const off = l.status === "cancelled" || l.status === "no_show";
  const seq = seqLabel(l);
  const size = l.packageSize ?? 0;
  // A single is never "the last one of a package" or over it.
  const inPackage = l.packageKind !== "single";
  const last = inPackage && !off && l.seq !== null && size > 0 && l.seq === size;
  const over = inPackage && !off && l.seq !== null && size > 0 && l.seq > size;

  return (
    <li className={off ? "lb-arow off" : "lb-arow"}>
      <span className="lb-time">{formatTime(l.startsAt)}</span>
      <div className="lb-awho">
        {l.clientId ? (
          <Link href={`/lessons/clients/${l.clientId}`} className="lb-name">
            {l.clientName}
          </Link>
        ) : (
          <span className="lb-name">{l.titleRaw ?? "Unassigned"}</span>
        )}
        <div className="lb-chips" style={{ marginTop: 4 }}>
          {seq === "single" && <span className="badge draft">Single</span>}
          {/* On no bill yet: said plainly, so it is not forgotten. */}
          {seq === "one-off" && <span className="badge closed">Not billed</span>}
          {seq && seq !== "single" && seq !== "one-off" && (
            <span className="badge gray">{seq}</span>
          )}
          {STATUS_CHIP[l.status] && (
            <span className="badge gray">{STATUS_CHIP[l.status]}</span>
          )}
          {!off && l.paymentStatus === "unpaid" && (
            <span className="badge closed">Unpaid</span>
          )}
          {last && <span className="badge open">Last one — sell the next</span>}
          {over && <span className="badge draft">Over package</span>}
        </div>
      </div>
    </li>
  );
}

export default function Agenda({
  lessons,
  empty,
  today,
}: {
  lessons: NumberedLesson[];
  empty: string;
  /** Pacific "YYYY-MM-DD", for the Today / Tomorrow headings. */
  today: string;
}) {
  if (!lessons.length) return <p className="empty">{empty}</p>;

  return (
    <div className="lb-agenda">
      {groupByDay(lessons).map((g) => (
        <section key={g.day} className="lb-day">
          <h3 className={g.day === today ? "lb-dayhead now" : "lb-dayhead"}>
            {dayHeading(g.day, today)}
            <span>
              {g.items.length} lesson{g.items.length === 1 ? "" : "s"}
            </span>
          </h3>
          <ul className="lb-alist">
            {g.items.map((l) => (
              <Row key={l.id} l={l} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
