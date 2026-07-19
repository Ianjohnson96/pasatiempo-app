import EventSite from "@/components/mhi/EventSite";
import { getTeams } from "@/lib/mhi/teams";

// Marion Hollins Invitational — public tournament microsite (its own domain).
// Data lives in the hub's `mhi` schema. Re-fetch at most once a minute so roster
// updates appear without a redeploy.
export const revalidate = 60;

export default async function MhiPage() {
  const teams = await getTeams();
  return <EventSite teams={teams} />;
}
