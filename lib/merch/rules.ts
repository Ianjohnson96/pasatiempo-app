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
  "guidelines",
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
// logmatch/{log row key}: a person's call on a receiving log row (matched to an order, or not an order).
const STAFF_WRITABLE = new Set(["pos", "vendors", "subcats", "counts", "istate", "checklist", "brandmap", "submap", "logmatch"]);
// Written only by the server: receivinglog/current is the app's read-only copy of the receiving log
// (lib/merch/receiving-log-server.ts); nobody changes it through the page, the owner included.
const SERVER_ONLY = new Set(["receivinglog"]);

export function canWrite(role: MerchRole, path: string): boolean {
  if (SERVER_ONLY.has(topCollection(path))) return false;
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
    case "logmatch": {
      if (d.state !== "matched" && d.state !== "notorder") return "state must be matched or notorder";
      if (d.state === "matched") {
        if (typeof d.po !== "string" || !d.po) return "a match needs the order it belongs to";
        if (d.amount == null || !isNum(d.amount)) return "amount must be a number";
        if (typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return "date must be YYYY-MM-DD";
      }
      return null;
    }
    case "pos": {
      if (d.status != null && !ORDER_STATUS.has(String(d.status))) return "unknown order status";
      for (const k of ["cost", "units", "received"]) if (!isNum(d[k])) return `${k} must be a number`;
      if (!isMonth(d.deliveryMonth)) return "deliveryMonth must be YYYY-MM";
      if (!isDate(d.orderDate)) return "orderDate must be YYYY-MM-DD";
      for (const k of ["cancelDate", "receivedDate"]) if (!isDate(d[k])) return `${k} must be a date`;
      if (d.invoicesIn != null) {
        if (!Array.isArray(d.invoicesIn)) return "invoicesIn must be a list";
        for (const e of d.invoicesIn as unknown[]) {
          if (e == null || typeof e !== "object" || Array.isArray(e)) return "each invoicesIn entry must be an object";
          const entry = e as Record<string, unknown>;
          if (typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(entry.date)) return "invoicesIn date must be a date";
          if (!isNum(entry.amount)) return "invoicesIn amount must be a number";
          if (!isNum(entry.rcvd)) return "invoicesIn rcvd must be a number";
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
    case "guidelines":
      return guidelinesProblem(d);
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

const ROLE_KEYS = new Set(["fashion", "impulse", "consumable", "hardgoods", "demo"]);
const isObj = (v: unknown): v is Record<string, unknown> => v != null && typeof v === "object" && !Array.isArray(v);
const numIn = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
// The bench numbers the Guidelines page may save and the range each must fall in (17-metrics.js BENCH_LIMITS).
const BENCH_LIMITS: Record<string, Record<string, [number, number]>> = {
  agedPct: { good: [0, 0.9], near: [0, 0.9] }, md: { good: [0, 0.9], near: [0, 0.9] },
  wks: { lo: [1, 104], hi: [1, 104], nearLo: [1, 104], nearHi: [1, 104] },
  gmroi: { apparel: [0, 20], accessories: [0, 20], equipment: [0, 20], near: [0, 1] },
  turns: { apparel: [0, 52], accessories: [0, 52], equipment: [0, 52], fast: [0, 52], near: [0, 1] },
  gm: { apparel: [0, 0.9], accessories: [0, 0.9], equipment: [0, 0.9], near: [0, 0.5] },
};

/** guidelines/current: the owner's rules of thumb (the Guidelines page). Every value the page grades by must be a
    number in its range, so a bad save can't turn the Scorecard into NaN for everyone. */
function guidelinesProblem(d: Record<string, unknown>): string | null {
  if (d.bench != null) {
    if (!isObj(d.bench)) return "bench must be an object";
    for (const [m, keys] of Object.entries(d.bench)) {
      const lim = BENCH_LIMITS[m];
      if (!lim || !isObj(keys)) return `bench ${m} is not a guideline`;
      for (const [k, v] of Object.entries(keys)) if (!lim[k] || !numIn(v, lim[k][0], lim[k][1])) return `bench ${m}.${k} is out of range`;
    }
  }
  if (d.roles != null) {
    if (!isObj(d.roles)) return "roles must be an object";
    for (const [r, v] of Object.entries(d.roles)) {
      if (!ROLE_KEYS.has(r) || !isObj(v)) return `${r} is not a role`;
      const w = v.wks;
      if (w != null && !(Array.isArray(w) && w.length === 4 && w.every((x) => numIn(x, 1, 104)) && w[2] <= w[0] && w[0] <= w[1] && w[1] <= w[3]))
        return `${r} weeks of supply must be four numbers 1-104 in order`;
      if (v.over != null && !numIn(v.over, 1, 104)) return `${r} weeks of supply for too much stock must be 1-104`;
    }
  }
  if (d.roleOf != null) {
    if (!isObj(d.roleOf)) return "roleOf must be an object";
    for (const [c, r] of Object.entries(d.roleOf)) if (!/^\d{3}$/.test(c) || c === "640" || !ROLE_KEYS.has(String(r))) return `${c}: unknown role`;
  }
  if (d.memberDiscount != null && !numIn(d.memberDiscount, 0, 0.9)) return "memberDiscount must be between 0 and 0.9";
  if (d.seasons != null) {
    const s = d.seasons as Record<string, unknown>;
    const ok = isObj(s) && s.spring === 1 && [s.summer, s.fall, s.holiday].every(Number.isInteger)
      && 1 < (s.summer as number) && (s.summer as number) < (s.fall as number) && (s.fall as number) < (s.holiday as number) && (s.holiday as number) <= 12;
    if (!ok) return "seasons must start in January and stay in calendar order";
  }
  if (d.mix != null) {
    if (!isObj(d.mix)) return "mix must be an object";
    if (d.mix.total != null && !numIn(d.mix.total, 1, 1e9)) return "mix total must be a positive amount";
    if (d.mix.follow != null && d.mix.follow !== "suggested") return "mix follow must be 'suggested' or left out";
    if (d.mix.ranges != null) {
      if (!isObj(d.mix.ranges)) return "mix ranges must be an object";
      for (const [r, x] of Object.entries(d.mix.ranges))
        if (!ROLE_KEYS.has(r) || !Array.isArray(x) || x.length !== 2 || !numIn(x[0], 0, 100) || !numIn(x[1], 0, 100) || x[0] > x[1])
          return `${r} mix range must be two percentages, low to high`;
    }
  }
  if (d.history != null) {
    if (!Array.isArray(d.history) || d.history.length > 200) return "history must be a list of at most 200 changes";
    for (const e of d.history) if (!isObj(e) || typeof e.at !== "string" || typeof e.what !== "string") return "each history entry needs at and what";
  }
  return null;
}
