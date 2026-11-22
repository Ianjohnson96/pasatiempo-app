import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// merchandise/app/src/18-ops.js is plain browser JS joined into the page. It is pure, so it runs here as it is.
const src = readFileSync(path.join(process.cwd(), "merchandise/app/src/18-ops.js"), "utf8");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const O: any = vm.runInNewContext(src + ";({arrivedValue, rcvState, daysWaiting, seasonOf, isPrebook, slotMonth, deliverySlots, makeInvoiceEntry, liveInvoices, storeRoomValue, seasonMonths, seasonList, seasonBuys, orderDateISO, posDates})");

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
    // A Clear (nothing newer) only takes it off the store-room list: the open balance is late / due / later by month.
    expect(O.rcvState({ ...base, invoicesIn: [], invoicesClearedAt: "2026-11-20T00:00:00Z" }, "2026-11")).toBe("later");
    expect(O.rcvState({ ...base, invoicesIn: [], invoicesClearedAt: "2026-11-20T00:00:00Z", receivedValue: 3000 }, "2026-11")).toBe("received");
    // everything invoiced is received: off the store-room list; an open balance still counts by delivery month (R14)
    expect(O.rcvState({ ...base, receivedValue: 1000 }, "2026-11")).toBe("later");
    expect(O.rcvState({ ...base, receivedValue: 3000 }, "2026-11")).toBe("received");
  });
  it("without invoices, goes by delivery month", () => {
    const o = { status: "open", invoicesIn: [], openValue: 3000, receivedValue: 0 };
    expect(O.rcvState({ ...o, deliveryMonth: "2026-10" }, "2026-11")).toBe("late");
    expect(O.rcvState({ ...o, deliveryMonth: "2026-11" }, "2026-11")).toBe("due");
    expect(O.rcvState({ ...o, deliveryMonth: "2027-02" }, "2026-11")).toBe("later");
    expect(O.rcvState(o, "2026-11")).toBe("later");
  });
  it("cleared, past its delivery month, with an open balance → late", () => {
    const o = { status: "open", invoicesIn: [], invoicesClearedAt: "2026-11-20T00:00:00Z", openValue: 3000, receivedValue: 500, deliveryMonth: "2026-09" };
    expect(O.rcvState(o, "2026-11")).toBe("late");
    expect(O.rcvState({ ...o, deliveryMonth: "2026-11" }, "2026-11")).toBe("due");
    expect(O.rcvState({ ...o, status: "cancelled" }, "2026-11")).toBe("received");
  });
  it("an invoice on a partly received order counts from what was received at entry (rcvd)", () => {
    const o = { status: "partial", invoicesIn: [{ date: "2026-11-18", amount: 500, rcvd: 1000 }], openValue: 3000, receivedValue: 1000, deliveryMonth: "2026-10" };
    expect(O.rcvState(o, "2026-11")).toBe("arrived");
    expect(O.storeRoomValue(o.invoicesIn, 3000, 1000)).toBe(500);
    expect(O.storeRoomValue(o.invoicesIn, 3000, 1500)).toBe(0);
    expect(O.rcvState({ ...o, receivedValue: 1500 }, "2026-11")).toBe("late");
    const whole = [{ date: "2026-11-18", rcvd: 1000 }];
    expect(O.storeRoomValue(whole, 3000, 1000)).toBe(2000);
    expect(O.rcvState({ ...o, invoicesIn: whole }, "2026-11")).toBe("arrived");
    // two entries: base is the smaller rcvd; the total is capped at what was still open at the base
    expect(O.storeRoomValue([{ amount: 500, rcvd: 1000 }, { amount: 5000, rcvd: 1200 }], 3000, 1200)).toBe(1800);
  });
  it("invoiced goods all received but an open balance left: late / due / later by month (R14)", () => {
    const o = { status: "partial", invoicesIn: [{ date: "2026-11-18", amount: 500, rcvd: 1000 }], openValue: 3000, receivedValue: 1500, deliveryMonth: "2026-09" };
    expect(O.rcvState(o, "2026-11")).toBe("late");
    expect(O.rcvState({ ...o, deliveryMonth: "2027-03" }, "2026-11")).toBe("later");
    expect(O.rcvState({ ...o, receivedValue: 3000 }, "2026-11")).toBe("received");
    expect(O.rcvState({ ...o, status: "received" }, "2026-11")).toBe("received");
  });
  it("entries without rcvd behave as before (counted from zero)", () => {
    const o = { status: "partial", invoicesIn: [{ date: "2026-11-18", amount: 500 }], openValue: 3000, receivedValue: 1000, deliveryMonth: "2026-10" };
    expect(O.rcvState(o, "2026-11")).toBe("late");
    expect(O.storeRoomValue(o.invoicesIn, 3000, 1000)).toBe(0);
    expect(O.storeRoomValue([{ amount: 1500 }], 3000, 1000)).toBe(500);
    expect(O.storeRoomValue([{}], 3000, 1000)).toBe(2000);
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

describe("deliverySlots", () => {
  it("starts two months before this month and folds earlier deliveries into one column", () => {
    const d = O.deliverySlots(["2024-03", "2026-10", "2027-02"], "2026-11");
    expect(d.months[0]).toBe("2026-09");
    expect(d.months.at(-1)).toBe("2027-02");
    expect(d.early).toBe(true);
    expect(d.slot("2024-03")).toBe(0);
    expect(d.slot("2026-09")).toBe(1);
    expect(d.slot("2027-02")).toBe(d.months.length);
  });
  it("starts at the first delivery when it is recent, and caps at 24 months with a Later column", () => {
    const a = O.deliverySlots(["2026-10", "2026-12"], "2026-11");
    expect(a.early).toBe(false);
    expect(a.months).toEqual(["2026-10", "2026-11", "2026-12"]);
    const b = O.deliverySlots(["2026-11", "2030-01"], "2026-11");
    expect(b.months.length).toBe(24);
    expect(b.later).toBe(true);
    expect(b.slot("2030-01")).toBe(24);
  });
  it("adds months across a year end and handles no dates", () => {
    expect(O.slotMonth("2026-11", 3)).toBe("2027-02");
    expect(O.slotMonth("2026-11", -2)).toBe("2026-09");
    expect(O.deliverySlots([null, ""], "2026-11").months).toEqual([]);
  });
});

describe("makeInvoiceEntry", () => {
  it("makes a hand entry; the amount is optional", () => {
    expect(O.makeInvoiceEntry({ date: "2026-11-18" }, "u1").entry).toMatchObject({ date: "2026-11-18", source: "hand", by: "u1" });
    expect(typeof O.makeInvoiceEntry({ date: "2026-11-18" }, "u1").entry.at).toBe("string");
    expect(O.makeInvoiceEntry({ date: "2026-11-18" }, "u1", 1000).entry.rcvd).toBe(1000);
    expect(O.makeInvoiceEntry({ date: "2026-11-18" }, "u1").entry.rcvd).toBe(0);
    expect(O.makeInvoiceEntry({ date: "2026-11-18", amount: "$1,000.456", invoice: " A-7 ", note: " box 2 " }, "u1").entry).toMatchObject({
      date: "2026-11-18", source: "hand", by: "u1", amount: 1000.46, invoice: "A-7", note: "box 2",
    });
    expect(O.makeInvoiceEntry({ date: "2026-11-18", amount: "$1,000.50" }, "u1").entry.amount).toBe(1000.5);
    expect(O.makeInvoiceEntry({ date: "2026-11-18", amount: "1000" }, "u1").entry.amount).toBe(1000);
  });
  it("refuses a missing date or a non-positive amount", () => {
    expect(O.makeInvoiceEntry({ date: "" }, "u1").error).toBeTruthy();
    expect(O.makeInvoiceEntry({ date: "11/18/2026" }, "u1").error).toBeTruthy();
    expect(O.makeInvoiceEntry({ date: "2026-11-18", amount: "0" }, "u1").error).toBeTruthy();
    expect(O.makeInvoiceEntry({ date: "2026-11-18", amount: "abc" }, "u1").error).toBeTruthy();
    expect(O.makeInvoiceEntry({ date: "2026-11-18", amount: "-5" }, "u1").error).toBeTruthy();
    expect(O.makeInvoiceEntry({ date: "2026-11-18", amount: "12abc" }, "u1").error).toBeTruthy();
  });
});

describe("liveInvoices and storeRoomValue", () => {
  const old = { date: "2026-11-01", amount: 300, at: "2026-11-01T10:00:00.000Z" };
  const noAt = { date: "2026-10-01", amount: 50 };
  it("counts everything when never cleared", () => {
    expect(O.liveInvoices([old, noAt], undefined)).toEqual({ entries: [old, noAt], cleared: false });
  });
  it("a Clear with nothing newer takes the order off the list", () => {
    const r = O.liveInvoices([old, noAt], "2026-11-05T00:00:00.000Z");
    expect(r.entries).toEqual([]);
    expect(r.cleared).toBe(true);
  });
  it("a new invoice after a Clear shows again, with only the new amount", () => {
    const fresh = { date: "2026-11-10", amount: 200, at: "2026-11-10T09:00:00.000Z" };
    const r = O.liveInvoices([old, noAt, fresh], "2026-11-05T00:00:00.000Z");
    expect(r.entries).toEqual([fresh]);
    expect(r.cleared).toBe(false);
    expect(O.rcvState({ status: "open", deliveryMonth: "2026-11", invoicesIn: r.entries, receivedValue: 0, openValue: 1000 }, "2026-11")).toBe("arrived");
  });
  it("store-room value is less what the POS already shows received", () => {
    expect(O.storeRoomValue([{ amount: 600 }], 1000, 400)).toBe(200);
    expect(O.storeRoomValue([{}], 1000, 400)).toBe(600);
    expect(O.storeRoomValue([{ amount: 5000 }], 1000, 0)).toBe(1000);
    expect(O.storeRoomValue([{ amount: 300 }], 1000, 400)).toBe(0);
  });
});

describe("season buys", () => {
  const spring = () => O.seasonOf("2027-03");
  const rows = [
    { month: "2027-02", cat: "400", brand: "Peter Millar", orderDate: "2026-09-10", amount: 1000, units: 10 },
    { month: "2027-03", cat: "400", brand: "Peter Millar", orderDate: "2027-02-20", amount: 300, units: 3 },
    { month: "2027-04", cat: "500", brand: "", orderDate: "2026-12-01", amount: 200, units: 4 },
    { month: "2027-03", cat: "640", brand: "Peter Millar", orderDate: "2026-09-10", amount: 999, units: 9 },
    { month: "2027-05", cat: "400", brand: "Peter Millar", orderDate: "2026-09-10", amount: 500, units: 5 },
    { month: "2027-03", cat: "400", brand: "Peter Millar", orderDate: "2026-09-10", amount: 0, units: 0 },
  ];
  it("lists a season's months", () => {
    expect(O.seasonMonths(spring())).toEqual(["2027-01", "2027-02", "2027-03", "2027-04"]);
    expect(O.seasonMonths(O.seasonOf("2026-12"))).toEqual(["2026-11", "2026-12"]);
    expect(O.seasonMonths(null)).toEqual([]);
  });
  it("splits prebooked from reorders, leaves out Special Orders, and groups by month, category and brand", () => {
    const t = O.seasonBuys(rows, spring());
    expect(t.committed).toBe(1500);
    expect(t.prebooked).toBe(1200);
    expect(t.reorders).toBe(300);
    expect(t.units).toBe(17);
    expect(t.byMonth["2027-02"]).toEqual({ prebooked: 1000, reorders: 0 });
    expect(t.byMonth["2027-03"]).toEqual({ prebooked: 0, reorders: 300 });
    expect(t.byCat).toEqual({ "400": 1300, "500": 200 });
    expect(t.byBrand.map((b: { brand: string }) => b.brand)).toEqual(["Peter Millar", "Other / no brand"]);
    expect(t.byBrand[0]).toMatchObject({ committed: 1300, prebooked: 1000, reorders: 300, units: 13 });
  });
  it("orders seasons: current first, then coming, then past latest first", () => {
    const rs = ["2026-03", "2026-08", "2026-11", "2027-02", "2027-06"].map((month) => ({ month, cat: "400", amount: 1 }));
    expect(O.seasonList(rs, "2026-11").map((s: { label: string }) => s.label)).toEqual(["Holiday 2026", "Spring 2027", "Summer 2027", "Fall 2026", "Spring 2026"]);
    expect(O.seasonList([{ month: "2026-11", cat: "640", amount: 5 }], "2026-11")).toEqual([]);
    // the season under way is listed with nothing on order, so its room isn't left off the page
    expect(O.seasonList([{ month: "2027-02", cat: "400", amount: 1 }], "2026-11", ["2026-11"]).map((s: { label: string }) => s.label)).toEqual(["Holiday 2026", "Spring 2027"]);
  });
});

describe("orderDateISO", () => {
  it("reads ISO, M/D/YYYY and M/D/YY; rejects the rest", () => {
    expect(O.orderDateISO("2026-09-21")).toBe("2026-09-21");
    expect(O.orderDateISO("8/25/2026")).toBe("2026-08-25");
    expect(O.orderDateISO("09/21/26")).toBe("2026-09-21");
    expect(O.orderDateISO("09/07/26")).toBe("2026-09-07");
    for (const bad of ["Print date", "", "13/1/26", "2/40/26", null, undefined, 5]) expect(O.orderDateISO(bad)).toBeNull();
  });
  it("isPrebook reads those dates", () => {
    expect(O.isPrebook("09/21/26", O.seasonOf("2027-03"))).toBe(true);
    expect(O.isPrebook("Print date", O.seasonOf("2027-03"))).toBe(false);
  });
  it("seasonBuys puts unreadable order dates in their own bucket", () => {
    const rows = [
      { month: "2027-03", cat: "400", brand: "A", orderDate: "", dateUnknown: true, po: "p1", amount: 100, units: 1 },
      { month: "2027-03", cat: "400", brand: "A", orderDate: "", dateUnknown: true, po: "p1", amount: 50, units: 1 },
      { month: "2027-03", cat: "400", brand: "A", orderDate: "", po: "p2", amount: 10, units: 1 },
    ];
    const t = O.seasonBuys(rows, O.seasonOf("2027-03"));
    expect(t).toMatchObject({ committed: 160, unknown: 150, unknownOrders: 1, reorders: 10, prebooked: 0 });
    expect(t.byBrand[0].unknown).toBe(150);
  });
});

describe("posDates", () => {
  it("rewrites POS dates like Nov06/26 as Nov 6, 2026 and leaves other text alone", () => {
    expect(O.posDates("Last sold Jul01/23; received again Nov11/26.")).toBe("Last sold Jul 1, 2023; received again Nov 11, 2026.");
    expect(O.posDates("System shows -1 on hand (last sale Nov06/26).")).toBe("System shows -1 on hand (last sale Nov 6, 2026).");
    expect(O.posDates("Shirt 3/4 sleeve, Nov 2026")).toBe("Shirt 3/4 sleeve, Nov 2026");
    expect(O.posDates(null)).toBe("");
  });
});
