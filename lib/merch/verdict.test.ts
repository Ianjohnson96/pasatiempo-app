import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));
const IDS = ["today", "overview", "orders", "receiving", "vendors", "seasons", "scorecard", "trends", "brands", "stuck", "monthend", "inventory", "guidelines", "forecast", "actions", "category"];

describe("page verdicts", () => {
  it("Budget's verdict states the year's Left to buy", () => {
    const R = loadPage(docs);
    const v = R(`PAGE_VERDICT.overview(stats())`) as { tone: string; text: string };
    // over budget reads as the amount over (no minus sign); room reads as the amount left
    expect(v.text).toContain(R(`money(Math.abs(leftToBuyWith(assumptions())))`) as string);
    expect(["ok", "watch", "act"]).toContain(v.tone);
  });
  it("Orders' verdict counts late orders and asks to act", () => {
    const v = loadPage(docs)(`PAGE_VERDICT.orders(stats())`) as { tone: string; text: string };
    expect(v.text).toMatch(/1 late/);
    expect(v.tone).toBe("act");
  });
  it("Upload & close names the date of the latest Jonas data", () => {
    const v = loadPage(docs)(`PAGE_VERDICT.monthend(stats())`) as { text: string };
    expect(v.text).toMatch(/Nov 15, 2026/);
  });
  it("every page has a verdict that renders, with data and before the first upload", () => {
    // before the first upload the page renders the sidebar with no stats (render() in 90-io.js), so S is null
    for (const [d, s] of [[docs, "stats()"], [{}, "null"]] as [object, string][]) {
      const R = loadPage(d);
      for (const id of IDS) {
        expect(R(`typeof PAGE_VERDICT.${id}`)).toBe("function");
        const html = R(`verdictHtml(PAGE_VERDICT.${id}(${s}))`) as string;
        expect(typeof html).toBe("string");
      }
    }
  });
  it("a verdict's text is escaped", () => {
    expect(loadPage(docs)(`verdictHtml({tone: 'ok', text: '<b>x</b>'})`)).not.toContain("<b>x</b>");
  });
});
