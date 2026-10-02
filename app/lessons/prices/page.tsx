import Link from "next/link";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import PriceBacklog from "@/components/lessons/PriceBacklog";
import StandardPrices from "@/components/lessons/StandardPrices";
import SingleRates from "@/components/lessons/SingleRates";
import { requireLessonBook } from "@/lib/lessons/auth";
import { gateFirst } from "@/lib/lessons/gate";
import {
  listPackages,
  reviewCount,
  singleRates,
  standardPrices,
} from "@/lib/lessons/data";

// Standard prices, and the packages still waiting for one.
export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const [viewer, [prices, rates, packages, waiting]] = await gateFirst(
    requireLessonBook(),
    Promise.all([
      standardPrices(),
      singleRates(),
      listPackages(),
      reviewCount(),
    ]),
  );
  const unpriced = packages.filter((p) => p.priceCents === null);

  return (
    <>
      <LessonsHeader email={viewer.email} active="dashboard" waiting={waiting} />
      <main className="container">
        <p style={{ marginBottom: 10 }}>
          <Link href="/lessons" className="muted">
            &larr; Dashboard
          </Link>
        </p>
        {/* Keyed on the saved list so a save elsewhere resets the editor. */}
        <SingleRates key={JSON.stringify(rates)} rates={rates} />
        <StandardPrices key={JSON.stringify(prices)} prices={prices} />
        <PriceBacklog packages={unpriced} prices={prices} rates={rates} />
      </main>
    </>
  );
}
