import { notFound } from "next/navigation";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import ClientDetail from "@/components/lessons/ClientDetail";
import { requireLessonBook } from "@/lib/lessons/auth";
import { clientLessons, getClient, listPackages } from "@/lib/lessons/data";

// One client: packages, lesson history, and the controls to connect them.
export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireLessonBook();
  const { id } = await params;

  const client = await getClient(id);
  // Also covers an id RLS will not show: a missing row and a forbidden row
  // look the same from here, which is the right answer to give either way.
  if (!client) notFound();

  const [packages, lessons] = await Promise.all([
    listPackages(id),
    clientLessons(id),
  ]);

  return (
    <>
      <LessonsHeader email={viewer.email} active="clients" />
      <main className="container">
        <ClientDetail client={client} packages={packages} lessons={lessons} />
      </main>
    </>
  );
}
