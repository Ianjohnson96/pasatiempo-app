import LessonsHeader from "@/components/lessons/LessonsHeader";
import ReviewQueue from "@/components/lessons/ReviewQueue";
import { requireLessonBook } from "@/lib/lessons/auth";
import { listClientSummaries, listReview } from "@/lib/lessons/data";

// Calendar entries the sync would not guess at, waiting on a yes or no.
export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const viewer = await requireLessonBook();
  const [items, clients] = await Promise.all([
    listReview(),
    listClientSummaries(),
  ]);

  return (
    <>
      <LessonsHeader email={viewer.email} active="review" />
      <main className="container">
        <ReviewQueue
          items={items}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        />
      </main>
    </>
  );
}
