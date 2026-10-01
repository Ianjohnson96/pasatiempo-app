import LessonsHeader from "@/components/lessons/LessonsHeader";
import ClientList from "@/components/lessons/ClientList";
import { requireLessonBook } from "@/lib/lessons/auth";
import { listClientSummaries } from "@/lib/lessons/data";

// Everyone Ian teaches, with what they owe and when he last saw them.
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const viewer = await requireLessonBook();
  const clients = await listClientSummaries();

  return (
    <>
      <LessonsHeader email={viewer.email} active="clients" />
      <main className="container">
        <ClientList clients={clients} />
      </main>
    </>
  );
}
