import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

// Stage 3: the page per category (36-category.js) and how it is reached.
const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));
const page = (d: object = docs) => { const R = loadPage(d); R(`globalThis.fillPeople = () => {}`); return R; };

describe("reaching a category's page", () => {
  it("knows the category codes in the plan or the analysis, and nothing else", () => {
    const R = page();
    expect(R(`catPageTarget('620')`)).toBe("620");
    expect(R(`catPageTarget('999')`)).toBeNull();
    expect(R(`catPageTarget(null)`)).toBeNull();
  });
});

type CP = { name: string; sales: { t12: number; ty: number[]; ly: number[]; labels: string[] } | null; budget: { left: number } | null;
  orders: { id: string }[]; markdown: { aged: number }[]; actions: { cat: string }[]; stock: { oh: number } };
describe("a category's page", () => {
  it("shows the Budget page's Left to buy, a year of sales against the year before, and the category's open orders", () => {
    const R = page();
    const d = R(`(SEL = 'season', catPageData('620', stats()))`) as CP;
    const budgetPage = R(`(() => { const s = stats(); return roomThrough('620', s.m) - s.cm('620', s.m); })()`) as number;
    expect(d.budget!.left).toBeCloseTo(budgetPage, 2);
    expect(d.sales!.ty.length).toBe(12);
    expect(d.sales!.ly.length).toBe(12);
    expect(d.sales!.labels.length).toBe(12);
    const want = (R(`POS.filter(p => isOpen(p) && (p.cat === '620' || (p.lines || []).some(l => l.cat === '620'))).map(p => p.id)`) as string[]).sort();
    expect(d.orders.map((p) => p.id).sort()).toEqual(want);
    expect(d.actions.every((a) => a.cat === "620")).toBe(true);
    expect(d.markdown.length).toBeGreaterThan(0);
  });
  it("renders its tiles, sales chart, actions, subcategories and orders", () => {
    const R = page();
    const h = R(`(CATSEL = '620', renderCategory(stats()), document.__html)`) as string;
    for (const t of ["Sales, 12 months", "Weeks of supply", "Margin", "Aged stock", "Left to buy", "Sales by month", "Subcategories", "Open orders", "Budget details"]) expect(h).toContain(t);
    expect(h).toContain('data-cat="620"');
  });
  it("a category with no sales analysis still opens, with dashes where there is no data", () => {
    const R = page();
    R(`PLAN.cats['640'] = {...PLAN.cats['620'], name: 'Special Orders'}`);
    expect(R(`catPageTarget('640')`)).toBe("640");
    expect((R(`catPageData('640', stats())`) as CP).sales).toBeNull();
    const h = R(`(CATSEL = '640', renderCategory(stats()), document.__html)`) as string;
    expect(h).toContain("Special Orders");
    expect(h).toMatch(/Sales, 12 months<\/div><div class="v">—/);
  });
  it("before the first upload it says so", () => {
    const R = page({});
    expect(R(`(CATSEL = '620', renderCategory(null), document.__html)`)).toMatch(/after the first month-end upload/);
  });
  it("its verdict names the category", () => {
    const R = page();
    expect((R(`(CATSEL = '620', PAGE_VERDICT.category(stats()))`) as { text: string }).text).toContain(R(`CAT('620').name`) as string);
  });
});

describe("every way into a category's page", () => {
  it("the Scorecard names link to the page; Trends, Markdowns and the chart open it", () => {
    const R = page();
    R(`globalThis.renderSubcats = () => { $('#pane').innerHTML = ''; }`);   // the subcategory panel needs data the harness doesn't load
    expect(R(`(renderScorecard(stats()), document.__html)`)).toContain('data-go="category:620"');
    expect(R(`(renderTrends(), document.__html)`)).toContain('data-anaopen="620"');
    expect(R(`(renderStuck(), document.__html)`)).toContain('data-anaopen="620"');
    R(`globalThis.__go = null; globalThis.goTab = (t, k) => { __go = [t, k]; }`);
    R(`anaOpen('620')`);
    expect(R(`__go`)).toEqual(["category", "620"]);
  });
  it("an action's Open category goes to the page", () => {
    const R = page();
    const h = R(`decisionHtml({id: 'x', verb: 'hold', usd: 500, title: 't', detail: '', action: '', sev: 'warn', cat: '620', state: null, back: false}, 0)`) as string;
    expect(h).toContain('data-go="category:620"');
  });
  it("Home shows at most five decisions and links to Actions", () => {
    const R = page();
    R(`canWrite = true; dbState = 'live'`);
    const h = R(`(renderToday(stats()), document.__html)`) as string;
    expect((h.match(/data-v="done"/g) || []).length).toBeLessThanOrEqual(5);
    expect(h).toContain('data-tab="actions"');
  });
});
describe("the Left to buy tile", () => {
  it("says a category has no budget, not 'of a negative budget'", () => {
    const R = page();
    const h = R(`(CATSEL = '620', renderCategory(stats()), document.__html)`) as string;
    expect(R(`seasonBudget('620') <= 0`)).toBe(true);   // the fixture's 620 is overbought
    expect(h).not.toMatch(/of a −\$/);
    expect(h).toMatch(/No budget: the plan already holds \$[\d,]+ too much/);
  });
});
