import { redirect } from "next/navigation";
import { getViewer } from "@/lib/events/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import TierManager from "@/components/caddie/TierManager";
import WaterfallEditor from "@/components/caddie/WaterfallEditor";
import { caddieCountByTier, getSettings, listTiers } from "@/lib/caddie/data";

// The club's seniority ladder. Shop guys, veterans, whoever else — the shop's
// own words and the shop's own order, because it drives who gets offered a loop
// first and nobody else can define that for them.
export const dynamic = "force-dynamic";

export default async function CaddieTiersPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const [tiers, counts, settings] = await Promise.all([
    listTiers(),
    caddieCountByTier(),
    getSettings(),
  ]);

  return (
    <>
      <CaddieHeader email={viewer.email} active="tiers" />
      <main className="container">
        <TierManager
          tiers={tiers}
          counts={Object.fromEntries(counts)}
          untiered={counts.get("none") ?? 0}
        />
        <WaterfallEditor
          current={settings.waterfall}
          tierCount={tiers.length}
        />
      </main>
    </>
  );
}
