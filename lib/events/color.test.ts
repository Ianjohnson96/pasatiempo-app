import { describe, expect, test } from "vitest";
import { contrast, parseHex, shiftLightness } from "./color";

describe("colour maths", () => {
  test("contrast follows WCAG", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    // the stylesheet notes brass on ivory is 3.2:1
    expect(contrast("#a2814a", "#f5f1e6")).toBeCloseTo(3.2, 1);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  test("parseHex normalises or rejects", () => {
    expect(parseHex("#ABC")).toBe("#aabbcc");
    expect(parseHex("#B41C14")).toBe("#b41c14");
    expect(parseHex(" #b41c14 ")).toBe("#b41c14");
    expect(parseHex("red")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });

  test("shiftLightness moves HSL lightness and clamps", () => {
    // #808080 is L 50.2%; 40.2% of 255 is 102.5, which rounds to 0x67
    expect(shiftLightness("#808080", -10)).toBe("#676767");
    expect(shiftLightness("#b41c14", 10)).not.toBe("#b41c14");
    expect(shiftLightness("#ffffff", 20)).toBe("#ffffff");
    expect(shiftLightness("#000000", -20)).toBe("#000000");
  });
});
