import { describe, expect, it } from "vitest";
import { coversSlot, rankCandidates, type DayAvailability } from "./data";
import type {
  AvailabilityStatus,
  CaddieRec,
  LoopRec,
  LoopWithCrew,
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
    rank: "B",
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
    requestedRank: null,
    requestedCaddieId: null,
    status: "Unassigned",
    openBoard: false,
    createdBy: null,
    ...over,
  };
}

function said(
  slot: DayAvailability["slot"],
  status: AvailabilityStatus = "Available",
): DayAvailability {
  return { slot, status };
}

describe("coversSlot", () => {
  it("treats All Day as covering both halves", () => {
    expect(coversSlot(said("All Day"), "AM")).toBe(true);
    expect(coversSlot(said("All Day"), "PM")).toBe(true);
  });

  it("does not stretch a morning answer over the afternoon", () => {
    expect(coversSlot(said("AM"), "AM")).toBe(true);
    expect(coversSlot(said("AM"), "PM")).toBe(false);
    expect(coversSlot(said("PM"), "AM")).toBe(false);
  });

  it("ignores the slot when the answer was no", () => {
    expect(coversSlot(said("All Day", "Unavailable"), "AM")).toBe(false);
    expect(coversSlot(said("AM", "Unavailable"), "AM")).toBe(false);
  });
});

describe("rankCandidates and the half of the day", () => {
  const morning = caddie("morning-only");
  const allDay = caddie("all-day");
  const silent = caddie("never-answered");
  const roster = [morning, allDay, silent];

  const availability = new Map<string, DayAvailability>([
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
  it("floats the requested caddie to the top regardless of rank", () => {
    const honor = caddie("honor", { rank: "Honor" });
    const asked = caddie("asked", { rank: "B" });
    const l = loop(AM_LOOP_UTC, { requestedCaddieId: asked.id });

    const order = rankCandidates(
      l,
      [honor, asked],
      [{ loop: l, crew: [] }],
      new Map(),
      4,
    ).map((c) => c.caddie.id);

    expect(order[0]).toBe(asked.id);
  });

  it("prefers the caddie who has waited longest at equal rank", () => {
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
