import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));

describe("weeks of supply for a category", () => {
  it("a category's planned month-end stock reads as its target weeks", () => {
    const R = loadPage(docs);
    const got = R(`otbCats().map(c => [catWeeks(c, ENG.cats[c][0].eom), assumptions().wos[c] * ENG.scale])`) as [number, number][];
    expect(got.length).toBeGreaterThan(0);
    for (const [w, want] of got) expect(w).toBeCloseTo(want, 6);
  });
  it("no forecast sales ahead gives no weeks, never Infinity", () => {
    const d = JSON.parse(JSON.stringify(docs));
    d.base.cats["200"].hist = {}; d.base.cats["200"].act = {};
    const R = loadPage(d);
    expect(R(`catWeeks("200", 10000)`)).toBeNull();
    expect(R(`catWeeks("zzz", 10000)`)).toBeNull();
  });
  it("the Scorecard's category weeks use the same forward pace; subcategories keep last year's", () => {
    const R = loadPage(docs);
    const got = R(`(() => { const a = anaNow(); return a.cats.map(c => [c.wks, catWeeks(c.cat, c.oh), c.wksLY, c.subs[0].wks]); })()`) as number[][];
    for (const [wks, fwd, ly, sub] of got) {
      expect(wks).toBeCloseTo(fwd, 6);
      expect(ly).not.toBeCloseTo(fwd, 1);
      expect(sub).toBeGreaterThan(0);
    }
  });
});
