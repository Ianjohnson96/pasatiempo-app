import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

// Stage 3: one list of actions ranked by dollars at stake (30-home.js allActions) and the Actions view.
const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));
const page = (d: object = docs) => { const R = loadPage(d); R(`globalThis.fillPeople = () => {}; ISTATE = {}`); return R; };
type A = { id: string; verb: string; usd: number; cat?: string; state: unknown; back: boolean };

describe("the actions list", () => {
  it("holds every attention item and every scorecard suggestion, biggest dollars first", () => {
    const R = page();
    const all = R(`allActions(stats())`) as A[];
    const ids = new Set(all.map((x) => x.id));
    for (const id of R(`openAttention(stats()).map(i => i.id)`) as string[]) expect(ids.has(id)).toBe(true);
    for (const id of R(`suggest(anaNow()).map(x => ('sug-' + x.kind + '-' + x.key).replace(/[^A-Za-z0-9_.~:@+-]/g, '_'))`) as string[]) expect(ids.has(id)).toBe(true);
    expect(all.length).toBeGreaterThan(3);
    const usd = all.map((x) => x.usd), firstZero = usd.findIndex((v) => !v);
    const ranked = firstZero < 0 ? usd : usd.slice(0, firstZero);
    expect(ranked).toEqual([...ranked].sort((a, b) => b - a));
  });
  it("Home's top decisions: at most five, at most two of each kind", () => {
    const R = page();
    const top = R(`topDecisions(stats())`) as A[];
    expect(top.length).toBeLessThanOrEqual(5);
    const per: Record<string, number> = {};
    for (const d of top) per[d.verb] = (per[d.verb] || 0) + 1;
    expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(2);
  });
  it("a set-aside item stays away unless its dollars grow by more than a quarter, and its record is kept", () => {
    const R = page();
    const x = (R(`allActions(stats()).filter(a => a.usd > 0)`) as A[])[0];
    const open = () => (R(`allActions(stats()).find(a => a.id === ${JSON.stringify(x.id)})`) as A);
    R(`ISTATE[${JSON.stringify(x.id)}] = {status: 'dismissed', usd: ${x.usd}}`);
    expect(open().back).toBe(false);
    expect(R(`actionOpen(allActions(stats()).find(a => a.id === ${JSON.stringify(x.id)}))`)).toBe(false);
    R(`ISTATE[${JSON.stringify(x.id)}] = {status: 'dismissed', usd: ${x.usd / 1.25}}`);
    expect(R(`actionOpen(allActions(stats()).find(a => a.id === ${JSON.stringify(x.id)}))`)).toBe(false);
    R(`ISTATE[${JSON.stringify(x.id)}] = {status: 'done', usd: ${x.usd / 1.3}}`);
    expect(open().back).toBe(true);
    expect(R(`actionOpen(allActions(stats()).find(a => a.id === ${JSON.stringify(x.id)}))`)).toBe(true);
    expect(R(`ISTATE[${JSON.stringify(x.id)}].status`)).toBe("done");
    R(`canWrite = true; dbState = 'live'`);
    expect(R(`decisionHtml(allActions(stats()).find(a => a.id === ${JSON.stringify(x.id)}), 0)`)).toMatch(/Back: up from/);
    R(`ISTATE[${JSON.stringify(x.id)}] = {status: 'done'}`);   // an older record, saved without dollars
    expect(R(`actionOpen(allActions(stats()).find(a => a.id === ${JSON.stringify(x.id)}))`)).toBe(false);
  });
  it("a category's actions are only that category's, and open", () => {
    const R = page();
    const cat = (R(`allActions(stats()).find(a => a.cat)`) as A).cat!;
    const mine = R(`actionsFor(stats(), ${JSON.stringify(cat)})`) as A[];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((a) => a.cat === cat && (!a.state || a.back))).toBe(true);
  });
  it("Done and Not now carry the dollars, so the comeback rule can work", () => {
    const R = page();
    R(`canWrite = true; dbState = 'live'`);
    const d = (R(`topDecisions(stats())`) as A[])[0];
    expect(R(`decisionHtml(topDecisions(stats())[0], 0)`)).toContain(`data-usd="${Math.round(d.usd)}"`);
  });
});

describe("the Actions view", () => {
  const html = (R: (e: string) => unknown) => R(`(renderActions(stats()), document.__html)`) as string;
  it("lists every open action, numbered, biggest dollars first", () => {
    const R = page();
    R(`canWrite = true; dbState = 'live'`);
    const h = html(R), open = (R(`allActions(stats()).filter(actionOpen)`) as (A & { title: string })[]);
    let at = -1;
    for (const a of open) { const i = h.indexOf(R(`esc(${JSON.stringify(a.title)})`) as string, at + 1); expect(i).toBeGreaterThan(at); at = i; }
    const usds = [...h.matchAll(/data-v="done" data-usd="(\d+)"/g)].map((m) => +m[1]);
    expect(usds[0]).toBe(Math.max(...usds));
  });
  it("filters by category and by kind of decision", () => {
    const R = page();
    const cat = (R(`allActions(stats()).find(a => a.cat)`) as A).cat!;
    R(`afilt.cat = ${JSON.stringify(cat)}`);
    const n = (R(`allActions(stats()).filter(a => actionOpen(a) && a.cat === ${JSON.stringify(cat)}).length`) as number);
    expect((html(R).match(/<li class="item/g) || []).length).toBe(n);
    R(`afilt.cat = 'all'; afilt.kind = 'chase'`);
    const m = (R(`allActions(stats()).filter(a => actionOpen(a) && a.verb === 'chase').length`) as number);
    expect((html(R).match(/<li class="item/g) || []).length).toBe(m);
  });
  it("viewers see the actions without Done or Not now", () => {
    const R = page();
    R(`readOnly = true`);
    expect(html(R)).not.toMatch(/data-istate/);
  });
  it("set-aside actions show only with Show done, with Undo", () => {
    const R = page();
    R(`canWrite = true; dbState = 'live'`);
    const x = (R(`allActions(stats())[0]`) as A & { title: string });
    R(`ISTATE[${JSON.stringify(x.id)}] = {status: 'done', usd: ${x.usd}, by: 'x', at: '2026-11-20T00:00:00Z'}`);
    expect(html(R)).not.toContain(`data-istate="${x.id}" data-v=""`);
    R(`afilt.showResolved = true`);
    expect(html(R)).toContain(`data-istate="${x.id}" data-v=""`);
  });
  it("before the first upload it says when actions appear", () => {
    const R = page({});
    expect(R(`(renderActions(null), document.__html)`)).toMatch(/The actions appear after the first month-end upload\./);
  });
  it("its verdict counts the actions and the dollars at stake", () => {
    const R = page();
    expect((R(`PAGE_VERDICT.actions(stats())`) as { text: string }).text).toMatch(/^\d+ actions?, \$[\d,]+ at stake\. Start with the first\.$/);
  });
});
