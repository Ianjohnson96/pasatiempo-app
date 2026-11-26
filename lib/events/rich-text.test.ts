import { describe, expect, test } from "vitest";
import { parseRichText } from "./rich-text";

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
