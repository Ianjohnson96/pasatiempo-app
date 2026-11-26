import { describe, expect, test } from "vitest";
import { holdUntil, spinnerVisible } from "./busy";

describe("spinner timing", () => {
  test("the spinner appears only after a second", () => {
    expect(spinnerVisible(0, 999)).toBe(false);
    expect(spinnerVisible(0, 1000)).toBe(true);
    expect(spinnerVisible(5000, 5400)).toBe(false);
  });

  test("once shown, the spinner stays at least half a second", () => {
    expect(holdUntil(1000, 1200)).toBe(300);
    expect(holdUntil(1000, 1500)).toBe(0);
    expect(holdUntil(1000, 2600)).toBe(0);
  });

  test("a spinner that never showed holds nothing", () => {
    expect(holdUntil(null, 5000)).toBe(0);
  });
});
