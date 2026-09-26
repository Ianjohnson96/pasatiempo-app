// Access rules for the merchandise program's documents. The browser page
// reads and writes JSON documents by path (pos/{id}, base/current, …); every
// request is checked here on the server before it touches merch.docs.

export type MerchRole = "owner" | "staff" | "viewer";

// Collections only the owner may change: the forecast and budgets (plan/…,
// including budget changes and saved assumptions), month-end data, and brand
// calls. Staff can change everything else (orders, vendors, counts, …).
const OWNER_ONLY = new Set([
  "plan",
  "inventory",
  "insights",
  "base",
  "brands",
  "brandCalls",
  "refreshes",
  "skuhist",
]);

// Collections a month-end data file may replace. Everything people enter by
// hand (orders, vendors, counts, budget changes, brand calls) is left alone.
export const IMPORTABLE = new Set(["base", "inventory", "insights", "brands", "refreshes", "skuhist"]);

// Collections the page never needs; kept out of the initial load.
export const NOT_LOADED = new Set(["skuhist"]);

const SEGMENT = /^[A-Za-z0-9_.~:@+-]{1,200}$/;

/** A document path: collection/doc[/collection/doc…], at most 16 segments. */
export function isDocPath(path: string): boolean {
  const parts = path.split("/");
  return (
    path.length <= 1000 &&
    parts.length % 2 === 0 &&
    parts.length <= 16 &&
    parts.every((p) => SEGMENT.test(p) && p !== "." && p !== "..")
  );
}

export function topCollection(path: string): string {
  return path.split("/")[0];
}

export function canWrite(role: MerchRole, path: string): boolean {
  if (role === "owner") return true;
  if (role === "staff") return !OWNER_ONLY.has(topCollection(path));
  return false;
}

/** Largest document accepted, in bytes of JSON. */
export const MAX_DOC_BYTES = 256 * 1024;
