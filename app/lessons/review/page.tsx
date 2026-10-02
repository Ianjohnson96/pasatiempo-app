import LessonsHeader from "@/components/lessons/LessonsHeader";
import ReviewQueue from "@/components/lessons/ReviewQueue";
import SyncNow from "@/components/lessons/SyncNow";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import {
  listClientSummaries,
  listReview,
  reviewMatches,
} from "@/lib/lessons/data";

// Calendar entries the sync would not guess at, waiting on a yes or no.
export const dynamic = "force-dynamic";
// "Sync now" runs the calendar sync from this page; a busy year of events
// takes longer than the default limit.
export const maxDuration = 60;

export default async function ReviewPage() {
  const [viewer, [[items, matches], clients]] = await gateFirst(
    requireLessonBook(),
    Promise.all([
      // Which entries are lessons already in the book needs the entries
      // first; the client list does not, so it runs alongside.
      listReview().then(async (it) => [it, await reviewMatches(it)] as const),
      listClientSummaries(),
    ]),
  );

  return (
    <>
      {/* The queue itself is the count; no second query for the badge. */}
      <LessonsHeader
        email={viewer.email}
        active="review"
        waiting={items.length}
      />
      <main className="container">
        <div className="lb-syncline" style={{ marginTop: 0, marginBottom: 14 }}>
          <p className="lb-sync" style={{ textAlign: "left" }}>
            Fixed titles in Outlook? Pull them in now instead of waiting for
            the 2am sync.
          </p>
          <SyncNow />
        </div>
        <ReviewQueue
          items={items}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          matches={matches}
        />
      </main>
    </>
  );
}
