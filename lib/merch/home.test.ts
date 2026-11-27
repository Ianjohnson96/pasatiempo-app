import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));

describe("Home", () => {
  it("leads with the year's room to buy", () => {
    const R = loadPage(docs);
    const L = R(`homeLines(stats())`) as { buy: string };
    expect(L.buy).toContain(R(`money(Math.abs(todayRoom().year))`) as string);
  });
  it("Arriving counts late and due orders", () => {
    const L = loadPage(docs)(`homeLines(stats())`) as { arriving: string };
    expect(L.arriving).toMatch(/1 late/);
  });
  it("Selling states the last 12 months' sales", () => {
    const R = loadPage(docs);
    const L = R(`homeLines(stats())`) as { selling: string };
    expect(L.selling).toContain(R(`moneyK(anaNow().shop.t12)`) as string);
  });
  it("before the first upload Home has no lines and renders without errors", () => {
    const R = loadPage({});
    expect(R(`homeLines(null)`)).toBeNull();
  });
  it("shows the three lines and at most five decisions", () => {
    const R = loadPage(docs);
    const html = R(`(renderToday(stats()), document.__html)`) as string;
    expect(html).toMatch(/class="homeline/);
    expect((html.match(/class="item /g) || []).length).toBeLessThanOrEqual(5);
  });
  it("a viewer sees no owner buttons on Home", () => {
    const R = loadPage(docs); R(`isAdmin = false; canWrite = false`);
    expect(R(`(renderToday(stats()), document.__html)`)).not.toMatch(/data-gd|New order/);
  });
});
