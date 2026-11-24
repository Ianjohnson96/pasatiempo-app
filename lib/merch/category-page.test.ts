import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPage } from "./page-harness";

// Stage 3: the page per category (36-category.js) and how it is reached.
const docs = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/page-docs.json"), "utf8"));
const page = (d: object = docs) => { const R = loadPage(d); R(`globalThis.fillPeople = () => {}`); return R; };

describe("reaching a category's page", () => {
  it("knows the category codes in the plan or the analysis, and nothing else", () => {
    const R = page();
    expect(R(`catPageTarget('620')`)).toBe("620");
    expect(R(`catPageTarget('999')`)).toBeNull();
    expect(R(`catPageTarget(null)`)).toBeNull();
  });
});
