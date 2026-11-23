import { describe, expect, it } from "vitest";
import { canWrite, docBytes, docProblem } from "./rules";

describe("merch access rules", () => {
  it("lets staff write only the named collections", () => {
    for (const p of ["pos/a", "vendors/a", "subcats/a", "counts/a", "istate/a", "checklist/2026-10", "brandmap/current", "submap/current"])
      expect(canWrite("staff", p)).toBe(true);
    for (const p of ["plan/assumptions", "plan/fy27/adjustments/x", "base/current", "brandCalls/x", "newthing/x", "posx/a"])
      expect(canWrite("staff", p)).toBe(false);
    expect(canWrite("owner", "newthing/x")).toBe(true);
    expect(canWrite("viewer", "pos/a")).toBe(false);
  });

  it("refuses orders the page couldn't do sums or dates on", () => {
    expect(docProblem("pos/a", { status: "open", cost: "1200.50", deliveryMonth: "2027-02", lines: [{ cost: 12, units: "", qty: { M: 3 } }] })).toBeNull();
    expect(docProblem("pos/a", { status: "lost" })).toMatch(/status/);
    expect(docProblem("pos/a", { cost: "abc" })).toMatch(/cost/);
    expect(docProblem("pos/a", { deliveryMonth: "Feb" })).toMatch(/deliveryMonth/);
    expect(docProblem("pos/a", { orderDate: "2026-09-21" })).toBeNull();
    expect(docProblem("pos/a", { orderDate: "" })).toBeNull();
    expect(docProblem("pos/a", { orderDate: "9/21/26" })).toMatch(/orderDate/);
    expect(docProblem("pos/a", { orderDate: "Print date" })).toMatch(/orderDate/);
    expect(docProblem("pos/a", { lines: "x" })).toMatch(/lines/);
    expect(docProblem("pos/a", { lines: [{ cost: "twelve" }] })).toMatch(/line cost/);
    expect(docProblem("pos/a", null)).toBeNull(); // a delete
  });

  it("checks invoice-arrival entries on an order", () => {
    expect(docProblem("pos/a", { invoicesIn: [{ date: "2026-11-18", amount: "abc", source: "hand" }] })).toMatch(/amount/);
    expect(docProblem("pos/a", { invoicesIn: [{ date: "Nov 18", source: "hand" }] })).toMatch(/date/);
    expect(docProblem("pos/a", { invoicesIn: "x" })).toMatch(/invoicesIn/);
    expect(docProblem("pos/a", { invoicesIn: [{ date: "2026-11-18", amount: 250, source: "log" }], invoicesClearedAt: "2026-11-20T00:00:00Z" })).toBeNull();
    expect(docProblem("pos/a", { invoicesIn: [{ date: "2026-11-18", source: "fax" }] })).toMatch(/source/);
    expect(docProblem("pos/a", { invoicesIn: [{ date: "2026-11-18", amount: 500, source: "hand", rcvd: 1000 }] })).toBeNull();
    expect(docProblem("pos/a", { invoicesIn: [{ date: "2026-11-18", source: "hand", rcvd: "lots" }] })).toMatch(/rcvd/);
    expect(docProblem("pos/a", { invoicesClearedAt: 5 })).toMatch(/invoicesClearedAt/);
  });

  it("checks budget change amounts and assignment maps", () => {
    expect(docProblem("plan/fy27/adjustments/x", { amount: "nope" })).toMatch(/amount/);
    expect(docProblem("plan/fy27/adjustments/x", { amount: -500 })).toBeNull();
    expect(docProblem("brandmap/current", { skus: [] })).toMatch(/skus/);
  });

  it("measures size in UTF-8 bytes", () => {
    expect(docBytes({ a: "é" })).toBe(JSON.stringify({ a: "é" }).length + 1);
  });

  it('keeps the guidelines owner-only and checks them', () => {
    expect(canWrite('staff', 'guidelines/current')).toBe(false);
    expect(canWrite('owner', 'guidelines/current')).toBe(true);
    expect(docProblem('guidelines/current', { memberDiscount: 2 })).toMatch(/memberDiscount/);
    expect(docProblem('guidelines/current', { roles: { fashion: { wks: [16, 12, 8, 24] } } })).toMatch(/weeks/);
    expect(docProblem('guidelines/current', { mix: { total: -1 } })).toMatch(/total/);
    expect(docProblem('guidelines/current', { mix: { follow: 'onhand' } })).toMatch(/follow/);
    expect(docProblem('guidelines/current', { mix: { total: 632720, follow: 'suggested' } })).toBeNull();
    expect(docProblem('guidelines/current', { mix: { ranges: { fashion: [50, 40] } } })).toMatch(/range/);
    expect(docProblem('guidelines/current', { seasons: { spring: 1, summer: 9, fall: 8, holiday: 11 } })).toMatch(/season/);
    expect(docProblem('guidelines/current', { history: 'x' })).toMatch(/history/);
    expect(docProblem('guidelines/current', { history: Array(201).fill({ at: '2026-11-19T00:00:00Z', what: 'x' }) })).toMatch(/history/);
    expect(docProblem('guidelines/current', { roleOf: { '480': 'bogus' } })).toMatch(/role/);
    expect(docProblem('guidelines/current', { bench: { gm: { apparel: 'x' } } })).toMatch(/bench/);
    expect(docProblem('guidelines/current', {
      bench: { gm: { apparel: 0.48 } }, roles: { fashion: { wks: [12, 16, 8, 24], over: 30 } }, roleOf: { '480': 'impulse' },
      mix: { total: 700000, ranges: { fashion: [38, 48] } }, seasons: { spring: 1, summer: 5, fall: 8, holiday: 11 }, memberDiscount: 0.25,
      history: [{ at: '2026-11-19T00:00:00Z', by: 'u', what: 'Apparel margin', from: '45%', to: '48%' }],
    })).toBeNull();
  });

describe("receiving log documents", () => {
  it("nobody writes the log copy through the page; owner and staff write match decisions", () => {
    expect(canWrite("owner", "receivinglog/current")).toBe(false);
    expect(canWrite("staff", "receivinglog/current")).toBe(false);
    expect(canWrite("staff", "logmatch/abc")).toBe(true);
    expect(canWrite("viewer", "logmatch/abc")).toBe(false);
  });
  it("checks a match decision's shape", () => {
    expect(docProblem("logmatch/abc", { state: "matched", po: "p1", amount: 10, date: "2026-11-02", by: "x" })).toBeNull();
    expect(docProblem("logmatch/abc", { state: "notorder", by: "x" })).toBeNull();
    expect(docProblem("logmatch/abc", { state: "maybe" })).toMatch(/state/);
    expect(docProblem("logmatch/abc", { state: "matched", amount: 10, date: "2026-11-02" })).toMatch(/order/);
  });
});
});
