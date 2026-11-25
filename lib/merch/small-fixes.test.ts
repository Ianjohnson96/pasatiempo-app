import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";
import { parseLog, VENDOR_WORDS_DEFAULT } from "./receiving-log";
import { docProblem } from "./rules";

// The small fixes set aside during phase 2 (receiving and stage 3).
const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));
const page = () => { const R = loadPage(docs); R(`globalThis.fillPeople = () => {}; ISTATE = {}`); return R; };

describe("small fixes", () => {
  it("#orders:<order> opens that order; any other key still filters by vendor", () => {
    const R = page();
    expect(R(`ordersKey('po-late')`)).toEqual({ po: "po-late" });
    expect(R(`ordersKey('v-fj')`)).toEqual({ vendor: "v-fj" });
  });
  it("zero weeks of supply reads 0, not a dash", () => {
    const R = page();
    R(`INV.cats['620'] = {...INV.cats['620'], cost: 0}`);
    expect(R(`catRow(catList().find(c => c.code === '620'), stats())`)).toMatch(/data-l="Weeks of supply" class="r num">0</);
  });
  it("Stock & counts judges weeks by each category's role, not fixed numbers", () => {
    const R = page();
    const role = R(`roleOf('200')`) as { wks: number[]; over: number };
    expect(role.wks[0]).toBeGreaterThan(12);   // hard goods: the old fixed 12 / 30 weeks would misjudge these
    expect(role.over).toBeGreaterThan(31);
    const read = (wks: number) => R(`invRead({c: {code: '200'}, i: {cost: 1000, aged: 0}, wks: ${wks}, tgt: 1000, gap: 0})`);
    expect(read(role.wks[0] - 1)).toMatch(/Lean/);
    expect(read(31)).toMatch(/In line/);
    expect(read(role.over + 1)).toMatch(/Too much stock/);
  });
  it("the view tabs don't print", () => {
    const shell = readFileSync(path.join(process.cwd(), "merchandise/app/src/shell.html"), "utf8");
    expect(shell).toMatch(/@media print\{[^\n]*\.viewbar\{display:none/);
  });
  it('a "$ -" price in the log is listed as no price, not read as $0', () => {
    const tab = { title: "2026", values: [["REC. DATE", "ITEM DESCRIPTION", "INVOICE #", "PRICE"], ["11/20/2026", "FJ hats", "88", "$ -"]] };
    const r = parseLog([tab], { since: "2026-11-01", words: VENDOR_WORDS_DEFAULT });
    expect(r.rows).toEqual([]);
    expect(r.problems).toEqual(["2026 row 2: no price"]);
  });
  it("a receiving match must say who made it", () => {
    const ok = { state: "notorder", by: "cj@example.com", at: "2026-11-24T00:00:00Z" };
    expect(docProblem("logmatch/k1", ok)).toBeNull();
    expect(docProblem("logmatch/k1", { ...ok, by: "" })).toMatch(/by/);
    expect(docProblem("logmatch/k1", { state: "notorder" })).toMatch(/by/);
  });
  it("matches to check count in the Orders & receiving and Receiving badges", () => {
    const R = page();
    R(`RLOG = {readAt: '2026-11-22T00:00:00Z', since: '2026-11-01', words: {}, rows: [], problems: []}; LOGMATCH = {}`);
    const count = () => R(`(LOGQ = null, [(sideCount(sideBadges(stats()), 'orders') || [0])[0], renderViewBar('receiving')])`) as [number, string];
    const [before] = count();
    R(`LOGMATCH = {gone: {state: 'matched', po: 'po-late', amount: 5, date: '2026-11-10', by: 'x'}}`);
    const [after, bar] = count();
    expect(after).toBe(before + 1);
    expect(bar).toMatch(/Receiving <span class="sb/);
  });
  it("Done / Not now store the dollars to the cent, so +25% is exact", () => {
    const R = page();
    R(`canWrite = true; dbState = 'live'`);
    expect(R(`decisionHtml({id: 'x', verb: 'reorder', usd: 400.2, title: 't', detail: '', action: '', sev: 'good', state: null, back: false}, 0)`)).toContain('data-usd="400.2"');
  });
  it("a category link waits for the sales data before giving up on a code the budget doesn't have", () => {
    const R = page();
    R(`ASSORT = null; ANA_KEY = 'stale'; ANA = null`);
    expect(R(`catPageOnLoad('999')`)).toBe("wait");
    expect(R(`catPageOnLoad('620')`)).toBe("open");
    R(`ASSORT = __docs.assort; ANA_KEY = null`);
    expect(R(`catPageOnLoad('999')`)).toBe("redirect");
  });
  it("the Scorecard's hint says the name opens the page and the row shows subcategories", () => {
    const R = page();
    R(`globalThis.renderSubcats = () => { $('#pane').innerHTML = ''; }`);
    expect(R(`(renderScorecard(stats()), document.__html)`)).toMatch(/Tap a name for its page, a row for its subcategories/);
  });
});
