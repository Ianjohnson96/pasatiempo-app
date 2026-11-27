import { describe, expect, it } from "vitest";
import {
  deadlineFact,
  liveEvent,
  parseRules,
  selfServiceError,
  signupPhase,
  windowNote,
  windowError,
} from "./signup-window";
import type { EventRec } from "./types";

// Times are in the club's zone (Pacific, PDT = UTC-7 in spring).
const at = (s: string) => new Date(s);
const ev = (over: Partial<EventRec> = {}): EventRec =>
  ({
    status: "open",
    startsAt: "2027-06-25T15:00:00.000Z",
    rules: null,
    contactName: null,
    contactEmail: null,
    ...over,
  }) as unknown as EventRec;
const rules = (r: object) => ev({ rules: { opensAt: null, closesAt: null, changesAfterClose: false, autoPromote: false, ...r } });

const OPENS = "2027-04-01T15:00:00.000Z"; // Thu, Apr 1, 8:00 AM
const CLOSES = "2027-05-01T00:00:00.000Z"; // Fri, Apr 30, 5:00 PM

describe("parseRules", () => {
  it("keeps valid dates and drops junk", () => {
    expect(parseRules({ opensAt: OPENS, closesAt: "nope", changesAfterClose: "yes" })).toEqual({
      opensAt: OPENS,
      closesAt: null,
      changesAfterClose: false,
      autoPromote: false,
    });
  });
  it("nothing set is no rules at all", () => {
    expect(parseRules(null)).toBeNull();
    expect(parseRules({})).toBeNull();
    expect(parseRules({ opensAt: null, closesAt: null, changesAfterClose: false })).toBeNull();
  });
  it("moving the waitlist up automatically is a setting of its own", () => {
    expect(parseRules({ autoPromote: true })).toEqual({
      opensAt: null,
      closesAt: null,
      changesAfterClose: false,
      autoPromote: true,
    });
    expect(parseRules({ opensAt: OPENS })?.autoPromote).toBe(false);
  });
  it("keeps the change setting with a deadline", () => {
    expect(parseRules({ closesAt: CLOSES, changesAfterClose: true })?.changesAfterClose).toBe(true);
  });
});

describe("signupPhase", () => {
  it("follows the event's own status first", () => {
    expect(signupPhase(ev({ status: "draft" }), at("2027-04-10T00:00:00Z"))).toBe("draft");
    expect(signupPhase(ev({ status: "closed" }), at("2027-04-10T00:00:00Z"))).toBe("closed");
  });
  it("an open event with no dates is open", () => {
    expect(signupPhase(ev(), at("2027-04-10T00:00:00Z"))).toBe("open");
  });
  it("is not open yet before the opening time", () => {
    expect(signupPhase(rules({ opensAt: OPENS }), at("2027-04-01T14:59:00Z"))).toBe("soon");
    expect(signupPhase(rules({ opensAt: OPENS }), at("2027-04-01T15:00:00Z"))).toBe("open");
  });
  it("closes at the deadline", () => {
    expect(signupPhase(rules({ closesAt: CLOSES }), at("2027-04-30T23:59:00Z"))).toBe("open");
    expect(signupPhase(rules({ closesAt: CLOSES }), at("2027-05-01T00:00:00Z"))).toBe("deadline");
  });
});

describe("liveEvent", () => {
  it("an event past its deadline reads as closed to the page", () => {
    expect(liveEvent(rules({ closesAt: CLOSES }), at("2027-05-02T00:00:00Z")).status).toBe("closed");
  });
  it("before opening it isn't open either", () => {
    expect(liveEvent(rules({ opensAt: OPENS }), at("2027-03-01T00:00:00Z")).status).toBe("closed");
  });
  it("otherwise it is the same event", () => {
    const e = rules({ closesAt: CLOSES });
    expect(liveEvent(e, at("2027-04-02T00:00:00Z"))).toBe(e);
  });
});

describe("windowNote", () => {
  it("before opening says when sign-ups open", () => {
    expect(windowNote(rules({ opensAt: OPENS }), at("2027-03-01T00:00:00Z"))).toEqual({
      tone: "soon",
      text: "Sign-ups open Thu, Apr 1 at 8:00 AM",
    });
  });
  it("names the deadline while open", () => {
    expect(windowNote(rules({ closesAt: CLOSES }), at("2027-04-01T00:00:00Z"))).toEqual({
      tone: "open",
      text: "Sign-ups close Fri, Apr 30 at 5:00 PM",
    });
  });
  it("counts down the last week", () => {
    expect(windowNote(rules({ closesAt: CLOSES }), at("2027-04-27T19:00:00Z"))?.text).toBe(
      "Sign-ups close Fri, Apr 30 at 5:00 PM · 3 days left",
    );
  });
  it("says today or tomorrow on the last two days", () => {
    expect(windowNote(rules({ closesAt: CLOSES }), at("2027-04-30T16:00:00Z"))).toEqual({
      tone: "last",
      text: "Sign-ups close today at 5:00 PM",
    });
    expect(windowNote(rules({ closesAt: CLOSES }), at("2027-04-29T16:00:00Z"))?.text).toBe(
      "Sign-ups close tomorrow at 5:00 PM",
    );
  });
  it("after the deadline says sign-ups closed", () => {
    expect(windowNote(rules({ closesAt: CLOSES }), at("2027-05-03T00:00:00Z"))).toEqual({
      tone: "closed",
      text: "Sign-ups closed Fri, Apr 30",
    });
  });
  it("nothing to say without dates, or on a draft", () => {
    expect(windowNote(ev(), at("2027-04-01T00:00:00Z"))).toBeNull();
    expect(
      windowNote({ ...rules({ closesAt: CLOSES }), status: "draft" } as EventRec, at("2027-04-01T00:00:00Z")),
    ).toBeNull();
  });
});

describe("deadlineFact", () => {
  it("the deadline as a key fact", () => {
    expect(deadlineFact(rules({ closesAt: CLOSES }))).toEqual({ k: "Entry deadline", v: "Fri, Apr 30", sub: "5:00 PM" });
    expect(deadlineFact(ev())).toBeNull();
  });
});

describe("selfServiceError", () => {
  const after = at("2027-05-02T00:00:00Z");
  it("open events allow changes", () => {
    expect(selfServiceError(rules({ closesAt: CLOSES }), at("2027-04-02T00:00:00Z"))).toBeNull();
  });
  it("after the deadline, changes go through the contact", () => {
    expect(selfServiceError(rules({ closesAt: CLOSES }), after)).toBe(
      "The entry deadline has passed — to change or withdraw, email Ian Johnson at Ijohnson@pasatiempo.com.",
    );
  });
  it("unless the event allows changes after the deadline, until it starts", () => {
    const e = rules({ closesAt: CLOSES, changesAfterClose: true });
    expect(selfServiceError(e, after)).toBeNull();
    expect(selfServiceError(e, at("2027-06-25T16:00:00Z"))).not.toBeNull();
  });
  it("a closed event sends people to the contact", () => {
    expect(selfServiceError(ev({ status: "closed" }), after)).toBe(
      "This event is closed — to change or withdraw, email Ian Johnson at Ijohnson@pasatiempo.com.",
    );
  });
});

describe("windowError (editor)", () => {
  it("the deadline must come after the opening", () => {
    expect(windowError({ opensAt: CLOSES, closesAt: OPENS })).toBe(
      "The entry deadline must be after sign-ups open.",
    );
    expect(windowError({ opensAt: OPENS, closesAt: CLOSES })).toBeNull();
    expect(windowError({ opensAt: null, closesAt: null })).toBeNull();
  });
});
