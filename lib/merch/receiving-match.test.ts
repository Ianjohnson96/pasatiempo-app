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

describe("matching with the columns the team may add", () => {
  const add = (R: (e: string) => unknown, row: object) => R(`RLOG = {...RLOG, rows: RLOG.rows.concat([${JSON.stringify(row)}])}`);
  const fit = (R: (e: string) => unknown, key: string) => R(`(() => { const x = receivingQueue().toMatch.find(x => x.row.key === '${key}'); return x ? [x.fit, x.cands.map(p => p.id)] : (receivingQueue().notOrder.find(x => x.row.key === '${key}') || {}).why; })()`);
  const row = { tab: "2027", date: "2026-11-20", desc: "Melin hats", invoice: "5", amount: 9999, credit: false, brand: null, special: false };
  it("a PO # on the row matches that order exactly, whatever the vendor words or amount", () => {
    const R = page();
    R(`POS.find(p => p.id === 'fj-dec').poNumber = 'P-4471'`);
    add(R, { ...row, key: "r-po", po: "p 4471" });
    expect(fit(R, "r-po")).toEqual(["exact", ["fj-dec"]]);
  });
  it("a PO # no order has falls back to the usual suggestions", () => {
    const R = page();
    add(R, { ...row, key: "r-po", po: "NOPE-1" });
    expect(fit(R, "r-po")).toBe("none");
  });
  it("a credit naming its original invoice goes to the order that invoice is on", async () => {
    const R = page();
    await R(`confirmLogRow('r-fj', 'fj-dec')`);
    add(R, { ...row, key: "r-cr", credit: true, amount: -48, invoice: "C1", origInvoice: "9000498548" });
    expect(fit(R, "r-cr")).toEqual(["exact", ["fj-dec"]]);
  });
  it("the Vendor column names the vendor when the description doesn't", () => {
    const R = page();
    add(R, { ...row, key: "r-v", vendor: "FJ", amount: 500, date: "2026-12-02" });
    expect(fit(R, "r-v")).toEqual(["good", ["fj-dec"]]);
  });
  it("a Reorder row no order fits is filed as a reorder, not offered loose", () => {
    const R = page();
    R(`POS.push({id: 'fj-apr', status: 'open', cat: '620', vendorId: 'v-fj', deliveryMonth: '2027-04', orderDate: '2026-09-01', cost: 1500, lines: []})`);
    add(R, { ...row, key: "r-re", desc: "FJ gloves", type: "reorder", amount: 9000 });
    expect(fit(R, "r-re")).toBe("reorder");
  });
});
describe("how filed and named rows read", () => {
  it("says a reorder row is a reorder and an exact PO match is named in the log", () => {
    const R = page();
    R(`POS.find(p => p.id === 'fj-dec').poNumber = '4471';
       RLOG = {...RLOG, rows: RLOG.rows.concat([{key: 'r-re', tab: 'x', date: '2026-11-20', desc: 'Melin', invoice: '1', amount: 5, credit: false, brand: null, special: false, type: 'reorder'},
         {key: 'r-po', tab: 'x', date: '2026-11-20', desc: 'Hats', invoice: '2', amount: 5, credit: false, brand: null, special: false, po: '4471'}])}`);
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/a reorder in the log/);
    expect(html).toMatch(/named in the log/);
  });
});
describe("confirming every sure match at once", () => {
  const two = (R: (e: string) => unknown) => R(`RLOG = {...RLOG, rows: RLOG.rows.concat([{...RLOG.rows[0], key: 'r-fj2', invoice: '9000505441', amount: 299.39}])}`);
  it("counts only named rows and rows with one possible order as sure", () => {
    const R = page();
    two(R);
    R(`POS.push({id: 'fj-dec2', status: 'open', cat: '620', vendorId: 'v-fj', deliveryMonth: '2026-12', orderDate: '2026-09-01', cost: 5000, lines: []})`);
    expect(R(`sureMatches(receivingQueue()).length`)).toBe(0);   // two FootJoy orders fit each row: a person picks
  });
  it("offers the button for two or more sure rows and confirms them all, after one question", async () => {
    const R = page();
    two(R);
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/data-logall="1"[^>]*>Confirm all 2 sure matches/);
    R(`globalThis.__asked = []; globalThis.confirm = m => (__asked.push(m), true)`);
    await R(`confirmAllSure()`);
    expect(R(`__asked.length`)).toBe(1);
    expect(R(`POS.find(p => p.id === 'fj-dec').invoicesIn.map(e => e.logKey).sort()`)).toEqual(["r-fj", "r-fj2"]);
  });
  it("does nothing if the person says no, and viewers get no button", async () => {
    const R = page();
    two(R);
    R(`globalThis.confirm = () => false`);
    await R(`confirmAllSure()`);
    expect(R(`POS.find(p => p.id === 'fj-dec').invoicesIn`)).toBeFalsy();
    R(`readOnly = true`);
    expect(R(`(renderReceiving(stats()), document.__html)`) as string).not.toMatch(/data-logall/);
  });
});

