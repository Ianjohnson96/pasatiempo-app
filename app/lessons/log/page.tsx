import LessonsHeader from "@/components/lessons/LessonsHeader";
import LessonLog, { type Filter } from "@/components/lessons/LessonLog";
import { requireLessonBook } from "@/lib/lessons/auth";
import { listLessons, listStudents } from "@/lib/lessons/data";

// Every lesson, with its price and whether it is paid.
export const dynamic = "force-dynamic";

const FILTERS = new Set<Filter>(["all", "unpriced", "unpaid", "paid"]);

export default async function LessonLogPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; student?: string }>;
}) {
  const viewer = await requireLessonBook();
  const [{ filter, student }, lessons, students] = await Promise.all([
    searchParams,
    listLessons(),
    listStudents(),
  ]);

  // Validated rather than cast: the query string is user input, and an unknown
  // value would leave the filter buttons showing none of them selected.
  const initialFilter: Filter =
    filter && FILTERS.has(filter as Filter) ? (filter as Filter) : "all";
  const initialStudent = students.some((s) => s.id === student) ? student! : "";

  return (
    <>
      <LessonsHeader email={viewer.email} active="log" />
      <main className="container">
        <LessonLog
          lessons={lessons}
          students={students.map((s) => ({ id: s.id, name: s.name }))}
          initialFilter={initialFilter}
          initialStudent={initialStudent}
        />
      </main>
    </>
  );
}
