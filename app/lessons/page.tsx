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
        <NextUp d={d} />

        <div className="lb-sechead">
          <h2 className="section-title">This week</h2>
          <Link href="/lessons/schedule">Full schedule &rarr;</Link>
        </div>
        <Agenda
          lessons={d.week}
          today={today}
          empty="Nothing on the calendar for the next seven days."
        />

        <div className="lb-sechead">
          <h2 className="section-title">Money</h2>
          <Link href="/lessons/prices">Prices &rarr;</Link>
        </div>
        <MoneyTiles d={d} />

        <div className="lb-sechead">
          <h2 className="section-title">Follow up</h2>
        </div>
        <FollowUps d={d} />

        <div className="lb-sechead">
          <h2 className="section-title">Teaching</h2>
        </div>
        <Volume d={d} />

        <SyncLine d={d} />
      </main>
    </>
  );
}
