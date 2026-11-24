import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// merchandise/app/src/05-nav.js is plain browser JS joined into the page; it uses no page globals.
const src = readFileSync(path.join(process.cwd(), "merchandise/app/src/05-nav.js"), "utf8");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const N: any = vm.runInNewContext(src + ";({NAV,VIEWS,TAB_ALIAS,resolveTab,pageLabel,pageGroup,navParent,sideTarget,parseGo,parseHash})");

describe("merchandise navigation", () => {
  it("routes old page ids to the new pages", () => {
    const want: Record<string, string> = {
      summary: "today", otb: "overview", subcats: "scorecard", rounds: "trends", help: "monthend",
      reports: "monthend", nonsense: "today", "": "today", brands: "brands",
      home: "today", budget: "overview", settings: "guidelines",
    };
    for (const [from, to] of Object.entries(want)) expect(N.resolveTab(from)).toBe(to);
  });
  it("groups pages by phase", () => {
    expect(N.NAV.map((g: { key: string }) => g.key)).toEqual(["buy", "sell", "close"]);
    expect(N.NAV[0].pages.map((p: string[]) => p[1])).toEqual(["Budget", "Orders & receiving", "Season plan"]);
    expect(N.NAV[1].pages.map((p: string[]) => p[1])).toEqual(["Categories", "Brands", "Markdowns"]);
    expect(N.NAV[2].pages.map((p: string[]) => p[1])).toEqual(["Upload & count"]);
  });
  it("every old page id still opens, under its parent", () => {
    const want: [string, string][] = [["receiving", "orders"], ["vendors", "orders"], ["orders", "orders"], ["inventory", "monthend"], ["monthend", "monthend"],
      ["forecast", "settings"], ["guidelines", "settings"], ["attention", "categories"], ["today", "home"], ["overview", "budget"], ["stuck", "stuck"],
      ["seasons", "seasons"], ["scorecard", "categories"], ["trends", "categories"], ["rounds", "categories"], ["subcats", "categories"], ["brands", "brands"]];
    for (const [id, parent] of want) expect(N.navParent(N.resolveTab(id))).toBe(parent);
    expect(N.resolveTab("receiving")).toBe("receiving");
    expect(N.parseGo("orders:po27-x")).toEqual({ tab: "orders", key: "po27-x" });
  });
  it("labels, groups and views", () => {
    expect(N.pageLabel("overview")).toBe("Budget");
    expect(N.pageLabel("receiving")).toBe("Receiving");
    expect(N.pageLabel("today")).toBe("Home");
    expect(N.pageGroup("receiving")).toBe("buy");
    expect(N.pageGroup("inventory")).toBe("close");
    expect(N.VIEWS.orders.map((v: string[]) => v[0])).toEqual(["receiving", "orders", "vendors"]);
    // the sidebar entry opens on Receiving; #orders still opens the Orders view
    expect(N.sideTarget("orders")).toBe("receiving");
    expect(N.sideTarget("budget")).toBe("budget");
    expect(N.resolveTab("orders")).toBe("orders");
    expect(N.VIEWS.settings.map((v: string[]) => v[1])).toEqual(["Guidelines", "Forecast"]);
  });
  it("parses data-go", () => {
    expect(N.parseGo("overview:480")).toEqual({ tab: "overview", key: "480" });
    expect(N.parseGo("brands")).toEqual({ tab: "brands", key: null });
  });
  it("loads in build order without throwing, and opens the page in the address (#id; old ids routed; none = Today)", () => {
    const dir = path.join(process.cwd(), "merchandise/app/src");
    const files = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
    expect(files.indexOf("05-nav.js")).toBeLessThan(files.indexOf("10-core.js"));
    const code = files.filter((f) => f <= "10-core.js").map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
    const tabFor = (hash: string) => {
      const ctx = { window: {}, location: { hash }, __FALLBACK__: { plan: {}, inventory: {}, insights: {} }, localStorage: { getItem: () => null, setItem() {} } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (vm.runInNewContext(code + ";({TAB})", ctx) as any).TAB;
    };
    expect(tabFor("#orders")).toBe("orders");
    expect(tabFor("#summary")).toBe("today");
    expect(tabFor("#reports")).toBe("monthend");
    expect(tabFor("")).toBe("today");
  });
});

describe("guidelines page", () => {
  it("is a view of Settings, in the sidebar foot", () => {
    expect(N.resolveTab("guidelines")).toBe("guidelines");
    expect(N.pageLabel("guidelines")).toBe("Guidelines");
    expect(N.pageGroup("guidelines")).toBe("foot");
    expect(N.navParent("guidelines")).toBe("settings");
  });
});

describe("categories", () => {
  it("is a sidebar entry with All categories, Actions and Trends & rounds, and a page per category", () => {
    expect(N.VIEWS.categories).toEqual([["scorecard", "All categories"], ["actions", "Actions"], ["trends", "Trends & rounds"]]);
    expect(N.sideTarget("categories")).toBe("scorecard");
    expect(N.resolveTab("categories")).toBe("scorecard");
    for (const id of ["category", "actions", "scorecard", "trends"]) expect(N.navParent(id)).toBe("categories");
    expect(N.resolveTab("attention")).toBe("actions");
    expect(N.resolveTab("category")).toBe("category");
  });
  it("reads a page and its key from the address", () => {
    expect(N.parseHash("#category:620")).toEqual(["category", "620"]);
    expect(N.parseHash("#orders:v-fj")).toEqual(["orders", "v-fj"]);
    expect(N.parseHash("#bogus")).toEqual(["today", null]);
    expect(N.parseHash("#attention")).toEqual(["actions", null]);
    expect(N.parseHash("")).toEqual(["today", null]);
    expect(N.parseHash("#category%3A620")).toEqual(["category", "620"]);
  });
});
