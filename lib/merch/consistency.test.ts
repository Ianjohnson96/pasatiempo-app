import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

// The same figure must read the same on every page that shows it.
const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));

describe("numbers that agree across pages", () => {
  it("every Left to buy figure for the plan year agrees", () => {
    const R = loadPage(docs);
    const v = R(`(() => { SEL = 'season'; const s = stats(); const CM = committedMatrix(), w = WIN(), cats = otbCats();
      return [s.left, sum(cats, c => roomThrough(c, s.m) - s.cm(c, s.m)), sum(cats, c => sum(w, k => budgetAt(c, k) - num((CM[c] || {})[k]))),
              todayRoom().year, leftToBuyWith(assumptions())]; })()`) as number[];
    expect(Math.abs(v[0])).toBeGreaterThan(1);
    for (const x of v) expect(x).toBeCloseTo(v[0], 2);
  });
  it("the Budget page opens on the whole year", () => {
    expect(loadPage(docs)(`(SEL = null, selMonth())`)).toBe("season");
  });
  it("a picked month still shows that month", () => {
    expect(loadPage(docs)(`(SEL = '2027-01', selMonth())`)).toBe("2027-01");
  });
  it("weeks of supply agrees on Budget, Stock & counts and Scorecard", () => {
    const R = loadPage(docs);
    const w = R(`(() => { const a = anaNow(); return otbCats().map(c => [catWeeks(c, shelfCost(c, INV.cats[c].cost)), (a.cats.find(x => x.cat === c) || {}).wks]); })()`) as [number, number][];
    expect(w.filter(([b, s]) => b != null && s != null).length).toBeGreaterThan(0);
    for (const [budget, scorecard] of w) if (budget != null && scorecard != null) expect(scorecard).toBeCloseTo(budget, 6);
  });
});
