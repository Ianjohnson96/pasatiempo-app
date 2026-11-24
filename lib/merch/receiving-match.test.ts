import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

// Orders & receiving with the receiving log: the page's own code, with write() standing in for the database.
const base = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));
const docs = {
  ...base,
  vendors: [{ id: "v-fj", name: "FootJoy" }, { id: "v-pm", name: "Peter Millar" }],
  pos: [...base.pos.map((p: object) => ({ ...p, vendorId: "v-pm" })), { id: "fj-dec", status: "open", cat: "620", vendorId: "v-fj", deliveryMonth: "2026-12", orderDate: "2026-09-01", cost: 2000, lines: [] }],
  rlog: { at: "2026-11-22T18:00:00Z", readAt: "2026-11-22T18:00:00Z", since: "2026-11-01", error: null, words: { footjoy: ["fj", "footjoy"] }, problems: [],
    rows: [{ key: "r-fj", tab: "SHEET 4", date: "2026-11-18", desc: "Shirts/Sweaters FJ Mens Stock", invoice: "9000498548", amount: 1038.82, credit: false, brand: "footjoy", special: false },
           { key: "r-melin", tab: "SHEET 4", date: "2026-11-18", desc: "Hats Melin Mens Stock", invoice: "2387808", amount: 4950.21, credit: false, brand: null, special: false }] },
};
// write(): record it and apply it to the page's state, as the live database would through its poll
const page = () => {
  const R = loadPage(docs);
  R(`VENDORS = __docs.vendors; RLOG = __docs.rlog; LOGMATCH = {}; myId = 'cj@example.com'; canWrite = true; dbState = 'live';
    globalThis.__writes = [];
    globalThis.write = async (path, data) => { __writes.push([path, data]);
      const [c, id] = path.split('/');
      if (c === 'pos'){ const i = POS.findIndex(p => p.id === id); POS[i] = {...data, id}; }
      if (c === 'logmatch'){ if (data == null) delete LOGMATCH[id]; else LOGMATCH[id] = data; }
      return true; };
    globalThis.toast = () => {};`);
  return R;
};
const queue = (R: (e: string) => unknown) => R(`(() => { const q = receivingQueue(); return {toMatch: q.toMatch.map(x => [x.row.key, x.cands.map(p => p.id)]), notOrder: q.notOrder.map(x => [x.row.key, x.why]), matched: q.matched.map(x => [x.row.key, x.po])}; })()`) as {
  toMatch: [string, string[]][]; notOrder: [string, string][]; matched: [string, string][] };

