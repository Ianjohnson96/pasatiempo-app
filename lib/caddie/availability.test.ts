import { describe, expect, it } from "vitest";
import {
  rankCandidates,
  resolveDay,
  resolvedCovers,
  weekdayOf,
  type UsualWeek,
} from "./data";
import type {
  AvailabilityStatus,
  AwayPeriod,
  CaddieRec,
  LoopRec,
  LoopWithCrew,
  ResolvedDay,
  TimeSlot,
} from "./types";

// Availability is only useful if it is read for the right half of the day.
// Saying "I can work mornings" is not an offer to caddie at three in the
// afternoon, and a dispatcher told otherwise will ring the wrong person.
//
// Tee times are UTC here because that is what Postgres returns. Pasatiempo runs
// on America/Los_Angeles, so in September (PDT, UTC-7):
//   15:00Z -> 08:00 local, an AM loop
//   22:00Z -> 15:00 local, a PM loop

const AM_LOOP_UTC = "2026-09-21T15:00:00Z";
const PM_LOOP_UTC = "2026-09-21T22:00:00Z";

function caddie(id: string, over: Partial<CaddieRec> = {}): CaddieRec {
  return {
    id,
    fullName: id,
    phone: null,
    email: null,
    tierId: null,
    tierName: null,
    tierOrder: 9999,
    status: "Active",
    preferredContactMethod: "Both",
    smsOptIn: false,
    lastWorkedOn: null,
    notes: "",
    ...over,
  };
}

function loop(teeTime: string, over: Partial<LoopRec> = {}): LoopRec {
  return {
    id: "loop-1",
    teeTime,
    playerName: "Member",
    loopType: "Single Bag",
    caddiesRequired: 1,
    holes: 18,
    notes: "",
    bookingId: null,
    status: "Unassigned",
    openBoard: false,
    createdBy: null,
    createdAt: null,
    cancelledBy: null,
    cancelledAt: null,
    ...over,
  };
}

function said(
  slot: TimeSlot,
  status: AvailabilityStatus = "Available",
): ResolvedDay {
  return status === "Available"
    ? { slot, status, source: "day" }
    : { slot: null, status, source: "day" };
}

describe("resolvedCovers", () => {
  it("treats All Day as covering both halves", () => {
    expect(resolvedCovers(said("All Day"), "AM")).toBe(true);
    expect(resolvedCovers(said("All Day"), "PM")).toBe(true);
  });

  it("does not stretch a morning answer over the afternoon", () => {
    expect(resolvedCovers(said("AM"), "AM")).toBe(true);
    expect(resolvedCovers(said("AM"), "PM")).toBe(false);
    expect(resolvedCovers(said("PM"), "AM")).toBe(false);
  });

  it("ignores the slot when the answer was no", () => {
    expect(resolvedCovers(said("All Day", "Unavailable"), "AM")).toBe(false);
  });
});

// The precedence between an away period, a specific day and the usual week is
// the whole point of asking caddies months ahead. Getting it wrong sends
// someone a loop while they are on a plane.
describe("resolveDay precedence", () => {
  const away = (startsOn: string, endsOn: string, reason = ""): AwayPeriod => ({
    id: "a1",
    caddieId: "c1",
    startsOn,
    endsOn,
    reason,
  });

  const usual: UsualWeek = new Map([
    [0, "All Day"], // Sunday
    [6, "AM"], // Saturday
    [2, "Off"], // Tuesday
  ]);

  it("knows nothing when nothing has been said", () => {
    const r = resolveDay("2026-10-07", {});
    expect(r.status).toBe("Unknown");
    expect(r.source).toBe("none");
  });

  it("falls back to the usual week", () => {
    // 2026-10-03 is a Saturday.
    expect(weekdayOf("2026-10-03")).toBe(6);
    const r = resolveDay("2026-10-03", { usual });
    expect(r).toMatchObject({ slot: "AM", status: "Available", source: "usual" });
  });

  it("treats a standing Off as a deliberate no, not unknown", () => {
    // 2026-10-06 is a Tuesday.
    const r = resolveDay("2026-10-06", { usual });
    expect(r).toMatchObject({ status: "Unavailable", source: "usual" });
  });

  it("lets a specific day override the usual week", () => {
    const r = resolveDay("2026-10-03", {
      usual,
      override: { slot: "PM", status: "Available" },
    });
    expect(r).toMatchObject({ slot: "PM", source: "day" });
  });

  it("lets an away period beat both", () => {
    const r = resolveDay("2026-10-03", {
      usual,
      override: { slot: "All Day", status: "Available" },
      away: [away("2026-10-01", "2026-10-14", "Mexico")],
    });
    expect(r).toMatchObject({
      status: "Unavailable",
      source: "away",
      reason: "Mexico",
    });
  });

  it("includes both ends of an away period", () => {
    const period = [away("2026-10-01", "2026-10-03")];
    expect(resolveDay("2026-10-01", { away: period }).source).toBe("away");
    expect(resolveDay("2026-10-03", { away: period }).source).toBe("away");
    expect(resolveDay("2026-10-04", { away: period }).source).toBe("none");
  });

  it("labels an away period with no reason rather than leaving it blank", () => {
    const r = resolveDay("2026-10-02", { away: [away("2026-10-01", "2026-10-03")] });
    expect(r.reason).toBe("Away");
  });
});

