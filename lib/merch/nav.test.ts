import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// merchandise/app/src/05-nav.js is plain browser JS joined into the page; it uses no page globals.
const src = readFileSync(path.join(process.cwd(), "merchandise/app/src/05-nav.js"), "utf8");
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
  it("loads in build order without throwing, and a saved 'summary' opens Today", () => {
    const dir = path.join(process.cwd(), "merchandise/app/src");
    const files = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
    expect(files.indexOf("05-nav.js")).toBeLessThan(files.indexOf("10-core.js"));
    const code = files.filter((f) => f <= "10-core.js").map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
    const ctx = { window: {}, __FALLBACK__: { plan: {}, inventory: {}, insights: {} }, localStorage: { getItem: (k: string) => (k === "ob.tab2" ? "summary" : null), setItem() {} } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = vm.runInNewContext(code + ";({TAB})", ctx);
    expect(out.TAB).toBe("today");
  });
});
