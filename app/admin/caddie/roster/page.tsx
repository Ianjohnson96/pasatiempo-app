import { redirect } from "next/navigation";
import { getViewer } from "@/lib/events/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import RosterManager from "@/components/caddie/RosterManager";
import { caddieReach, listCaddies, listTiers } from "@/lib/caddie/data";

// The caddie roster — who exists, how to reach them, and what rank they carry.
export const dynamic = "force-dynamic";

export default async function CaddieRosterPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const [caddies, tiers, reach] = await Promise.all([
    listCaddies(),
    listTiers(),
    caddieReach(),
  ]);

  return (
    <>
      <CaddieHeader email={viewer.email} active="roster" />
      <main className="container">
        <RosterManager
          caddies={caddies}
          tiers={tiers}
          reach={Object.fromEntries(reach)}
        />
      </main>
    </>
  );
}
