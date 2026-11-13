import { describe, expect, it } from "vitest";
import {
  hintSummary,
  isLessonTitle,
  nameFromTitle,
  needsSingle,
  planDelete,
  planEntry,
  planHappened,
  planMove,
  readTitle,
} from "./sync-plan";

// Every title below is one Ian actually wrote. The screen offers a package,
// a position and a paid flag from these, so a wrong read is a wrong bill.
describe("readTitle", () => {
  it("reads 'N of M' as position and size", () => {
    expect(readTitle("Jon Davies Lesson 3 of 5")).toMatchObject({
      index: 3,
      size: 5,
      series: null,
      paid: false,
    });
  });

  it("reads 'lesson N series S' as position and block, with no size", () => {
    // His other shape. "series 5" is which block, not how long it runs -
    // calling it a 5-pack here would invent a package size he never wrote.
    expect(readTitle("Meredith Hoffman lesson 2 series 5")).toMatchObject({
      index: 2,
      size: null,
      series: 5,
    });
  });

  it("takes both when both are written", () => {
    expect(readTitle("Renee tomer lesson 4 of 5 series 2")).toMatchObject({
      index: 4,
      size: 5,
      series: 2,
    });
    expect(readTitle("Jack Hutchinson lesson 1 of 5 [series 2]")).toMatchObject({
      index: 1,
      size: 5,
      series: 2,
    });
  });

  it("sees paid, bracketed or not", () => {
    expect(readTitle("Ray gorski lesson 5 of 5 paid").paid).toBe(true);
    expect(readTitle("Oscar shipper lesson 1 of 5 [paid]").paid).toBe(true);
    expect(readTitle("Jeff Ursino and Wife Lesson 1 of 3 [Paid december]").paid).toBe(
      true,
    );
  });

  it("does not read 'not paid' as paid", () => {
    expect(readTitle("Jack Hutchinson lesson 2 of 5 not paid").paid).toBe(false);
  });

  it("keeps a real aside and drops the markers", () => {
    expect(
      readTitle("Hoffman kids group lesson 4 series 6 [Nico, Cece, Natalie]").aside,
    ).toBe("Nico, Cece, Natalie");
    expect(readTitle("Oscar shipper lesson 1 of 5 [paid]").aside).toBe(null);
    expect(readTitle("Jack Hutchinson lesson 1 of 5 [series 2]").aside).toBe(null);
  });

  it("refuses a position past the size", () => {
    // "7 of 5" is a typo. Keep the size, which he writes deliberately.
    expect(readTitle("Someone lesson 7 of 5")).toMatchObject({ index: null, size: 5 });
  });

  it("says nothing about a plain title", () => {
    expect(readTitle("Lan takahashi lesson")).toMatchObject({
      index: null,
      size: null,
      series: null,
      paid: false,
    });
    expect(hintSummary(readTitle("Lan takahashi lesson"))).toBe(null);
    expect(readTitle("")).toMatchObject({ index: null, size: null });
  });

  it("will not take a bare number as a position", () => {
    // No series to anchor it, so "lesson 2" could be anything.
    expect(readTitle("Max miceli lesson 2").index).toBe(null);
  });

  it("sums up what it found", () => {
    expect(hintSummary(readTitle("Renee tomer lesson 4 of 5 series 2"))).toBe(
      "4th of 5 · series 2",
    );
    expect(hintSummary(readTitle("Ray gorski lesson 5 of 5 paid"))).toBe(
      "5th of 5 · paid",
    );
  });
});

// The title rules Ian was told to follow. If one of these breaks, the advice
// on the Review page is wrong.
describe("nameFromTitle", () => {
  it.each([
    ["Jon Davies lesson", "jon davies"],
    ["Jon Davies lesson 3 of 5 [paid]", "jon davies"],
    ["Jack Hutchinson lesson 2 of 5 not paid", "jack hutchinson"],
    ["Hoffman kids group lesson [Nico, Cece, Natalie]", "hoffman kids group"],
    ["Hoffman kids group lesson 4 series 6 [Nico, Cece, Natalie]", "hoffman kids group"],
    ["Adrian Moreno lesson [+wife]", "adrian moreno"],
    ["Patsy leung lesson [chrck with ken]", "patsy leung"],
    ["Max lesson (moved from Tue)", "max"],
  ])("%s -> %s", (title, name) => {
    expect(nameFromTitle(title)).toBe(name);
  });

  it("keeps words outside brackets, which is why they stop a match", () => {
    expect(nameFromTitle("Adrian Moreno lesson +wife")).toBe("adrian moreno wife");
  });
});

describe("isLessonTitle", () => {
  it("needs the word lesson", () => {
    expect(isLessonTitle("Jon Davies lesson")).toBe("lesson");
    expect(isLessonTitle("Jon Davies")).toBe("no");
  });
  it("leaves group teaching out", () => {
    expect(isLessonTitle("Junior golf lessons")).toBe("group");
    expect(isLessonTitle("Saturday clinic lesson")).toBe("group");
  });
});

describe("planEntry", () => {
  it("books a matched entry the book has not seen", () => {
    expect(planEntry({ matched: true, review: null })).toEqual({
      action: "book",
      clearReview: false,
    });
  });
  it("books a waiting entry once its title matches, and clears it from Review", () => {
    expect(planEntry({ matched: true, review: "waiting" })).toEqual({
      action: "book",
      clearReview: true,
    });
  });
  it("respects 'not a lesson' even if the title later matches", () => {
    expect(planEntry({ matched: true, review: "dismissed" }).action).toBe("skip");
  });
  it("queues an unmatched entry once, and only once", () => {
    expect(planEntry({ matched: false, review: null }).action).toBe("queue");
    expect(planEntry({ matched: false, review: "waiting" }).action).toBe("skip");
    expect(planEntry({ matched: false, review: "dismissed" }).action).toBe("skip");
  });
});