describe("matching receiving log rows on the page", () => {
  it("suggests the FootJoy order and files the Melin row as not from an order", () => {
    const q = queue(page());
    expect(q.toMatch).toEqual([["r-fj", ["fj-dec"]]]);
    expect(q.notOrder).toEqual([["r-melin", "none"]]);
  });
  it("confirming puts the order in the store room and takes the row off the list; undo puts both back", async () => {
    const R = page();
    await R(`confirmLogRow('r-fj', 'fj-dec')`);
    expect(R(`rcvOf(POS.find(p => p.id === 'fj-dec'))`)).toBe("arrived");
    expect(R(`storeRoomOf(POS.find(p => p.id === 'fj-dec'))`)).toBeCloseTo(1038.82, 2);
    expect(queue(R).matched).toEqual([["r-fj", "fj-dec"]]);
    expect(R(`LOGMATCH['r-fj'].by`)).toBe("cj@example.com");
    await R(`undoLogRow('r-fj')`);
    expect(R(`rcvOf(POS.find(p => p.id === 'fj-dec'))`)).not.toBe("arrived");
    expect(queue(R).toMatch).toEqual([["r-fj", ["fj-dec"]]]);
  });
  it("Not an order files a row a person marked, and can be undone", async () => {
    const R = page();
    await R(`markNotOrder('r-fj')`);
    expect(queue(R).notOrder).toContainEqual(["r-fj", "marked"]);
    await R(`undoLogRow('r-fj')`);
    expect(queue(R).toMatch.map((x) => x[0])).toEqual(["r-fj"]);
  });
  it("staff don't get the hand Invoice in once the log is read; the owner keeps it as an override", () => {
    const R = page();
    R(`isAdmin = false`);
    expect(R(`rcvBtns(POS[0])`)).toBe("");
    R(`isAdmin = true`);
    expect(R(`rcvBtns(POS[0])`)).toMatch(/Override/);
    R(`isAdmin = false; RLOG = null`);
    expect(R(`rcvBtns(POS[0])`)).toMatch(/Invoice in/);
  });
  it("Home, the verdict and the sidebar count log rows to match", () => {
    const R = page();
    expect((R(`homeLines(stats())`) as { arriving: string }).arriving).toMatch(/1 log row to match/);
    expect((R(`PAGE_VERDICT.receiving(stats())`) as { text: string }).text).toMatch(/1 log row to match/);
    const n = R(`sideCount(sideBadges(stats()), 'orders')[0]`) as number;
    const orders = R(`POS.filter(p => isOpen(p) && (rowFlag(p) === 'flag-crit' || (p.deliveryMonth && p.deliveryMonth < THIS_MONTH) || ['arrived', 'late'].includes(rcvOf(p)))).length`) as number;
    expect(n).toBe(orders + 1);
  });
  it("the Receiving view lists rows to match with Confirm, and rows not from an order", () => {
    const R = page();
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/Match from the receiving log/);
    expect(html).toMatch(/data-logok="r-fj\|fj-dec"/);
    expect(html).toMatch(/Not from an order/);
    expect(html).toMatch(/Hats Melin Mens Stock/);
  });
  it("without the log connected the page says so and still shows the order lists", () => {
    const R = page();
    R(`RLOG = null`);
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/isn't connected yet/);
    expect(html).toMatch(/Late/);
    R(`RLOG = {error: "The app can't open the receiving log. Share it with x@y as Viewer.", rows: [], readAt: null}`);
    expect(R(`(renderReceiving(stats()), document.__html)`) as string).toMatch(/Share it with x@y as Viewer/);
  });
  it("a viewer sees the rows but no buttons", () => {
    const R = page();
    R(`readOnly = true`);
    expect(R(`(renderReceiving(stats()), document.__html)`) as string).not.toMatch(/data-logok|data-lognot|data-logundo/);
  });
  it("two quick confirms on one order both land", async () => {
    const R = page();
    R(`RLOG = {...RLOG, rows: RLOG.rows.concat([{...RLOG.rows[0], key: 'r-fj2', invoice: '9000505441', amount: 299.39}])}`);
    await R(`Promise.all([confirmLogRow('r-fj', 'fj-dec'), confirmLogRow('r-fj2', 'fj-dec')])`);
    expect(R(`POS.find(p => p.id === 'fj-dec').invoicesIn.map(e => e.logKey).sort()`)).toEqual(["r-fj", "r-fj2"]);
  });
  it("a hand entry with no invoice number is replaced on confirm when the person agrees, and comes back on undo", async () => {
    const R = page();
    R(`globalThis.confirm = () => true; const p = POS.find(x => x.id === 'fj-dec'); p.invoicesIn = [{date: '2026-11-17', source: 'hand', at: '2026-11-17T15:00:00Z', rcvd: 0}]`);
    await R(`confirmLogRow('r-fj', 'fj-dec')`);
    expect(R(`POS.find(p => p.id === 'fj-dec').invoicesIn.map(e => e.source)`)).toEqual(["log"]);
    await R(`undoLogRow('r-fj')`);
    expect(R(`POS.find(p => p.id === 'fj-dec').invoicesIn.map(e => e.source)`)).toEqual(["hand"]);
  });
  it("the order dialog's Invoice in follows the same rule as the lists", () => {
    const R = page();
    R(`isAdmin = false`);
    expect(R(`invoiceInAllowed()`)).toBe(false);
    R(`isAdmin = true`);
    expect(R(`invoiceInAllowed()`)).toBe(true);
    R(`isAdmin = false; RLOG = null`);
    expect(R(`invoiceInAllowed()`)).toBe(true);
  });
  it("a failed read shows its code and message on the page, and the owner can read again", async () => {
    const R = page();
    R(`RLOG = null; isAdmin = true;
      globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => JSON.stringify({ ok: false, error: "The receiving log copy couldn't be saved." }) })`);
    await R(`readLogNow(true)`);
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/copy couldn&#39;t be saved/);
    expect(html).toMatch(/503/);
    expect(html).toMatch(/data-logread/);
    R(`isAdmin = false`);
    expect(R(`(renderReceiving(stats()), document.__html)`) as string).not.toMatch(/data-logread/);
  });
  it("a read that can't reach the app says so", async () => {
    const R = page();
    R(`RLOG = null; globalThis.fetch = async () => { throw new Error("network down"); }`);
    await R(`readLogNow(true)`);
    expect(R(`(renderReceiving(stats()), document.__html)`) as string).toMatch(/reach the app to read the receiving log/);
  });
  it("a good read clears the failure", async () => {
    const R = page();
    R(`globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true, rows: 3 }) })`);
    await R(`readLogNow(true)`);
    expect(R(`LOGPOKE.error`)).toBeNull();
  });
});

