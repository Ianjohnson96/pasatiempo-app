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
});
