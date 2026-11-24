import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

// The Vendors view's scorecard: on time, days late, how much of what was due has arrived, last arrival.
const base = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));
const o = (id: string, extra: object) => ({ id, poNumber: id, status: "open", cat: "620", vendorId: "v-fj", orderDate: "2026-06-01", cost: 1000, lines: [], ...extra });
const docs = { ...base, vendors: [{ id: "v-fj", name: "FootJoy" }, { id: "v-pm", name: "Peter Millar" }],
  pos: [
    o("a", { deliveryMonth: "2026-09", invoicesIn: [{ date: "2026-09-20", amount: 1000, source: "log", at: "2026-09-20T00:00:00Z" }] }),      // on time
    o("b", { deliveryMonth: "2026-09", invoicesIn: [{ date: "2026-10-10", amount: 400, source: "log", at: "2026-10-10T00:00:00Z" }] }),       // 10 days late, 40% in
    o("c", { deliveryMonth: "2026-10" }),                                                                                                       // nothing yet: late 24 days by Nov 24
    o("d", { deliveryMonth: "2027-02" }),                                                                                                       // not due: not judged
    o("e", { deliveryMonth: "2026-08", status: "cancelled" }),                                                                                  // cancelled: not judged
    o("f", { deliveryMonth: "2026-08", status: "received", received: 1000 }),                                                                   // Jonas only, no date: counts toward arrived, not timing
  ] };
const page = () => { const R = loadPage(docs); R(`VENDORS = __docs.vendors; globalThis.fillPeople = () => {}`); return R; };

describe("vendor scorecard", () => {
  it("scores a vendor's orders that were due", () => {
    const R = page();
    expect(R(`vendorScore(POS.filter(p => p.vendorId === 'v-fj'), '2026-11-24')`)).toEqual({
      judged: 3, onTime: 1, avgLate: 17, due: 4000, arrived: 2400, lastArrival: "2026-10-10" });
  });
  it("a vendor with nothing due yet has no score", () => {
    const R = page();
    expect(R(`vendorScore([], '2026-11-24')`)).toEqual({ judged: 0, onTime: 0, avgLate: null, due: 0, arrived: 0, lastArrival: null });
  });
  it("the Vendors view shows the scorecard as counts", () => {
    const R = page();
    const html = R(`(renderVendorsPage(), document.__html)`) as string;
    expect(html).toMatch(/On time/);
    expect(html).toMatch(/1 of 3/);
    expect(html).toMatch(/1[67] days/);   // the harness clock sets today
    expect(html).toMatch(/\$2,400 of \$4,000/);
    expect(html).toMatch(/Oct 10, 2026/);
  });
});
