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
  "remindersSent",
  "skusnap",
  "arrivals",
  "brandskus",
  "brandin",
  "assort",
]);

// Collections a month-end data file may replace. Everything people enter by
// hand (orders, vendors, counts, budget changes, brand calls) is left alone.
// skusnap/current is each refresh's stock by SKU; arrivals/{asOf} is what came in since the last one
// (merchandise/pipeline/receipts.py).
// brandskus/current lists every SKU for assigning brands; the assignments themselves
// (brandmap/current) are entered in the program and never come from a data file.
// brandin/current holds what Brands -> Update brands needs to rebuild the scorecard between uploads.
// assort/current is the subcategory report; which subcategory a SKU belongs to (submap/current) is set in the program.
export const IMPORTABLE = new Set(["base", "inventory", "insights", "brands", "refreshes", "skuhist", "skusnap", "arrivals", "brandskus", "brandin", "assort"]);

// Collections the page never needs; kept out of the initial load.
// remindersSent/{date} marks a day's reminder email as sent (app/api/cron/merch).
export const NOT_LOADED = new Set(["skuhist", "remindersSent", "skusnap", "brandin"]);

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

// Collections staff may change, named one by one: orders, vendors, subcategories, counts, To do states, checklist
// ticks, brand assignments (Brands -> Assign brands) and subcategory sorting. Anything new is owner-only until it is
// added here.
const STAFF_WRITABLE = new Set(["pos", "vendors", "subcats", "counts", "istate", "checklist", "brandmap", "submap"]);

export function canWrite(role: MerchRole, path: string): boolean {
  if (role === "owner") return true;
  const c = topCollection(path);
  if (role === "staff") return STAFF_WRITABLE.has(c) && !OWNER_ONLY.has(c);
  return false;
}

/** Largest document accepted, in bytes of JSON (UTF-8). */
export const MAX_DOC_BYTES = 256 * 1024;
export const docBytes = (data: unknown) => Buffer.byteLength(JSON.stringify(data), "utf8");

const ORDER_STATUS = new Set(["open", "hold", "partial", "received", "cancelled"]);
const isNum = (v: unknown) => v == null || v === "" || (typeof v !== "boolean" && Number.isFinite(Number(v)));
const isMonth = (v: unknown) => v == null || v === "" || (typeof v === "string" && /^\d{4}-\d{2}$/.test(v));
const isDate = (v: unknown) => v == null || v === "" || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v));

/** Why a document can't be saved, or null when it's fine. Checks the fields every viewer's page does arithmetic or
    date maths on, so one malformed record can't break the page for everyone. */
export function docProblem(path: string, data: unknown): string | null {
  if (data === null) return null;
  const d = data as Record<string, unknown>;
  switch (topCollection(path)) {
    case "pos": {
      if (d.status != null && !ORDER_STATUS.has(String(d.status))) return "unknown order status";
      for (const k of ["cost", "units", "received"]) if (!isNum(d[k])) return `${k} must be a number`;
      if (!isMonth(d.deliveryMonth)) return "deliveryMonth must be YYYY-MM";
      for (const k of ["cancelDate", "receivedDate"]) if (!isDate(d[k])) return `${k} must be a date`;
      if (d.invoicesIn != null) {
        if (!Array.isArray(d.invoicesIn)) return "invoicesIn must be a list";
        for (const e of d.invoicesIn as unknown[]) {
          if (e == null || typeof e !== "object" || Array.isArray(e)) return "each invoicesIn entry must be an object";
          const entry = e as Record<string, unknown>;
          if (typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(entry.date)) return "invoicesIn date must be a date";
          if (!isNum(entry.amount)) return "invoicesIn amount must be a number";
          if (entry.source != null && entry.source !== "hand" && entry.source !== "log") return "invoicesIn source must be hand or log";
        }
      }
      if (d.invoicesClearedAt != null && typeof d.invoicesClearedAt !== "string") return "invoicesClearedAt must be a string";
      if (d.lines != null) {
        if (!Array.isArray(d.lines)) return "lines must be a list";
        for (const l of d.lines as unknown[]) {
          if (l == null || typeof l !== "object" || Array.isArray(l)) return "each line must be an object";
          const line = l as Record<string, unknown>;
          for (const k of ["cost", "units"]) if (!isNum(line[k])) return `line ${k} must be a number`;
        }
      }
      return null;
    }
    case "plan":
      if (path.includes("/adjustments/") && !isNum(d.amount)) return "amount must be a number";
      return null;
    case "brandmap":
    case "submap":
      if (d.skus != null && (typeof d.skus !== "object" || Array.isArray(d.skus))) return "skus must be an object";
      return null;
    default:
      return null;
  }
}
