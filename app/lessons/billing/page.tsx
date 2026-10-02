import LessonsHeader from "@/components/lessons/LessonsHeader";
import BillingBoard from "@/components/lessons/BillingBoard";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import { billingData, reviewCount } from "@/lib/lessons/data";

// Put an amount and a payment on every lesson that has none, a client at a
// time, from one screen - instead of a trip to each client's page.
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const [viewer, [data, waiting]] = await gateFirst(
    requireLessonBook(),
    Promise.all([billingData(), reviewCount()]),
  );

  return (
    <>
      <LessonsHeader email={viewer.email} active="billing" waiting={waiting} />
      <main className="container">
        <p className="lb-fhint" style={{ marginTop: 0 }}>
          Each lesson becomes its own single &mdash; never bundled. Amount and
          method start from what the client paid last time; paid dates are
          each lesson&apos;s own day.
        </p>
        <BillingBoard data={data} />
      </main>
    </>
  );
}