describe("needsSingle", () => {
  it("bills a new lesson as a single when the client has no package at all", () => {
    expect(needsSingle([])).toBe(true);
  });
  it("bills a single when every package is full", () => {
    expect(needsSingle([{ kind: "package", size: 5, counted: 5 }])).toBe(true);
  });
  it("leaves it for Ian when a package still has room", () => {
    expect(needsSingle([{ kind: "package", size: 5, counted: 3 }])).toBe(false);
  });
  it("does not treat existing singles as room", () => {
    expect(needsSingle([{ kind: "single", size: 1, counted: 0 }])).toBe(true);
  });
});

describe("planDelete", () => {
  it("leaves the sync a marker so a calendar lesson never comes back", () => {
    expect(planDelete({ calendarUid: "AAMk1", bill: null })).toEqual({
      ok: true,
      dismissUid: "AAMk1",
      dropSingle: false,
    });
  });

  it("needs no marker for a lesson added by hand", () => {
    expect(planDelete({ calendarUid: null, bill: null })).toMatchObject({
      ok: true,
      dismissUid: null,
    });
  });

  it("drops the lesson's own single when it was never paid", () => {
    for (const status of ["unpaid", "pending"] as const) {
      expect(
        planDelete({ calendarUid: "AAMk1", bill: { kind: "single", status } }),
      ).toMatchObject({ ok: true, dropSingle: true });
    }
  });

  it("refuses when its single is paid, so money never quietly disappears", () => {
    expect(
      planDelete({ calendarUid: "AAMk1", bill: { kind: "single", status: "paid" } }).ok,
    ).toBe(false);
  });

  it("takes a lesson out of a package without touching the package", () => {
    expect(
      planDelete({ calendarUid: "AAMk1", bill: { kind: "package", status: "paid" } }),
    ).toEqual({ ok: true, dismissUid: "AAMk1", dropSingle: false });
  });
});

describe("planMove", () => {
  const pkg = { clientId: "c1", kind: "package" };

  it("moves a lesson on no bill onto the client's package", () => {
    expect(planMove({ lessonClientId: "c1", bill: null, target: pkg })).toEqual({
      ok: true,
      dropSingle: false,
      carry: false,
      untie: false,
    });
  });

  it("drops the unpaid single the lesson was billed on", () => {
    for (const status of ["unpaid", "pending"]) {
      expect(
        planMove({ lessonClientId: "c1", bill: { kind: "single", status }, target: pkg }),
      ).toEqual({ ok: true, dropSingle: true, carry: false, untie: false });
    }
  });

  it("moves between packages without touching either package", () => {
    expect(
      planMove({ lessonClientId: "c1", bill: { kind: "package", status: "paid" }, target: pkg }),
    ).toEqual({ ok: true, dropSingle: false, carry: false, untie: false });
  });

  it("asks first when its single is paid, so the money is never counted twice", () => {
    const r = planMove({
      lessonClientId: "c1",
      bill: { kind: "single", status: "paid" },
      target: pkg,
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.needsChoice).toBe(true);
  });

  it("carries a paid single's payment onto the package when told to", () => {
    expect(
      planMove({
        lessonClientId: "c1",
        bill: { kind: "single", status: "paid" },
        target: pkg,
        choice: "carry",
      }),
    ).toEqual({ ok: true, dropSingle: true, carry: true, untie: false });
  });

  it("keeps the package's payment and lets the single's go when told to", () => {
    expect(
      planMove({
        lessonClientId: "c1",
        bill: { kind: "single", status: "paid" },
        target: pkg,
        choice: "keep_package",
      }),
    ).toEqual({ ok: true, dropSingle: true, carry: false, untie: true });
  });

  it("refuses someone else's package, a single, or a lesson with no student", () => {
    expect(
      planMove({ lessonClientId: "c1", bill: null, target: { clientId: "c2", kind: "package" } }).ok,
    ).toBe(false);
    expect(
      planMove({ lessonClientId: "c1", bill: null, target: { clientId: "c1", kind: "single" } }).ok,
    ).toBe(false);
    expect(planMove({ lessonClientId: null, bill: null, target: pkg }).ok).toBe(false);
  });
});

describe("planHappened", () => {
  it("lets go of an unpaid single when the lesson did not happen", () => {
    expect(planHappened("cancelled", { kind: "single", status: "unpaid" })).toEqual({
      dropSingle: true,
    });
  });

  it("keeps the bill for a no-show - it may still be charged", () => {
    expect(planHappened("no_show", { kind: "single", status: "unpaid" })).toEqual({
      dropSingle: false,
    });
  });

  it("never drops a paid single or a package", () => {
    expect(planHappened("cancelled", { kind: "single", status: "paid" }).dropSingle).toBe(false);
    expect(planHappened("cancelled", { kind: "package", status: "unpaid" }).dropSingle).toBe(false);
    expect(planHappened("cancelled", null).dropSingle).toBe(false);
  });

  it("changes no bill when a lesson is put back as happened", () => {
    expect(planHappened("completed", { kind: "single", status: "unpaid" }).dropSingle).toBe(false);
  });
});
