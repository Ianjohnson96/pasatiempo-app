import LessonsHeader from "@/components/lessons/LessonsHeader";
import ConfirmQueue from "@/components/lessons/ConfirmQueue";
import { requireLessonBook } from "@/lib/lessons/auth";
import { listPending, listStudents } from "@/lib/lessons/data";

// Calendar entries that might be lessons, waiting on a yes or no.
export const dynamic = "force-dynamic";

export default async function ConfirmPage() {
  const viewer = await requireLessonBook();
  const [items, students] = await Promise.all([listPending(), listStudents()]);

  return (
    <>
      <LessonsHeader email={viewer.email} active="confirm" />
      <main className="container">
        <ConfirmQueue
          items={items}
          students={students.map((s) => ({ id: s.id, name: s.name }))}
        />
      </main>
    </>
  );
}
