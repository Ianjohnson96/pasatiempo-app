import Link from "next/link";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import LessonLedger from "@/components/lessons/LessonLedger";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import { lessonLedger, listPackageOptions, reviewCount } from "@/lib/lessons/data";

// Every lesson in date order with the money against it - the other way round
// from Billing, which works a client at a time. Walking the days is how a
// lesson nobody billed gets found.
export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const [viewer, [data, waiting, options]] = await gateFirst(
    requireLessonBook(),
    Promise.all([lessonLedger(), reviewCount(), listPackageOptions()]),
  );
  // Packages only: a lesson is moved onto a series, never onto someone's single.
  const packages = options.filter((p) => p.kind === "package");

  return (
    <>
      <LessonsHeader email={viewer.email} active="ledger" waiting={waiting} />
      <main className="container">
        <div className="lb-sechead">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Lessons
          </h2>
          {/* The same job from the money's side, a whole client at once. */}
          <Link href="/lessons/billing">Bill by client &rarr;</Link>
        </div>
        <p className="lb-fhint" style={{ marginTop: 0 }}>
          Newest first. Amounts come from what the client paid last time, and
          anything the calendar title already said &mdash; &ldquo;3 of
          5&rdquo;, &ldquo;[paid]&rdquo; &mdash; is offered, never assumed.
        </p>
        <LessonLedger data={data} packages={packages} />
      </main>
    </>
  );
}
