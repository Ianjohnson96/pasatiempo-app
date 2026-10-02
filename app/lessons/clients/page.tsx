import LessonsHeader from "@/components/lessons/LessonsHeader";
import ClientList from "@/components/lessons/ClientList";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import { listClientSummaries, reviewCount } from "@/lib/lessons/data";

// Everyone Ian teaches, with what they owe and when he last saw them.
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  // Reads run alongside the gate (RLS guards them); gateFirst lets the gate's
  // redirect win for a signed-out visitor.
  const [viewer, [clients, waiting]] = await gateFirst(
    requireLessonBook(),
    Promise.all([listClientSummaries(), reviewCount()]),
  );

  return (
    <>
      <LessonsHeader email={viewer.email} active="clients" waiting={waiting} />
      <main className="container">
        <ClientList clients={clients} />
      </main>
    </>
  );
}
