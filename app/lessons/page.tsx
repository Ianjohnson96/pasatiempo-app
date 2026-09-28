import LessonsHeader from "@/components/lessons/LessonsHeader";
import StudentList from "@/components/lessons/StudentList";
import { requireLessonBook } from "@/lib/lessons/auth";
import { bookTotals, studentSummaries } from "@/lib/lessons/data";

// The roster, and the money. The front page of the lesson book.
export const dynamic = "force-dynamic";

export default async function LessonBookHome() {
  const viewer = await requireLessonBook();
  const [students, totals] = await Promise.all([
    studentSummaries(),
    bookTotals(),
  ]);

  return (
    <>
      <LessonsHeader email={viewer.email} active="students" />
      <main className="container">
        <StudentList students={students} totals={totals} />
      </main>
    </>
  );
}
