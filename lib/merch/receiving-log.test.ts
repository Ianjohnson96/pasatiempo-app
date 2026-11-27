import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brandOf, parseLog, VENDOR_WORDS_DEFAULT } from "./receiving-log";

const fx = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/receiving-log.json"), "utf8"));
const read = (since: string, tabs = fx.tabs) => parseLog(tabs, { since, words: VENDOR_WORDS_DEFAULT });

describe("reading the receiving log", () => {
  it("reads every year tab by its headers and the Credits tab", () => {
    expect(new Set(read("2026-01-01").rows.map((r) => r.tab))).toEqual(new Set(["SHEET 4 1/1-12-31/2026", "Credits"]));
  });
  it("carries the date down and reads prices and credits", () => {
    const { rows } = read("2026-01-01");
    const r = rows.find((x) => x.invoice === "211")!;
    expect(r.date).toBe("2026-01-02");
    expect(r.amount).toBe(1891.62);
    expect(rows.find((x) => x.invoice === "9000724742")!.date).toBe("2026-11-12");   // M/D/YY
    const c = rows.find((x) => x.invoice === "555")!;
    expect(c.credit).toBe(true);
    expect(c.amount).toBe(-48);
  });
  it("keeps only rows on or after since", () => {
    const { rows } = read("2026-11-01");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.date >= "2026-11-01")).toBe(true);
  });
  it("lists unreadable rows as problems and reads the rest", () => {
    const { rows, problems } = read("2026-01-01");
    expect(problems.some((p) => /SHEET 4.*row 13: no price/.test(p))).toBe(true);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.some((r) => r.invoice === "512 Corp Crd")).toBe(true);
  });
  it("a date far behind the rows before it is listed as a problem, not dropped silently", () => {
    // the real 2026 tab has a 2/26/2025 between January and March 2026 rows: two arrivals a typo would hide
    const { problems } = read("2026-01-01");
    expect(problems.filter((p) => /looks wrong/.test(p)).length).toBe(2);
    expect(problems.some((p) => /row 7: the date 2\/26\/2025 looks wrong/.test(p))).toBe(true);
  });
  it("an exact repeat gets its own key; keys don't depend on row position", () => {
    const a = read("2026-01-01").rows;
    expect(new Set(a.map((r) => r.key)).size).toBe(a.length);
    const shifted = JSON.parse(JSON.stringify(fx.tabs));
    shifted[1].values.splice(1, 0, ["", "", "", ""]);
    expect(read("2026-01-01", shifted).rows.map((r) => r.key)).toEqual(a.map((r) => r.key));
  });
  it("finds the brand by its words and special orders by a name in brackets", () => {
    expect(brandOf("Shirts/Sweaters FJ Mens Stock", VENDOR_WORDS_DEFAULT)).toBe("footjoy");
    expect(brandOf("T-Shirts/Backpack H&B Mens Stock", VENDOR_WORDS_DEFAULT)).toBe("holderness & bourne");
    expect(brandOf("Hats Melin Mens Stock", VENDOR_WORDS_DEFAULT)).toBeNull();
    expect(brandOf("Fjord jacket", VENDOR_WORDS_DEFAULT)).toBeNull();   // whole words only
    const { rows } = read("2026-01-01");
    expect(rows.find((r) => r.invoice === "9000724742")!.special).toBe(true);
    expect(rows.find((r) => r.invoice === "211")!.special).toBe(false);
  });
  it("renaming a tab keeps every row's key", () => {
    const a = read("2026-01-01").rows;
    const renamed = JSON.parse(JSON.stringify(fx.tabs));
    renamed[1].title = "SHEET 4 1/1-12/31/2026";
    const b = read("2026-01-01", renamed).rows;
    expect(b.map((r) => r.key)).toEqual(a.map((r) => r.key));
  });
  it("a date typed well after today is a problem and doesn't hide the rows after it", () => {
    const tabs = [{ title: "SHEET 4", values: [fx.tabs[1].values[0], ["3/2/2026", "Hats Imperial Mens Stock", "1", "$10.00"], ["11/3/2026", "Hats Imperial Mens Stock", "2", "$20.00"], ["3/4/2026", "Hats Imperial Mens Stock", "3", "$30.00"]] }];
    const { rows, problems } = parseLog(tabs, { since: "2026-01-01", words: VENDOR_WORDS_DEFAULT, today: "2026-03-05" });
    expect(rows.map((r) => r.invoice)).toEqual(["1", "3"]);
    expect(problems.some((p) => /row 3: the date 11\/3\/2026 looks wrong/.test(p))).toBe(true);
  });
  it("says how many tabs had the log's layout, so a renamed heading can be reported", () => {
    expect(parseLog(fx.tabs, { since: "2026-01-01", words: VENDOR_WORDS_DEFAULT }).tabsRead).toBe(4);
    const broken = JSON.parse(JSON.stringify(fx.tabs));
    for (const tb of broken) if (tb.values[0]) tb.values[0] = tb.values[0].map((h: string) => (h === "PRICE" ? "AMOUNT" : h));
    expect(parseLog(broken, { since: "2026-01-01", words: VENDOR_WORDS_DEFAULT }).tabsRead).toBe(0);
  });
  it("lists only problems in rows from the go-live date on; older rows don't matter", () => {
    // since = Nov 1: the 2026-02-26-ish typo rows, the January rows and the earlier tabs are before it
    const { problems } = read("2026-11-01");
    expect(problems).toEqual(["SHEET 4 1/1-12-31/2026 row 13: no price"]);
  });
});

