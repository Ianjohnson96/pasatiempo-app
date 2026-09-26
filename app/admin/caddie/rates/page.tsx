import { requireCaddieStaff } from "@/lib/caddie/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import RatesEditor from "@/components/caddie/RatesEditor";
import { getSettings } from "@/lib/caddie/data";

// What a caddie is paid for each kind of loop. The money itself changes hands
// in person, player to caddie — this screen only sets the agreed figure.
export const dynamic = "force-dynamic";

export default async function CaddieRatesPage() {
  const viewer = await requireCaddieStaff();

  const settings = await getSettings();

  return (
    <>
      <CaddieHeader email={viewer.email} active="rates" />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>Caddie Rates</h1>
            <div className="sub">
              Shown to the caddie with every offer, and on the dispatch board.
            </div>
          </div>
        </div>
        <RatesEditor rates={settings.rates} />
      </main>
    </>
  );
}
