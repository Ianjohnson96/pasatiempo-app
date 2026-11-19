import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it } from "vitest";

// The guideline layer: code defaults with the owner's saved guidelines/current on top (17-metrics.js, 18-ops.js).
const read = (f: string) => readFileSync(path.join(process.cwd(), "merchandise/app/src", f), "utf8");
const src = read("17-metrics.js") + "\n" + read("18-ops.js");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G: any = vm.runInNewContext(
  src + ";({guideValues, applyGuides, roleKey, seasonOf, get BENCH(){ return BENCH }, get ROLES(){ return ROLES }, get MEMBER_DISCOUNT(){ return MEMBER_DISCOUNT }})"
);

beforeEach(() => G.applyGuides(null));

describe("guideValues", () => {
  it("defaults when no document", () => {
    const v = G.guideValues(null);
    expect(v.bench.gm.apparel).toBe(0.45);
    expect(v.roles.fashion.wks).toEqual([12, 16, 8, 24]);
    expect(v.memberDiscount).toBe(0.25);
    expect(v.seasons).toEqual({ spring: 1, summer: 5, fall: 8, holiday: 11 });
    expect(v.mix).toEqual({ total: null, ranges: {} });
  });

  it("partial document", () => {
    const v = G.guideValues({ memberDiscount: 0.3 });
    expect(v.memberDiscount).toBe(0.3);
    expect(v.bench.gm.apparel).toBe(0.45);
    expect(v.roleOf["480"]).toBe("fashion");
  });

  it("bad values fall back", () => {
    const v = G.guideValues({ bench: { gm: { apparel: "x" }, md: { good: 3 } }, roles: { fashion: { wks: [16, 12, 8, 24], over: -2 } }, memberDiscount: -1,
      seasons: { spring: 1, summer: 9, fall: 8, holiday: 11 }, roleOf: { "480": "bogus" }, mix: { total: -5, ranges: { fashion: [50, 40], nope: [1, 2] } } });
    expect(v.bench.gm.apparel).toBe(0.45);
    expect(v.bench.md.good).toBe(0.15);
    expect(v.roles.fashion.wks).toEqual([12, 16, 8, 24]);
    expect(v.roles.fashion.over).toBe(30);
    expect(v.memberDiscount).toBe(0.25);
    expect(v.seasons.summer).toBe(5);
    expect(v.roleOf["480"]).toBe("fashion");
    expect(v.mix).toEqual({ total: null, ranges: {} });
  });

  it("keeps valid overrides", () => {
    const v = G.guideValues({ bench: { gm: { apparel: 0.48 } }, roles: { impulse: { wks: [10, 18, 8, 26] } }, mix: { total: 700000, ranges: { fashion: [38, 48] } },
      seasons: { spring: 1, summer: 4, fall: 8, holiday: 11 } });
    expect(v.bench.gm.apparel).toBe(0.48);
    expect(v.bench.gm.accessories).toBe(0.4);
    expect(v.roles.impulse.wks).toEqual([10, 18, 8, 26]);
    expect(v.mix).toEqual({ total: 700000, ranges: { fashion: [38, 48] } });
    expect(v.seasons.summer).toBe(4);
  });
});

describe("applyGuides", () => {
  it("role map override", () => {
    G.applyGuides({ roleOf: { "480": "impulse" } });
    expect(G.roleKey("480")).toBe("impulse");
    expect(G.roleKey("999")).toBe("fashion");
    G.applyGuides(null);
    expect(G.roleKey("480")).toBe("fashion");
  });

  it("advice follows the discount", () => {
    G.applyGuides({ memberDiscount: 0.3 });
    expect(G.MEMBER_DISCOUNT).toBe(0.3);
    expect(G.ROLES.fashion.aged).toContain("30%");
    expect(G.ROLES.fashion.aged).not.toContain("25%");
    G.applyGuides(null);
    expect(G.ROLES.fashion.aged).toContain("25%");
  });

  it("rule text follows the numbers", () => {
    G.applyGuides({ bench: { gm: { apparel: 0.48 } } });
    expect(G.BENCH.gm.text).toContain("48%+");
    G.applyGuides(null);
    expect(G.BENCH.gm.text).toBe("Margin: apparel 45%+, accessories 40%+, equipment 25%+");
  });

  it("seasons follow the saved months", () => {
    expect(G.seasonOf("2027-04").key).toBe("spring");
    const s = G.seasonOf("2027-04", { spring: 1, summer: 4, fall: 8, holiday: 11 });
    expect(s.key).toBe("summer");
    expect(s.first).toBe("2027-04");
    G.applyGuides({ seasons: { spring: 1, summer: 4, fall: 8, holiday: 11 } });
    expect(G.seasonOf("2027-04").key).toBe("summer");
  });
});
