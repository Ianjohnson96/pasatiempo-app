import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

// Orders view: each order's arrival bar (in Jonas, in the store room, still to come) and its timeline.
const base = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));
const docs = { ...base, vendors: [{ id: "v-fj", name: "FootJoy" }],
  pos: [{ id: "fj", poNumber: "4471", status: "partial", cat: "620", vendorId: "v-fj", deliveryMonth: "2026-10", orderDate: "2026-08-03", cost: 2000, received: 500, lines: [],
    invoicesIn: [{ date: "2026-11-02", amount: 135.55, invoice: "282759", source: "log", logKey: "k1", at: "2026-11-02T00:00:00Z", rcvd: 500 }] }] };
const page = () => { const R = loadPage(docs); R(`VENDORS = __docs.vendors; globalThis.fillPeople = () => {}`); return R; };

describe("an order's arrival", () => {
  it("splits the order into in Jonas, in the store room and still to come, to the cent", () => {
    const R = page();
    expect(R(`arrivalSplit(POS[0])`)).toEqual({ total: 2000, inJonas: 500, storeRoom: 135.55, toCome: 1364.45 });
  });
  it("the Orders list shows a bar for it with the amounts on hover", () => {
    const R = page();
    const html = R(`(renderOrders(stats()), document.__html)`) as string;
    expect(html).toMatch(/class="abar"[^>]*title="In Jonas \$500\.00 · in the store room \$135\.55 · still to come \$1,364\.45"/);
  });
  it("the order's timeline: placed, due, each arrival with its invoice, and what Jonas has", () => {
    const R = page();
    const html = R(`arrivalTimelineHtml(POS[0])`) as string;
    expect(html).toMatch(/Placed[^<]*<\/b>\s*<span[^>]*>Aug 3/);
    expect(html).toMatch(/Due/);
    expect(html).toMatch(/\$135\.55/);
    expect(html).toMatch(/invoice 282759/);
    expect(html).toMatch(/late/i);   // first arrival after the delivery month
    expect(html).toMatch(/In Jonas/);
  });
  it("a cancelled order or one with no cost gets no bar", () => {
    const R = page();
    R(`POS[0].status = 'cancelled'`);
    expect(R(`arrivalBarHtml(POS[0])`)).toBe("");
  });
});
