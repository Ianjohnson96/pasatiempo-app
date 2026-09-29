import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// merchandise/app/src/17-metrics.js is plain browser JS joined into the page
// (lib/merch/page.ts). It uses no page globals, so it runs here as it is.
const src = readFileSync(path.join(process.cwd(), "merchandise/app/src/17-metrics.js"), "utf8");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const M: any = vm.runInNewContext(src + ";({BENCH, SEGOF, analyze, grade, perRound, seasonality, stuckMoney, suggest})");

const months: string[] = [];
for (let y = 2024, m = 10; months.length < 24; m++) {
  if (m > 12) { m = 1; y++; }
  months.push(`${y}-${String(m).padStart(2, "0")}`);
}
const flat = (a: number, b: number) => [...Array(12).fill(a), ...Array(12).fill(b)];
const row = (cat: string, sub: string, o: Record<string, unknown>) =>
  ({ cat, sub, ty: 10, ly: 10, md: 0.05, aged: 0, agedSkus: [], top: [], ...o });

const ASSORT = {
  months,
  rows: [
    row("480", "s-480-polos", { series: flat(500, 1000), t12: 12000, oh: 4000, aged: 400, gm: 0.5, ty: 30, ly: 20 }),
    row("480", "s-480-other", { series: flat(500, 500), t12: 6000, oh: 3500, aged: 3000, gm: 0.45, md: 0.1 }),
    row("200", "s-200-putters", { series: flat(0, 200), t12: 2400, oh: 0, gm: 0.2 }),
    row("640", "", { series: flat(900, 900), t12: 10800, oh: 500, gm: 0.3 }),
  ],
};
const NAMES = { "480": "Fancy Shirts", "200": "Golf Clubs", "640": "Special Orders" };

describe("merchandise analysis", () => {
  it("is null before the first upload", () => {
    expect(M.analyze(null, NAMES)).toBeNull();
  });

  it("leaves special orders out and adds subcategories up to their category", () => {
    const a = M.analyze(ASSORT, NAMES);
    expect(a.cats.map((c: { cat: string }) => c.cat)).toEqual(["480", "200"]);
    expect(a.cats[0].t12).toBe(18000);
    expect(a.cats[0].subs).toHaveLength(2);
    expect(a.shop.t12).toBe(20400);
    expect(a.cats.reduce((s: number, c: { share: number }) => s + c.share, 0)).toBeCloseTo(1);
    expect(a.cats[0].growth).toBeCloseTo(0.5); // 18,000 against 12,000
    expect(a.cats[0].subs[0].trend3).toBeCloseTo(0.5); // 30 units against 20
  });

  it("has no GMROI, turns or weeks for a line with no stock", () => {
    const putters = M.analyze(ASSORT, NAMES).cats[1].subs[0];
    expect(putters.gmroi).toBeNull();
    expect(putters.turns).toBeNull();
    expect(putters.wks).toBeNull();
    expect(putters.growth).toBeNull(); // nothing sold the year before
  });

  it("works out GMROI, weeks and aged share", () => {
    const polos = M.analyze(ASSORT, NAMES).cats[0].subs[0];
    expect(polos.gmroi).toBeCloseTo(1.5); // 6,000 margin on 4,000 stock
    expect(polos.wks).toBeCloseTo(4000 / (6000 / 52));
    expect(polos.agedPct).toBeCloseTo(0.1);
  });

  it("grades against the rules of thumb", () => {
    expect(M.grade("agedPct", 0.25, "apparel")).toBe("bad");
    expect(M.grade("agedPct", 0.05, "apparel")).toBe("good");
    expect(M.grade("gmroi", 1.2, "equipment")).toBe("good");
    expect(M.grade("gmroi", 1.2, "apparel")).toBe("bad");
    expect(M.grade("gmroi", null, "apparel")).toBeNull();
  });

  it("gives no spend per round for a month without rounds", () => {
    const a = M.analyze(ASSORT, NAMES);
    const rounds = {
      "2025": { total: Array(12).fill(100), member: Array(12).fill(60), guest: Array(12).fill(30), public: Array(12).fill(10) },
      "2026": { total: [...Array(8).fill(100), 0, 0, 0, 0], member: Array(12).fill(60), guest: Array(12).fill(30), public: Array(12).fill(10) },
    };
    const pr = M.perRound(a, rounds);
    expect(pr).toHaveLength(24);
    const aug = pr.find((p: { month: string }) => p.month === "2026-08");
    expect(aug.spr).toBeCloseTo(17); // 1,700 of sales over 100 rounds
    expect(aug.sprLY).toBeCloseTo(10); // 1,000 over 100 a year earlier
    expect(pr.find((p: { month: string }) => p.month === "2026-09").spr).toBeNull();
    expect(pr.find((p: { month: string }) => p.month === "2024-10").spr).toBeNull(); // no 2024 rounds
  });

  it("shares each calendar month of the last year", () => {
    const s = M.seasonality(M.analyze(ASSORT, NAMES));
    expect(s).toHaveLength(12);
    expect(s.reduce((x: number, y: number) => x + y, 0)).toBeCloseTo(1);
  });

  it("finds the stuck money", () => {
    const st = M.stuckMoney(M.analyze(ASSORT, NAMES));
    expect(st.aged[0].M.sub).toBe("s-480-other");
    expect(st.aged[0].aged).toBe(3000);
    expect(st.markdown[0].cashAt30).toBeCloseTo((3000 / 0.55) * 0.7);
  });

  it("compares growth only over months with data in both years", () => {
    // Data starts in May 2025 (index 7): only May–Sep 2026 have a year-earlier month to compare with.
    const late = { months, rows: [row("480", "s-480-polos", {
      series: [...Array(7).fill(0), ...Array(5).fill(100), ...Array(7).fill(150), ...Array(5).fill(200)], t12: 2050, oh: 1000, gm: 0.5 })] };
    const a = M.analyze(late, NAMES);
    expect(a.cmpMonths).toBe(5);
    expect(a.cats[0].growth).toBeCloseTo(1); // 1,000 (May–Sep 2026) against 500
    const pr = M.perRound(a, { "2025": { total: Array(12).fill(10) } });
    expect(pr.find((p: { month: string }) => p.month === "2026-03").sprLY).toBeNull(); // no sales data for Mar 2025
  });

  it("names subcategories from the list, or tidies the id", () => {
    const a = M.analyze(ASSORT, NAMES, { "s-480-polos": "Men's polos" });
    expect(a.cats[0].subs[0].name).toBe("Men's polos");
    expect(a.cats[0].subs[1].name).toBe("Other");
  });

  it("ranks the suggestions by dollars, the aged-heavy line first, one per line", () => {
    const s = M.suggest(M.analyze(ASSORT, NAMES));
    expect(s[0].sub).toBe("s-480-other");
    expect(s[0].impact).toBe(3000);
    expect(s[0].also.length).toBeGreaterThan(0); // its weeks and GMROI reasons folded in
    const keys = s.map((x: { cat: string; sub: string | null }) => x.cat + "|" + x.sub);
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].impact).toBeGreaterThanOrEqual(s[i].impact);
    expect(s.every((x: { why: string; title: string }) => x.why && x.title)).toBe(true);
  });
});
