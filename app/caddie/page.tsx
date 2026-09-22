import "@/app/globals.css";
import CaddiePortal, {
  type OpenLoop,
  type PortalLoop,
} from "@/components/caddie/CaddiePortal";
import {
  formatTee,
  getSettings,
  openBoardLoops,
  openWorkFor,
} from "@/lib/caddie/data";
import { getCaddieSession } from "@/lib/caddie/session";
import { rateFor } from "@/lib/caddie/types";

// The caddie's own page: what they have been offered, and what they are on for.
//
// Signed out, this is the front door — it explains how to get in, because with
// no email or SMS the only way is a link from the Pro Shop.
export const dynamic = "force-dynamic";

// Why a scan did not sign them in. The claim route redirects here with a
// reason rather than rendering its own page, so there is one signed-out screen
// instead of two that can drift apart.
const REASONS: Record<string, string> = {
  invalid: "That link was not valid. Ask the Pro Shop for a new one.",
  expired: "That link had expired. Ask the Pro Shop to show you a new one.",
  inactive: "This account is not active. Check with the Pro Shop.",
};

export default async function CaddiePortalHome({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const caddie = await getCaddieSession();

  if (!caddie) {
    const { reason } = await searchParams;
    const problem = reason ? REASONS[reason] : null;

    return (
      <main
        className="container narrow"
        style={{ paddingTop: 56, maxWidth: 420 }}
      >
        <p className="eyebrow">Pasatiempo Caddies</p>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>
          {problem ? "That link did not work" : "You are signed out"}
        </h1>
        {problem && <p className="notice err">{problem}</p>}
        <p className="lead">
          Ask the Pro Shop to show you a sign-in link. Scan it with your phone
          camera and you will stay signed in on this phone for 90 days.
        </p>
      </main>
    );
  }

  const settings = await getSettings();
  const tz = settings.courseTimezone;
  const [work, posted] = await Promise.all([
    openWorkFor(caddie.id),
    openBoardLoops(caddie.id),
  ]);

  const dayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const items: PortalLoop[] = work.map(({ assignment, loop }) => ({
    assignmentId: assignment.id,
    status: assignment.confirmationStatus,
    offerExpiresAt: assignment.offerExpiresAt,
    teeLabel: formatTee(loop.teeTime, tz),
    dayLabel: dayLabel.format(new Date(loop.teeTime)),
    teeTime: loop.teeTime,
    playerName: loop.playerName,
    loopType: loop.loopType,
    holes: loop.holes,
    notes: loop.notes,
    rateCents: rateFor(settings.rates, loop.loopType),
  }));

  const open: OpenLoop[] = posted.map((loop) => ({
    loopId: loop.id,
    teeLabel: formatTee(loop.teeTime, tz),
    dayLabel: dayLabel.format(new Date(loop.teeTime)),
    playerName: loop.playerName,
    loopType: loop.loopType,
    holes: loop.holes,
    notes: loop.notes,
    rateCents: rateFor(settings.rates, loop.loopType),
  }));

  return (
    <CaddiePortal
      caddie={caddie}
      items={items}
      open={open}
      vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
    />
  );
}
