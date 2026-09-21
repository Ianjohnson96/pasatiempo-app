import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/events/auth";
import CaddieHeader from "@/components/caddie/CaddieHeader";
import DispatchBoard, {
  type BoardCandidate,
} from "@/components/caddie/DispatchBoard";
import {
  alertCoverage,
  availabilityFor,
  bookingNames,
  caddieReach,
  courseToday,
  expireStaleOffers,
  formatDay,
  formatTee,
  getSettings,
  listCaddies,
  listTiers,
  loopsForDay,
  pastLoopIds,
  rankCandidates,
} from "@/lib/caddie/data";
import { pushConfigured } from "@/lib/caddie/push";

// The Pro Shop's dispatch board. Access is gated by the proxy (signed-in
// Supabase user) and re-checked here, the same as every other /admin route.
export const dynamic = "force-dynamic";

export default async function CaddieDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const settings = await getSettings();
  const tz = settings.courseTimezone;
  const today = courseToday(tz);

  const { day: requested } = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(requested ?? "")
    ? (requested as string)
    : today;

  // Close offers whose window has passed before drawing the board, so nothing
  // here claims to be waiting on a caddie who can no longer accept. The nightly
  // cron does the same, but once a day is no use against a 20-minute window.
  await expireStaleOffers();

  const [loops, caddies, availability, reach] = await Promise.all([
    loopsForDay(day, tz),
    listCaddies(),
    availabilityFor(day),
    caddieReach(),
  ]);
  const tiers = await listTiers();

  const coverage = alertCoverage(reach);

  const past = pastLoopIds(loops);

  // Ranking runs here rather than in the browser: it reads every caddie's work
  // history and the whole day's accepted loops, none of which the client needs.
  const groups = await bookingNames(
    loops.map(({ loop }) => loop.bookingId).filter((id): id is string => !!id),
  );

  const candidatesByLoop: Record<string, BoardCandidate[]> = {};
  const teeLabels: Record<string, string> = {};
  for (const { loop } of loops) {
    teeLabels[loop.id] = formatTee(loop.teeTime, tz);
    candidatesByLoop[loop.id] = rankCandidates(
      loop,
      caddies,
      loops,
      availability,
      settings.overlapGuardHours,
    ).map((c) => ({
      caddie: c.caddie,
      availability: c.availability,
      alreadyOffered: c.alreadyOffered,
      conflict: c.conflict,
    }));
  }

  return (
    <>
      <CaddieHeader email={viewer.email} active="dispatch" />

      <main className="container">
        <DispatchBoard
          day={day}
          dayLabel={formatDay(day, tz)}
          today={today}
          loops={loops}
          candidatesByLoop={candidatesByLoop}
          teeLabels={teeLabels}
          pastLoopIds={past}
          groupNames={Object.fromEntries(groups)}
          coverage={coverage}
          tiers={tiers}
          rates={settings.rates}
          notifyReady={pushConfigured()}
        />

        {caddies.length === 0 && (
          <p className="notice warn" style={{ marginTop: 18 }}>
            The caddie roster is empty, so there is no one to offer a loop to
            yet. Loops can still be entered.{" "}
            <Link href="/admin/caddie/roster">Add caddies →</Link>
          </p>
        )}
      </main>
    </>
  );
}