describe("rankCandidates and the half of the day", () => {
  const morning = caddie("morning-only");
  const allDay = caddie("all-day");
  const silent = caddie("never-answered");
  const roster = [morning, allDay, silent];

  const availability = new Map<string, ResolvedDay>([
    [morning.id, said("AM")],
    [allDay.id, said("All Day")],
  ]);

  const rank = (teeTime: string) => {
    const l = loop(teeTime);
    const day: LoopWithCrew[] = [{ loop: l, crew: [] }];
    return rankCandidates(l, roster, day, availability, 4);
  };

  it("counts a morning caddie as available for a morning loop", () => {
    const byId = new Map(rank(AM_LOOP_UTC).map((c) => [c.caddie.id, c]));
    expect(byId.get(morning.id)?.availability).toBe("Available");
    expect(byId.get(allDay.id)?.availability).toBe("Available");
  });

  it("counts that same caddie as unavailable for an afternoon loop", () => {
    const byId = new Map(rank(PM_LOOP_UTC).map((c) => [c.caddie.id, c]));
    expect(byId.get(morning.id)?.availability).toBe("Unavailable");
    expect(byId.get(allDay.id)?.availability).toBe("Available");
  });

  it("distinguishes never answering from answering no", () => {
    const byId = new Map(rank(AM_LOOP_UTC).map((c) => [c.caddie.id, c]));
    expect(byId.get(silent.id)?.availability).toBeNull();
  });

  it("puts the genuinely available caddie above one who is only free earlier", () => {
    const order = rank(PM_LOOP_UTC).map((c) => c.caddie.id);
    expect(order.indexOf(allDay.id)).toBeLessThan(order.indexOf(morning.id));
    // Someone who never answered still outranks someone who cannot make it.
    expect(order.indexOf(silent.id)).toBeLessThan(order.indexOf(morning.id));
  });
});

describe("rankCandidates ordering rules", () => {
  it("offers the senior tier first", () => {
    const shop = caddie("shop-guy", { tierName: "Shop", tierOrder: 10 });
    const rookie = caddie("rookie", { tierName: "Rookie", tierOrder: 30 });
    const l = loop(AM_LOOP_UTC);

    const order = rankCandidates(
      l,
      [rookie, shop],
      [{ loop: l, crew: [] }],
      new Map(),
      4,
    ).map((c) => c.caddie.id);

    expect(order).toEqual([shop.id, rookie.id]);
  });

  it("sorts a caddie with no tier below everyone who has one", () => {
    const tiered = caddie("tiered", { tierName: "Veteran", tierOrder: 20 });
    const untiered = caddie("untiered");
    const l = loop(AM_LOOP_UTC);

    const order = rankCandidates(
      l,
      [untiered, tiered],
      [{ loop: l, crew: [] }],
      new Map(),
      4,
    ).map((c) => c.caddie.id);

    expect(order).toEqual([tiered.id, untiered.id]);
  });

  it("prefers the caddie who has waited longest within a tier", () => {
    const recent = caddie("recent", { lastWorkedOn: "2026-09-19" });
    const stale = caddie("stale", { lastWorkedOn: "2026-08-01" });
    const never = caddie("never");
    const l = loop(AM_LOOP_UTC);

    const order = rankCandidates(
      l,
      [recent, stale, never],
      [{ loop: l, crew: [] }],
      new Map(),
      4,
    ).map((c) => c.caddie.id);

    expect(order).toEqual([never.id, stale.id, recent.id]);
  });

  it("leaves an inactive caddie off the list entirely", () => {
    const suspended = caddie("suspended", { status: "Suspended" });
    const ok = caddie("ok");
    const l = loop(AM_LOOP_UTC);

    const ids = rankCandidates(
      l,
      [suspended, ok],
      [{ loop: l, crew: [] }],
      new Map(),
      4,
    ).map((c) => c.caddie.id);

    expect(ids).toEqual([ok.id]);
  });

  it("sinks a caddie already booked inside the overlap window", () => {
    const busy = caddie("busy");
    const free = caddie("free");
    const target = loop(PM_LOOP_UTC);
    // An accepted loop an hour before the one being filled.
    const clash = loop("2026-09-21T21:00:00Z", { id: "loop-2" });

    const day: LoopWithCrew[] = [
      { loop: target, crew: [] },
      {
        loop: clash,
        crew: [
          {
            id: "a1",
            loopId: clash.id,
            caddieId: busy.id,
            offeredAt: "2026-09-20T00:00:00Z",
            offeredBy: null,
            offerKind: "direct",
            offerExpiresAt: null,
            confirmationStatus: "Accepted",
            respondedAt: null,
            responseChannel: null,
            caddie: busy,
          },
        ],
      },
    ];

    const ranked = rankCandidates(target, [busy, free], day, new Map(), 4);
    expect(ranked[0].caddie.id).toBe(free.id);
    expect(ranked.find((c) => c.caddie.id === busy.id)?.conflict).toBe(true);
  });
});
