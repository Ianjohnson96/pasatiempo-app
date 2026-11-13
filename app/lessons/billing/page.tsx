import Link from "next/link";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import BillingBoard from "@/components/lessons/BillingBoard";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import { billingData, listPackageOptions, reviewCount } from "@/lib/lessons/data";

// Put an amount and a payment on every lesson that has none, a client at a
// time, from one screen - instead of a trip to each client's page.
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const [viewer, [data, waiting, options]] = await gateFirst(
    requireLessonBook(),
    Promise.all([billingData(), reviewCount(), listPackageOptions()]),
  );
  // For Catch up's "part of a package?" - series only, never a single.
  const packages = options.filter((p) => p.kind === "package");

  return (
    <>
      <LessonsHeader email={viewer.email} active="billing" waiting={waiting} />
      <main className="container">
        <div className="lb-sechead">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Billing
          </h2>
          {/* What came in, as against what is owed. */}
          <Link href="/lessons/payments">Payments received &rarr;</Link>
        </div>
        <p className="lb-fhint" style={{ marginTop: 0 }}>
          Each lesson becomes its own single &mdash; never bundled. Amount and
          method start from what the client paid last time; paid dates are
          each lesson&apos;s own day.
        </p>
        <BillingBoard data={data} packages={packages} />
      </main>
    </>
  );
}
