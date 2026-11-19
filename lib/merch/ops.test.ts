import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// merchandise/app/src/18-ops.js is plain browser JS joined into the page. It is pure, so it runs here as it is.
const src = readFileSync(path.join(process.cwd(), "merchandise/app/src/18-ops.js"), "utf8");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const O: any = vm.runInNewContext(src + ";({arrivedValue, rcvState, daysWaiting, seasonOf, isPrebook})");

describe("arrivedValue", () => {
  it("sums amounts, counts an amountless entry as the whole order, caps and floors", () => {
    expect(O.arrivedValue([], 500)).toBe(0);
    expect(O.arrivedValue([{ date: "2026-11-18" }], 500)).toBe(500);
    expect(O.arrivedValue([{ amount: 200 }, { amount: 200 }], 300)).toBe(300);
    expect(O.arrivedValue([{}, {}], 300)).toBe(300);
    expect(O.arrivedValue([{ amount: -50 }], 300)).toBe(0);
  });
});

describe("rcvState", () => {
  const base = { status: "open", invoicesIn: [{ date: "2026-11-10", amount: 1000 }], openValue: 3000, receivedValue: 0, deliveryMonth: "2027-02" };
  it("received and cancelled orders are received", () => {
    expect(O.rcvState({ status: "received", invoicesIn: [{ date: "2026-11-01" }], openValue: 0, receivedValue: 500, deliveryMonth: "2026-11" }, "2026-11")).toBe("received");
    expect(O.rcvState({ ...base, status: "cancelled" }, "2026-11")).toBe("received");
  });
  it("arrived until cleared or month-end catches up", () => {
    expect(O.rcvState(base, "2026-11")).toBe("arrived");
    expect(O.rcvState({ ...base, invoicesClearedAt: "2026-11-20T00:00:00Z" }, "2026-11")).toBe("received");
    expect(O.rcvState({ ...base, receivedValue: 1000 }, "2026-11")).toBe("received");
  });
  it("without invoices, goes by delivery month", () => {
    const o = { status: "open", invoicesIn: [], openValue: 3000, receivedValue: 0 };
    expect(O.rcvState({ ...o, deliveryMonth: "2026-10" }, "2026-11")).toBe("late");
    expect(O.rcvState({ ...o, deliveryMonth: "2026-11" }, "2026-11")).toBe("due");
    expect(O.rcvState({ ...o, deliveryMonth: "2027-02" }, "2026-11")).toBe("later");
    expect(O.rcvState(o, "2026-11")).toBe("later");
  });
});

describe("daysWaiting", () => {
  it("counts days since the earliest entry", () => {
    expect(O.daysWaiting([{ date: "2026-11-01" }, { date: "2026-11-10" }], "2026-11-18")).toBe(17);
  });
});

describe("seasons", () => {
  it("names the season a month belongs to", () => {
    const s = O.seasonOf("2027-03");
    expect(s.key).toBe("spring");
    expect(s.label).toBe("Spring 2027");
    expect(s.first).toBe("2027-01");
    expect(O.seasonOf("2027-06").key).toBe("summer");
    expect(O.seasonOf("2026-09").first).toBe("2026-08");
    const h = O.seasonOf("2026-12");
    expect(h.label).toBe("Holiday 2026");
    expect(h.first).toBe("2026-11");
  });
  it("covers all twelve months", () => {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => O.seasonOf(`2027-${String(m).padStart(2, "0")}`).key);
    expect(keys).toEqual(["spring", "spring", "spring", "spring", "summer", "summer", "summer", "fall", "fall", "fall", "holiday", "holiday"]);
    expect(O.seasonOf("2027-06").first).toBe("2027-05");
  });
  it("returns null for a missing or malformed month", () => {
    expect(O.seasonOf(undefined)).toBeNull();
    expect(O.seasonOf("")).toBeNull();
    expect(O.seasonOf(5)).toBeNull();
    expect(O.isPrebook("2026-08-01", null)).toBe(false);
  });
  it("a prebook is ordered before the season starts", () => {
    expect(O.isPrebook("2026-08-01", O.seasonOf("2027-03"))).toBe(true);
    expect(O.isPrebook("2027-02-10", O.seasonOf("2027-03"))).toBe(false);
    expect(O.isPrebook(undefined, O.seasonOf("2027-03"))).toBe(false);
    expect(O.isPrebook("2027-04-15", O.seasonOf("2027-06"))).toBe(true);
    expect(O.isPrebook("2027-05-02", O.seasonOf("2027-06"))).toBe(false);
  });
});
