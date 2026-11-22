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
});
