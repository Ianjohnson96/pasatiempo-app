import { describe, expect, it } from "vitest";
import { isLessonTitle, nameFromTitle, planEntry } from "./sync-plan";

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
