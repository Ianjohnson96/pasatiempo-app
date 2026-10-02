import { notFound } from "next/navigation";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import ClientDetail from "@/components/lessons/ClientDetail";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import { isUuid } from "@/lib/lessons/calc";
import {
  clientLessons,
  getClient,
  listPackages,
  reviewCount,
  singleRates,
} from "@/lib/lessons/data";

// One client: packages, lesson history, and the controls to connect them.
export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A mangled link is "not found", not a database error about uuid syntax.
  if (!isUuid(id)) notFound();

  // One round of reads, not three in a row, alongside the gate (see gate.ts).
  const [viewer, [client, packages, lessons, waiting, rates]] = await gateFirst(
    requireLessonBook(),
    Promise.all([
      getClient(id),
      listPackages(id),
      clientLessons(id),
      reviewCount(),
      singleRates(),
    ]),
  );
  // Also covers an id RLS will not show: a missing row and a forbidden row
  // look the same from here, which is the right answer to give either way.
  if (!client) notFound();

  return (
    <>
      <LessonsHeader email={viewer.email} active="clients" waiting={waiting} />
      <main className="container">
        <ClientDetail
          client={client}
          packages={packages}
          lessons={lessons}
          rates={rates}
        />
      </main>
    </>
  );
}
