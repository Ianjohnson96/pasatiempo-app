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
});