describe("refining arrivals: cents and rows no order fits exactly", () => {
  it("log rows, confirms and the store-room list show cents", async () => {
    const R = page();
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/\$1,038\.82/);
    expect(html).toMatch(/\$4,950\.21/);
    R(`globalThis.__toasts = []; globalThis.toast = m => __toasts.push(m)`);
    await R(`confirmLogRow('r-fj', 'fj-dec')`);
    expect(R(`__toasts[0]`)).toMatch(/\$1,038\.82/);
    expect(R(`(renderReceiving(stats()), document.__html)`) as string).toMatch(/data-l="Arrived" class="r num">\$1,038\.82/);
  });
  it("a vendor's row due months away, or bigger than what is open, is still offered that vendor's orders to pick from", () => {
    const R = page();
    // Shipped in November against an order due next April, and $2,400 against $2,000 open: no exact fit
    R(`RLOG = {...RLOG, rows: RLOG.rows.concat([{key: 'r-far', tab: 'SHEET 4', date: '2026-11-20', desc: 'FJ Mens Stock', invoice: '77', amount: 2400, credit: false, brand: 'footjoy', special: false}])};
       POS.push({id: 'fj-apr', status: 'open', cat: '620', vendorId: 'v-fj', deliveryMonth: '2027-04', orderDate: '2026-09-01', cost: 1500, lines: []})`);
    const q = R(`(() => { const q = receivingQueue(); const x = q.toMatch.find(x => x.row.key === 'r-far'); return x && {fit: x.fit, cands: x.cands.map(p => p.id)}; })()`);
    expect(q).toEqual({ fit: "loose", cands: ["fj-dec", "fj-apr"] });
    expect(R(`receivingQueue().toMatch.find(x => x.row.key === 'r-fj').fit`)).toBe("good");
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/data-logpick="r-far"/);
    expect(html).toMatch(/No order fits exactly/);
  });
  it("a row from no vendor's orders can still be matched to any open order by hand", async () => {
    const R = page();
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/data-logpick="r-melin"/);
    await R(`confirmLogRow('r-melin', 'fj-dec')`);
    expect(R(`receivingQueue().matched.map(x => x.row.key)`)).toContain("r-melin");
  });
  it("picking from the list confirms the match", async () => {
    const R = page();
    await R(`(async () => { const sel = {dataset: {logpick: 'r-melin'}, value: 'fj-dec', disabled: false, closest: () => sel};
      await onLogPick({target: sel}); })()`);
    expect(R(`POS.find(p => p.id === 'fj-dec').invoicesIn.map(e => e.logKey)`)).toEqual(["r-melin"]);
  });
  it("a viewer gets no pick list", () => {
    const R = page();
    R(`readOnly = true`);
    expect(R(`(renderReceiving(stats()), document.__html)`) as string).not.toMatch(/data-logpick/);
  });
});
