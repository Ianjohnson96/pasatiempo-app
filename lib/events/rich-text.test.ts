import { describe, expect, test } from "vitest";
import { groupRichBlocks, parseRichText, timeItem } from "./rich-text";

describe("parseRichText", () => {
  test("headings and paragraphs, as before", () => {
    expect(parseRichText("# Big\n## Small\nOne\nTwo\n\nThree")).toEqual([
      { kind: "h1", text: "Big" },
      { kind: "h2", text: "Small" },
      { kind: "p", lines: ["One", "Two"] },
      { kind: "p", lines: ["Three"] },
    ]);
  });
  test("lines starting '- ' or '• ' make one list", () => {
    expect(parseRichText("Intro\n- one\n• two\n-   three\nAfter")).toEqual([
      { kind: "p", lines: ["Intro"] },
      { kind: "ul", items: ["one", "two", "three"] },
      { kind: "p", lines: ["After"] },
    ]);
  });
  test("a blank line or heading ends a list", () => {
    expect(parseRichText("- a\n\n- b\n## H\n- c")).toEqual([
      { kind: "ul", items: ["a"] },
      { kind: "ul", items: ["b"] },
      { kind: "h2", text: "H" },
      { kind: "ul", items: ["c"] },
    ]);
  });
  test("a dash without a space is plain text", () => {
    expect(parseRichText("-5 degrees")).toEqual([{ kind: "p", lines: ["-5 degrees"] }]);
  });
});

describe("groupRichBlocks", () => {
  test("a heading starts a group; a group with a list is boxed", () => {
    const g = groupRichBlocks(parseRichText("Intro\n## Thursday\n- a\n- b\n## To enter\nBelow."));
    expect(g).toEqual([
      { heading: null, boxed: false, blocks: [{ kind: "p", lines: ["Intro"] }] },
      { heading: "Thursday", boxed: true, blocks: [{ kind: "ul", items: ["a", "b"] }] },
      { heading: "To enter", boxed: false, blocks: [{ kind: "p", lines: ["Below."] }] },
    ]);
  });
  test("text with no headings is one plain group", () => {
    expect(groupRichBlocks(parseRichText("Just this"))).toEqual([
      { heading: null, boxed: false, blocks: [{ kind: "p", lines: ["Just this"] }] },
    ]);
  });
  test("no text, no groups", () => {
    expect(groupRichBlocks([])).toEqual([]);
  });
});

describe("timeItem", () => {
  test("a bullet that starts with a bold time splits off the time", () => {
    expect(timeItem("**7:30 AM** · Range opens")).toEqual({ time: "7:30 AM", rest: "Range opens" });
    expect(timeItem("**10:30 am** First match")).toEqual({ time: "10:30 am", rest: "First match" });
    expect(timeItem("**6 PM** — Dinner")).toEqual({ time: "6 PM", rest: "Dinner" });
  });
  test("anything else is not a time row", () => {
    expect(timeItem("**Dinner:** Texas BBQ")).toBeNull();
    expect(timeItem("Tee times from **1:00 PM**")).toBeNull();
  });
});
