import Link from "next/link";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import Agenda from "@/components/lessons/Agenda";
import {
  FollowUps,
  MoneyTiles,
  NextUp,
  SyncLine,
  Volume,
} from "@/components/lessons/DashboardSections";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import { courseDay } from "@/lib/lessons/calc";
import { dashboardData } from "@/lib/lessons/data";

// The front page, read on a phone on the lesson tee: who is next and what
// is this week, what money is out, who needs a follow-up, how much he is
// teaching. One database call (lesson_dashboard) feeds all of it.
export const dynamic = "force-dynamic";
// "Sync now" runs the calendar sync from this page; a busy year of events
// takes longer than the default limit.
export const maxDuration = 60;

export default async function LessonBookHome() {
  const [viewer, d] = await gateFirst(requireLessonBook(), dashboardData());
  const today = courseDay(d.now);

  return (
    <>
      <LessonsHeader
        email={viewer.email}
        active="dashboard"
        waiting={d.reviewCount}
      />
      <main className="container lb-dash">
        {/* Two columns on a desktop - what is next on the left, money and
            who to chase on the right - one column, in this order, on a
            phone. Teaching runs full width underneath. */}
        <div className="lb-dash-grid">
          <div className="lb-dash-main">
            <NextUp d={d} />

            <div className="lb-sechead">
              <h2 className="section-title">This week</h2>
              <Link href="/lessons/schedule">Full schedule</Link>
            </div>
            <Agenda
              lessons={d.week}
              today={today}
              empty="Nothing on the calendar for the next seven days."
            />
          </div>

          <div className="lb-dash-side">
            <div className="lb-sechead lb-sechead-first">
              <h2 className="section-title">Money</h2>
              <Link href="/lessons/prices">Prices</Link>
            </div>
            <MoneyTiles d={d} />

            <div className="lb-sechead">
              <h2 className="section-title">Follow up</h2>
            </div>
            <FollowUps d={d} />
          </div>

          {/* Last on a phone; on a desktop it fills the left column under
              the week instead of waiting below the follow-up list. */}
          <div className="lb-dash-teach">
            <div className="lb-sechead">
              <h2 className="section-title">Teaching</h2>
            </div>
            <Volume d={d} />
          </div>
        </div>

        <SyncLine d={d} />
      </main>
    </>
  );
}