describe("remembering a vendor's word from a hand match", () => {
  const owner = (R: (e: string) => unknown) => R(`window.MERCH_HOST = globalThis.MERCH_HOST = {me: {role: 'owner'}}; globalThis.__asked = []; globalThis.prompt = (m, d) => (__asked.push([m, d]), d)`);
  it("guesses the brand word from the description, skipping product and stock words", () => {
    const R = page();
    expect(R(`guessVendorWord('Hats Melin Mens Stock')`)).toBe("melin");
    expect(R(`guessVendorWord('T-Shirts/Backpack Mens Stock (Smith)')`)).toBe(null);
  });
  it("the owner picking an order for a row it didn't name is offered the word, and it is saved to the guidelines", async () => {
    const R = page();
    owner(R);
    await R(`onLogPick({target: (() => { const s = {dataset: {logpick: 'r-melin'}, value: 'fj-dec', closest: () => s}; return s; })()})`);
    expect(R(`__asked.length`)).toBe(1);
    expect(R(`__asked[0][1]`)).toBe("melin");
    const w = R(`__writes.find(w => w[0] === 'guidelines/current')[1].vendorWords`);
    expect(w).toEqual({ footjoy: ["melin"] });
  });
  it("a remembered word takes effect on the page at once", async () => {
    const R = page();
    R(`GUIDE = {vendorWords: {footjoy: ['melin']}}`);
    R(`RLOG = {...RLOG, rows: RLOG.rows.map(r => r.key === 'r-melin' ? {...r, amount: 900, date: '2026-12-01'} : r)}`);
    expect(R(`receivingQueue().toMatch.map(x => x.row.key)`)).toContain("r-melin");
  });
  it("staff aren't asked; nor is anyone when the row already named the vendor", async () => {
    const R = page();
    R(`globalThis.__asked = []; globalThis.prompt = (m, d) => (__asked.push(m), d)`);
    await R(`onLogPick({target: (() => { const s = {dataset: {logpick: 'r-melin'}, value: 'fj-dec', closest: () => s}; return s; })()})`);
    owner(R);
    await R(`onLogPick({target: (() => { const s = {dataset: {logpick: 'r-fj'}, value: 'fj-dec', closest: () => s}; return s; })()})`);
    expect(R(`__asked.length`)).toBe(0);
  });
});
describe("in-season reorders: entered sometimes, not always", () => {
  const melinGarb = (R: (e: string) => unknown) => R(`VENDORS = VENDORS.concat([{id: 'v-garb', name: 'Garb'}]);
    RLOG = {...RLOG, words: {...RLOG.words, garb: ['garb']}, rows: RLOG.rows.concat([{key: 'r-garb', tab: 'S', date: '2026-11-23', desc: 'Garb JR Stock', invoice: '281084', amount: 1933.16, credit: false, brand: 'garb', special: false}])}`);
  it("a row not from an order offers Add as a reorder, which opens a new order filled in from the row", () => {
    const R = page();
    melinGarb(R);
    const html = R(`(renderReceiving(stats()), document.__html)`) as string;
    expect(html).toMatch(/data-logreorder="r-garb"/);
    R(`globalThis.__opened = null; globalThis.openOrder = (id, preset) => { __opened = [id, preset]; }`);
    R(`addReorderFromLog('r-garb')`);
    expect(R(`__opened`)).toEqual([null, expect.objectContaining({ vendorId: "v-garb", orderDate: "2026-11-23", deliveryMonth: "2026-11", cost: 1933.16, _fromLog: "r-garb" })]);
  });
  it("saving that order puts the row's invoice on it and records the match, so it shows as arrived", async () => {
    const R = page();
    melinGarb(R);
    R(`db = {collection: () => ({doc: () => ({id: 'new-po'})})}; globalThis.closeOverlay = () => {}; globalThis.validateOrder = () => true;
       const q0 = document.querySelector; document.querySelector = s => q0(s) || {disabled: false, value: ''};
       D = {poNumber: 'R-1', vendorId: 'v-garb', cat: '620', orderDate: '2026-11-23', deliveryMonth: '2026-11', cost: 1933.16, status: 'open', received: 0, lines: [], _fromLog: 'r-garb'}; DX = null`);
    await R(`saveOrder()`);
    const w = R(`__writes.map(w => w[0])`) as string[];
    expect(w).toEqual(["pos/new-po", "logmatch/r-garb"]);
    expect(R(`__writes[0][1]._fromLog`)).toBeUndefined();
    expect(R(`__writes[0][1].invoicesIn.map(e => [e.logKey, e.amount, e.source])`)).toEqual([["r-garb", 1933.16, "log"]]);
    expect(R(`receivingQueue().matched.map(x => [x.row.key, x.po])`)).toContainEqual(["r-garb", "new-po"]);
  });
  it("a row marked Not an order comes back to match when an order that fits is entered afterwards", () => {
    const R = page();
    R(`LOGMATCH = {'r-fj': {state: 'notorder', by: 'x', at: '2026-11-20T00:00:00Z'}}`);
    R(`POS.find(p => p.id === 'fj-dec').createdAt = '2026-09-01T00:00:00Z'`);
    expect(R(`receivingQueue().notOrder.map(x => x.row.key)`)).toContain("r-fj");   // the order was there before the mark: stays filed
    R(`POS = POS.concat([{id: 'fj-re', status: 'open', cat: '620', vendorId: 'v-fj', deliveryMonth: '2026-11', orderDate: '2026-11-21', cost: 1038.82, lines: [], createdAt: '2026-11-21T00:00:00Z'}])`);
    expect(R(`(() => { const x = receivingQueue().toMatch.find(x => x.row.key === 'r-fj'); return x && [x.fit, x.cands.map(p => p.id)]; })()`)).toEqual(["good", ["fj-re"]]);
  });
});
describe("invoices for orders never entered: spend the budget can't see yet", () => {
  it("adds up log rows not from an order dated after the last Jonas upload", () => {
    const R = page();   // r-melin: Nov 18, $4,950.21, no order; the upload is Nov 15
    R(`RLOG = {...RLOG, rows: RLOG.rows.concat([{key: 'r-old', tab: 'S', date: '2026-11-10', desc: 'Melin', invoice: '7', amount: 300, credit: false, brand: null, special: false}])}`);
    expect(R(`offBook()`)).toEqual({ n: 1, total: 4950.21, since: "2026-11-15" });
  });
  it("a row matched to an order, or entered as a reorder, no longer counts", async () => {
    const R = page();
    await R(`confirmLogRow('r-melin', 'fj-dec')`);
    expect(R(`offBook().n`)).toBe(0);
  });
  it("the Budget page's summary says so without changing Left to buy", () => {
    const R = page();
    const before = R(`(() => { const S = stats(); return otbCats().reduce((a, c) => a + seasonBudget(c) - S.cm(c, LAST()), 0); })()`);
    const v = R(`PAGE_VERDICT.overview(stats())`) as { text: string };
    expect(v.text).toMatch(/\$4,950 of invoices for orders not in the app have come in since the Nov 15, 2026 upload/);
    expect(R(`(() => { const S = stats(); return otbCats().reduce((a, c) => a + seasonBudget(c) - S.cm(c, LAST()), 0); })()`)).toBe(before);
  });
  it("Receiving's Not from an order line gives the total since the upload", () => {
    const R = page();
    expect(R(`(renderReceiving(stats()), document.__html)`) as string).toMatch(/\$4,950\.21 since the Nov 15, 2026 upload/);
  });
});
