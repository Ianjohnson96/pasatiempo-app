import Link from "next/link";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import PaymentsList from "@/components/lessons/PaymentsList";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import {
  listClientSummaries,
  listPackageOptions,
  listPayments,
  reviewCount,
} from "@/lib/lessons/data";

// Money that actually arrived, from the Venmo statements, and what it was for.
//
// The counterpart to Billing: that screen says what a lesson should cost, this
// one says what came in. Checking one against the other is the whole point of
// keeping them apart.
export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [viewer, [payments, clients, packages, waiting]] = await gateFirst(
    requireLessonBook(),
    Promise.all([
      listPayments(),
      listClientSummaries(),
      listPackageOptions(),
      reviewCount(),
    ]),
  );

  return (
    <>
      {/* No tab of its own - five already have to fit across a phone - so it
          sits under Billing, which is the screen it belongs beside. */}
      <LessonsHeader email={viewer.email} active="billing" waiting={waiting} />
      <main className="container">
        <div className="lb-sechead">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Payments received
          </h2>
          <Link href="/lessons/billing">Billing &rarr;</Link>
        </div>
        <p className="lb-fhint" style={{ marginTop: 0 }}>
          Imported from Venmo. Anything marked <strong>guess</strong> is mine,
          not yours &mdash; tap a button and it becomes your answer, which no
          future import will overwrite. Payments made in the shop are not here.
        </p>
        <PaymentsList
          payments={payments}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          packages={packages}
        />
      </main>
    </>
  );
}
