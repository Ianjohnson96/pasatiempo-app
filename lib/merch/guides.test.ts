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

// 19-guides.js: merchandise mix and suggested values (pure).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const X: any = vm.runInNewContext(read("17-metrics.js") + "\n" + read("19-guides.js")
  + ";({parseMoney, salesShareByRole, suggestedRanges, suggestedTotal, mixRows, rangeSum})");

describe("mix and suggestions", () => {
  it("parseMoney", () => {
    expect(X.parseMoney("$700,000")).toBe(700000);
    expect(X.parseMoney("700k")).toBe(700000);
    expect(X.parseMoney("1.2m")).toBe(1200000);
    expect(X.parseMoney(" 685352 ")).toBe(685352);
    expect(X.parseMoney("")).toBeNull();
    expect(X.parseMoney("abc")).toBeNull();
    expect(X.parseMoney("-5")).toBeNull();
    expect(X.parseMoney("0")).toBeNull();
  });

  it("sales share by role leaves out special orders", () => {
    const s = X.salesShareByRole([{ cat: "480", t12: 300 }, { cat: "620", t12: 100 }, { cat: "640", t12: 600 }]);
    expect(s.fashion).toBeCloseTo(0.75);
    expect(s.impulse).toBeCloseTo(0.25);
    expect(s.demo).toBe(0);
  });

  it("suggested ranges are sales share plus or minus 5 points", () => {
    expect(X.suggestedRanges({ fashion: 0.432, demo: 0.003 })).toEqual({ fashion: [38, 48], demo: [0, 5] });
  });

  it("suggested total is cost of sales over the turns target", () => {
    expect(X.suggestedTotal([{ cat: "480", t12: 1000, gm: 0.4 }, { cat: "640", t12: 5000, gm: 0.1 }], 2.5)).toBe(240);
    expect(X.suggestedTotal([], 2.5)).toBe(0);
  });

  const onHand = { fashion: 223463, impulse: 299966, hardgoods: 111568, consumable: 40230, demo: 10125 };
  const ranges = { fashion: [38, 48], impulse: [36, 46], hardgoods: [5, 15], consumable: [4, 8], demo: [0, 3] };
  it("mix rows at today's stock", () => {
    const rows = X.mixRows(onHand, {}, ranges, 685352);
    expect(rows.map((r: { role: string }) => r.role)).toEqual(["fashion", "impulse", "hardgoods", "consumable", "demo"]);
    const f = rows[0];
    expect(f.status).toBe("short");
    expect(f.gap).toBeCloseTo(36971, -1);
    expect(f.loDollar).toBeCloseTo(260434, -1);
    expect(rows[2].status).toBe("over");
    expect(rows[2].gap).toBeCloseTo(8765, -1);
    expect(rows[1].status).toBe("in");
  });

  it("mix rows follow a typed total", () => {
    const rows = X.mixRows(onHand, {}, ranges, 750000);
    expect(rows[0].gap).toBeCloseTo(61537, -1);
    expect(rows[2].status).toBe("in");
  });

  it("range sum", () => {
    expect(X.rangeSum(ranges)).toEqual({ lo: 83, hi: 120 });
  });
});

// wosPreview (19-guides.js) runs the budget engine (20-engine.js) twice: as saved, and with changed weeks of supply.
describe("budget weeks-of-supply preview", () => {
  const fx = JSON.parse(readFileSync(path.join(process.cwd(), "merchandise/pipeline/fixtures/engine_parity.json"), "utf8"));
  const helpers = `
const num = v => { const n = +v; return isFinite(n) ? n : 0; };
const pad = n => String(n).padStart(2,'0');
const addMonths = (m, k) => { let y = +m.slice(0,4), mo = +m.slice(5,7) - 1 + k; y += Math.floor(mo/12); mo = ((mo%12)+12)%12; return y + '-' + pad(mo+1); };
const THIS_MONTH = '2026-11', FALLBACK = {}, localStorage = {getItem: () => null};
`;
  const ctx = vm.createContext({});
  vm.runInContext(helpers + read("20-engine.js") + "\n" + read("17-metrics.js") + "\n" + read("19-guides.js"), ctx);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preview = (changes: Record<string, number>): any => vm.runInContext(`BASE = ${JSON.stringify(fx.base)}; SAVED = null; WHATIF = null;
    (() => { const a = assumptions(); return {a, p: wosPreview(BASE, a, ${JSON.stringify(changes)}, {})}; })()`, ctx);

  it("raising a category's weeks raises its room in every month, and nothing else", () => {
    const { a } = preview({});
    const { p } = preview({ "620": a.wos["620"] + 2 });
    expect(p.months.length).toBeGreaterThan(0);
    expect(Object.keys(p.before)).toEqual(["620", "total"]);
    const after = p.after["620"], before = p.before["620"];
    expect(after.reduce((t: number, v: number) => t + v, 0)).toBeGreaterThan(before.reduce((t: number, v: number) => t + v, 0));
    p.months.forEach((_: string, i: number) => expect(p.after.total[i] - p.before.total[i]).toBeCloseTo(after[i] - before[i], 6));
  });

  it("no changes, no difference", () => {
    const { p } = preview({});
    expect(p.before).toEqual(p.after);
    expect(Object.keys(p.before)).toEqual(["total"]);
  });
});

// Final review fixes: season lengths follow the saved seasons; no sales data means no suggested mix.
describe("seasons and mix after the final review", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const S: any = vm.runInNewContext(read("17-metrics.js") + "\n" + read("18-ops.js") + "\n" + read("19-guides.js")
    + ";({applyGuides, seasonOf, seasonMonths, seasonBuys, salesShareByRole, suggestedRanges})");
  beforeEach(() => S.applyGuides(null));

  it("a longer season has all its months and Season buys doesn't break", () => {
    S.applyGuides({ seasons: { spring: 1, summer: 4, fall: 8, holiday: 11 } });
    expect(S.seasonMonths(S.seasonOf("2027-04"))).toEqual(["2027-04", "2027-05", "2027-06", "2027-07"]);
    expect(S.seasonMonths(S.seasonOf("2027-02"))).toEqual(["2027-01", "2027-02", "2027-03"]);
    const t = S.seasonBuys([{ month: "2027-04", cat: "480", amount: 100, units: 2, orderDate: "2026-12-01", po: "p" }], S.seasonOf("2027-04"));
    expect(t.committed).toBe(100);
    expect(t.byMonth["2027-04"].prebooked).toBe(100);
  });

  it("default seasons keep their lengths", () => {
    expect(S.seasonMonths(S.seasonOf("2027-02"))).toHaveLength(4);
    expect(S.seasonMonths(S.seasonOf("2027-12"))).toEqual(["2027-11", "2027-12"]);
  });

  it("no sales data, no suggested mix ranges", () => {
    expect(S.salesShareByRole([])).toBeNull();
    expect(S.suggestedRanges(S.salesShareByRole([]))).toEqual({});
  });
});
