import LessonsHeader from "@/components/lessons/LessonsHeader";
import ReviewQueue from "@/components/lessons/ReviewQueue";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import { listClientSummaries, listReview } from "@/lib/lessons/data";

// Calendar entries the sync would not guess at, waiting on a yes or no.
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const [viewer, [items, clients]] = await gateFirst(
    requireLessonBook(),
    Promise.all([listReview(), listClientSummaries()]),
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
        <ReviewQueue
          items={items}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        />
      </main>
    </>
  );
}
