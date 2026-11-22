import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

// Findings from the stage 1 whole-branch review, each pinned.
const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));

describe("stage 1 review fixes", () => {
  it("Home and the Receiving verdict work with an order in the store room", () => {
    const R = loadPage(docs);
    expect(R(`rcvOf(POS.find(p => p.id === 'po-arrived'))`)).toBe("arrived");
    const L = R(`homeLines(stats())`) as { arriving: string };
    expect(L.arriving).toMatch(/1 in the store room \(\$800\)/);
    expect(L.arriving).toMatch(/1 order due this month/);
    expect(() => R(`renderToday(stats())`)).not.toThrow();
    expect((R(`PAGE_VERDICT.receiving(stats())`) as { text: string }).text).toMatch(/1 order \(\$800\) arrived but not in Jonas/);
  });
  it("the Budget verdict describes the year the page shows; Home always this year", () => {
    const R = loadPage(docs);
    R(`FYSEL = 'next'; derive(); SEL = 'season'`);
    const v = R(`PAGE_VERDICT.overview(stats())`) as { text: string };
    expect(v.text).toContain(R(`PLANS.next.fy`) as string);
    expect(v.text).toContain(R(`money(Math.abs(stats().left))`) as string);
    const L = R(`homeLines(withPlan('cur', () => stats()))`) as { buy: string };
    expect(L.buy).toContain(R(`PLANS.cur.fy`) as string);
    expect(L.buy).toContain(R(`money(Math.abs(withPlan('cur', () => leftToBuyWith(assumptions()))))`) as string);
  });
  it("the Orders & receiving badge counts each order once", () => {
    const R = loadPage(docs);
    const n = R(`sideCount(sideBadges(stats()), 'orders')[0]`) as number;
    const distinct = R(`new Set(POS.filter(p => isOpen(p) && (rowFlag(p) === 'flag-crit' || (p.deliveryMonth && p.deliveryMonth < THIS_MONTH) || ['arrived', 'late'].includes(rcvOf(p)))).map(p => p.id)).size`) as number;
    expect(n).toBe(distinct);
  });
  it("a category with no forecast ahead gets no weeks target in dollars", () => {
    const d = JSON.parse(JSON.stringify(docs));
    d.base.cats["200"].hist = {}; d.base.cats["200"].act = {};
    const R = loadPage(d);
    expect(R(`stuckMoney(anaNow()).overstock.some(x => x.M.cat === '200')`)).toBe(false);
  });
  it("a month saved in an earlier visit doesn't replace the whole-year default", () => {
    const R = loadPage({ ...docs, storage: { "ob.month": "2026-12" } });
    expect(R(`selMonth()`)).toBe("season");
  });
});
