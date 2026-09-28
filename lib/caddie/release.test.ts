import { describe, expect, it } from "vitest";
import { nextBoardStep, releaseAtMs, withinHorizon } from "./release";
import type { JobRelease } from "./types";

const TZ = "America/Los_Angeles";

const OFF: JobRelease = {
  enabled: false,
  daysBefore: 1,
  time: "18:00",
  horizonDays: 0,
  priorityEnabled: false,
  priorityMinLeadHours: 48,
  priorityMinutes: 30,
};
const rules = (over: Partial<JobRelease> = {}): JobRelease => ({ ...OFF, ...over });
const iso = (ms: number) => new Date(ms).toISOString();

// Sat Oct 10 2026, 12:20 PDT (UTC-7).
const TEE = "2026-10-10T19:20:00.000Z";

describe("releaseAtMs", () => {
  it("is always released when release is off", () => {
    expect(releaseAtMs(TEE, OFF, TZ)).toBe(Number.NEGATIVE_INFINITY);
  });

  it("the day before at 6pm, course time", () => {
    // Fri Oct 9, 18:00 PDT = Oct 10 01:00 UTC.
    expect(iso(releaseAtMs(TEE, rules({ enabled: true }), TZ))).toBe(
      "2026-10-10T01:00:00.000Z",
    );
  });

  it("the morning of", () => {
    // Sat Oct 10, 06:00 PDT = 13:00 UTC.
    expect(
      iso(releaseAtMs(TEE, rules({ enabled: true, daysBefore: 0, time: "06:00" }), TZ)),
    ).toBe("2026-10-10T13:00:00.000Z");
  });

  // Clocks go back at 2am on Sun Nov 1 2026. A 6pm release that day is 6pm
  // PST, i.e. 02:00 UTC on the 2nd. Midnight-plus-eighteen-hours would put it
  // at 01:00 UTC — an hour early, on exactly the one night it matters.
  it("lands on the right hour on the day the clocks change", () => {
    const monday = "2026-11-02T17:00:00.000Z"; // Mon Nov 2, 09:00 PST
    expect(iso(releaseAtMs(monday, rules({ enabled: true }), TZ))).toBe(
      "2026-11-02T02:00:00.000Z",
    );
  });
});

describe("withinHorizon", () => {
  const now = Date.parse("2026-10-01T19:20:00.000Z");
  it("always, with no horizon", () => {
    expect(withinHorizon(TEE, OFF, now)).toBe(true);
  });
  it("in, when the tee time is inside it", () => {
    expect(withinHorizon(TEE, rules({ horizonDays: 14 }), now)).toBe(true);
  });
  it("out, when it is further away", () => {
    expect(withinHorizon(TEE, rules({ horizonDays: 7 }), now)).toBe(false);
  });
});

describe("nextBoardStep", () => {
  const step = (over: Partial<Parameters<typeof nextBoardStep>[0]>) =>
    nextBoardStep({
      teeTimeIso: TEE,
      postedAtIso: "2026-09-01T00:00:00.000Z",
      priorityOffered: false,
      priorityPending: false,
      nowMs: Date.parse("2026-10-09T12:00:00.000Z"),
      rules: OFF,
      tz: TZ,
      ...over,
    });

  it("announces at once with everything off, as the board always has", () => {
    expect(step({})).toBe("announce");
  });

  it("waits until the release time", () => {
    const r = rules({ enabled: true });
    expect(step({ rules: r, nowMs: Date.parse("2026-10-10T00:59:00.000Z") })).toBe("wait");
    expect(step({ rules: r, nowMs: Date.parse("2026-10-10T01:00:00.000Z") })).toBe("announce");
  });

  it("never opens before the shop posted it, even after the release time", () => {
    const posted = "2026-10-10T05:00:00.000Z";
    expect(
      step({
        rules: rules({ enabled: true }),
        postedAtIso: posted,
        nowMs: Date.parse("2026-10-10T04:00:00.000Z"),
      }),
    ).toBe("wait");
  });

  it("waits while the job is beyond the horizon", () => {
    expect(
      step({ rules: rules({ horizonDays: 7 }), nowMs: Date.parse("2026-09-25T00:00:00.000Z") }),
    ).toBe("wait");
  });

  it("gives next-up first refusal on a job booked well ahead", () => {
    // 60 hours out, threshold 48.
    const now = Date.parse(TEE) - 60 * 3_600_000;
    expect(step({ rules: rules({ priorityEnabled: true }), nowMs: now })).toBe("priority");
  });

  it("does not hold up a job needed soon", () => {
    const now = Date.parse(TEE) - 10 * 3_600_000;
    expect(step({ rules: rules({ priorityEnabled: true }), nowMs: now })).toBe("announce");
  });

  it("waits while next-up is still deciding", () => {
    const now = Date.parse(TEE) - 60 * 3_600_000;
    expect(
      step({
        rules: rules({ priorityEnabled: true }),
        nowMs: now,
        priorityOffered: true,
        priorityPending: true,
      }),
    ).toBe("wait");
  });

  it("opens to everyone once first refusal has been given and ended", () => {
    const now = Date.parse(TEE) - 59 * 3_600_000;
    expect(
      step({ rules: rules({ priorityEnabled: true }), nowMs: now, priorityOffered: true }),
    ).toBe("announce");
  });

  it("applies release, then priority, in that order", () => {
    const r = rules({ enabled: true, priorityEnabled: true, priorityMinLeadHours: 12 });
    // Before release: wait, whatever priority would say.
    expect(step({ rules: r, nowMs: Date.parse("2026-10-10T00:00:00.000Z") })).toBe("wait");
    // After release, 18h out: first refusal.
    expect(step({ rules: r, nowMs: Date.parse("2026-10-10T01:20:00.000Z") })).toBe("priority");
  });
});
