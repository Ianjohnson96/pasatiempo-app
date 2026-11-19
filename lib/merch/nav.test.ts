import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// merchandise/app/src/25-nav.js is plain browser JS joined into the page; it uses no page globals.
const src = readFileSync(path.join(process.cwd(), "merchandise/app/src/25-nav.js"), "utf8");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const N: any = vm.runInNewContext(src + ";({NAV,TAB_ALIAS,resolveTab,pageLabel,pageGroup,parseGo})");

describe("merchandise navigation", () => {
  it("routes old page ids to the new pages", () => {
    const want: Record<string, string> = {
      summary: "today", otb: "overview", subcats: "scorecard", rounds: "trends", help: "monthend",
      reports: "monthend", nonsense: "today", "": "today", brands: "brands",
    };
    for (const [from, to] of Object.entries(want)) expect(N.resolveTab(from)).toBe(to);
  });
  it("has the 14 pages in order", () => {
    const ids = N.NAV.flatMap((g: { pages: string[][] }) => g.pages.map((p) => p[0]));
    expect(ids).toEqual(["today", "orders", "receiving", "attention", "vendors", "overview", "seasons", "forecast",
      "scorecard", "brands", "stuck", "trends", "monthend", "inventory"]);
    expect(N.NAV.map((g: { key: string }) => g.key)).toEqual(["daily", "plan", "analyse", "close"]);
  });
  it("labels and groups", () => {
    expect(N.pageLabel("overview")).toBe("Budget & open-to-buy");
    expect(N.pageGroup("receiving")).toBe("daily");
  });
  it("parses data-go", () => {
    expect(N.parseGo("overview:480")).toEqual({ tab: "overview", key: "480" });
    expect(N.parseGo("brands")).toEqual({ tab: "brands", key: null });
  });
});