describe("columns the team may add to the log", () => {
  const H = ["REC. DATE", "ITEM DESCRIPTION", "INVOICE #", "PRICE"];
  const tab = (title: string, header: string[], rows: string[][]) => ({ title, values: [header, ...rows] });
  it("reads PO #, Vendor and Type when present, in any position", () => {
    const { rows } = parseLog([tab("2027", ["PO #", ...H, "Vendor", "Type"], [["4471", "11/20/2026", "Shirts Mens Stock", "88", "$500.00", "Foot Joy", "Reorder"]])],
      { since: "2026-11-01", words: { ...VENDOR_WORDS_DEFAULT, footjoy: ["fj", "footjoy", "foot joy"] } });
    expect(rows[0]).toMatchObject({ po: "4471", vendor: "Foot Joy", type: "reorder", brand: "footjoy", amount: 500 });
  });
  it("prefers the Vendor column over words in the description, and marks a Special type as a special order", () => {
    const { rows } = parseLog([tab("2027", [...H, "VENDOR", "TYPE"], [["11/20/2026", "FJ hats", "1", "10", "Garb", "Special order"]])], { since: "2026-11-01", words: VENDOR_WORDS_DEFAULT });
    expect(rows[0]).toMatchObject({ brand: "garb", special: true, type: "special order" });
  });
  it("reads the original invoice a credit is against", () => {
    const { rows } = parseLog([tab("Credits", [...H, "Orig. Invoice #"], [["11/20/2026", "FJ return", "C9", "48", "211"]])], { since: "2026-11-01", words: VENDOR_WORDS_DEFAULT });
    expect(rows[0]).toMatchObject({ credit: true, amount: -48, origInvoice: "211" });
  });
  it("adding the new columns to an existing row doesn't change its key, so matches already made hold", () => {
    const before = parseLog([tab("2026", H, [["11/20/2026", "FJ Mens Stock", "88", "500"]])], { since: "2026-11-01", words: VENDOR_WORDS_DEFAULT }).rows[0];
    const after = parseLog([tab("2026", ["PO #", ...H, "Vendor"], [["4471", "11/20/2026", "FJ Mens Stock", "88", "500", "FootJoy"]])], { since: "2026-11-01", words: VENDOR_WORDS_DEFAULT }).rows[0];
    expect(after.key).toBe(before.key);
  });
  it("a date on every row reads the same as a carried-down date", () => {
    const { rows } = parseLog([tab("2026", H, [["11/20/2026", "FJ a", "1", "10"], ["11/20/2026", "FJ b", "2", "20"]])], { since: "2026-11-01", words: VENDOR_WORDS_DEFAULT });
    expect(rows.map((r) => r.date)).toEqual(["2026-11-20", "2026-11-20"]);
  });
  it("without the new columns, rows carry no po, vendor or type", () => {
    const { rows } = parseLog([tab("2026", H, [["11/20/2026", "FJ a", "1", "10"]])], { since: "2026-11-01", words: VENDOR_WORDS_DEFAULT });
    expect(rows[0].po).toBeUndefined();
    expect(rows[0].vendor).toBeUndefined();
  });
});
