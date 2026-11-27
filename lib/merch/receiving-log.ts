import { createHash } from "node:crypto";

// The receiving log: the Google Sheet the people who pay invoices keep (one tab per year, plus Credits). This reads
// its layout into rows the Orders & receiving page matches against orders. Pure: no network, no database
// (lib/merch/receiving-log-server.ts reads the sheet and stores the result). Spec:
// docs/superpowers/specs/2026-11-22-merch-phase2-design.md, stage 2.

export interface LogRow {
  key: string;
  tab: string;
  date: string; // YYYY-MM-DD
  desc: string;
  invoice: string;
  amount: number; // at cost; a credit is negative
  credit: boolean;
  brand: string | null; // a vendor key from the word list
  special: boolean; // a customer's name in brackets (or a Type of "special"): a special order
  // Optional columns the team may add (docs/merch-receiving-log-setup.md); absent when the tab has no such column or
  // the cell is blank.
  po?: string; // PO #: the order the delivery is against, matched exactly
  vendor?: string; // Vendor: the vendor as written, read before the description's words
  type?: string; // Type, lower case: "stock", "reorder", "special"...
  origInvoice?: string; // on a credit: the invoice it is against
}

export interface SheetTab {
  title: string;
  values: string[][];
}

// Words the log uses for each vendor (lower case). The page adds each vendor's own name; the owner can add more in
// Settings (guidelines/current.vendorWords). FootJoy is always "FJ" in the log; Holderness & Bourne is "H&B".
export const VENDOR_WORDS_DEFAULT: Record<string, string[]> = {
  footjoy: ["fj", "footjoy"],
  "holderness & bourne": ["h&b", "holderness"],
  "peter millar": ["peter millar"],
  "ralph lauren": ["rlx", "ralph lauren"],
  adidas: ["adidas"],
  taylormade: ["taylormade", "taylor made"],
  imperial: ["imperial"],
  "johnnie-o": ["johnnie-o", "johnnie o"],
  sunice: ["sunice"],
  "sun mountain": ["sun mountain"],
  garb: ["garb"],
  kastel: ["kastel"],
};

const norm = (s: unknown) => String(s ?? "").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The vendor key whose word appears in the description as a whole word (any case); the longest word wins. */
export function brandOf(desc: string, words: Record<string, string[]>): string | null {
  const d = " " + desc.toLowerCase() + " ";
  let best: [string, number] | null = null;
  for (const [key, ws] of Object.entries(words)) {
    for (const w of ws) {
      const word = w.toLowerCase().trim();
      if (!word) continue;
      // a word is bounded by anything but a letter or digit ("H&B" inside "T-Shirts/Backpack H&B Mens")
      if (new RegExp(`(^|[^a-z0-9])${escapeRe(word)}($|[^a-z0-9])`).test(d) && (!best || word.length > best[1])) best = [key, word.length];
    }
  }
  return best ? best[0] : null;
}

/** A row's identity: credit or not, its date, invoice, amount to the cent, description and a counter for exact
    repeats. Never the row's position (rows get inserted) or its tab's name (a tab can be renamed). */
export function rowKey(kind: "row" | "credit", date: string, invoice: string, amount: number, desc: string, n: number): string {
  return createHash("sha1").update([kind, date, invoice, Math.round(amount * 100), desc.toLowerCase(), n].join("\u0001")).digest("hex").slice(0, 16);
}

/** M/D/YYYY or M/D/YY (or YYYY-MM-DD) → YYYY-MM-DD; null if unreadable. */
function readDate(s: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  const mo = +m[1], d = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const daysBetween = (a: string, b: string) => (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5;

/** "$1,891.62", "-$48.00", "($48.00)", "1891.62" → number; null if unreadable or blank. */
function readPrice(s: string): number | null {
  const t = s.replace(/[\s$,]/g, "");
  if (!t) return null;
  const neg = /^-|^\(.*\)$/.test(t);
  const v = Number(t.replace(/^-|[()]/g, ""));
  return Number.isFinite(v) ? Math.round((neg ? -v : v) * 100) / 100 : null;
}

/** Which column holds what, from a tab's first row; null when it isn't laid out like the receiving log. */
interface Cols { date: number; desc: number; invoice: number; price: number; po: number; vendor: number; type: number; orig: number }
function columns(header: string[]): Cols | null {
  const h = header.map((x) => norm(x).toLowerCase().replace(/\s+/g, " "));
  const find = (f: (s: string) => boolean) => h.findIndex(f);
  const need = {
    date: find((s) => /^(rec\.? ?)?date$/.test(s)),
    desc: find((s) => /^item desc?ription$|^item decription$/.test(s)),
    invoice: find((s) => /^invoice ?#?$/.test(s)),
    price: find((s) => s === "price"),
  };
  if (!Object.values(need).every((i) => i >= 0)) return null;
  // optional, -1 when missing
  return { ...need,
    po: find((s) => /^p\.?o\.? ?(#|no\.?|number)?$/.test(s)),
    vendor: find((s) => /^vendor( name)?$/.test(s)),
    type: find((s) => /^(type|order type)$/.test(s)),
    orig: find((s) => /^orig(inal|\.)? ?invoice ?#?$/.test(s)) };
}

/** The log's rows dated on or after `since`, from every tab laid out like it (found by headers, not tab names), with
    the Credits tab's as credits. A row with a description but no readable date or price is listed in `problems`;
    the rest are still read. */
export function parseLog(tabs: SheetTab[], opts: { since: string; words: Record<string, string[]>; today?: string }): { rows: LogRow[]; problems: string[]; tabsRead: number } {
  const rows: LogRow[] = [], problems: string[] = [];
  let tabsRead = 0;
  for (const tab of tabs) {
    const values = tab.values || [];
    const cols = values.length ? columns(values[0]) : null;
    if (!cols) continue;
    tabsRead++;
    const credit = /credit/i.test(tab.title);
    const seen = new Map<string, number>();
    let date: string | null = null, shown = "", latest = "";
    values.slice(1).forEach((r, i) => {
      const cell = (k: keyof Cols) => (cols[k] < 0 ? "" : norm(r[cols[k]]));
      const rawDate = cell("date"), desc = cell("desc"), invoice = cell("invoice"), rawPrice = cell("price");
      const where = `${tab.title} row ${i + 2}`;
      // Only rows from the go-live date on are read, so only their problems are worth listing: `when` is the date
      // the row sits among (the dates above it).
      const note = (msg: string, when: string | null) => { if (!when || when >= opts.since) problems.push(`${where}: ${msg}`); };
      if (rawDate) {
        const d = readDate(rawDate);
        if (!d) { note(`the date "${rawDate}" can't be read`, latest || date); return; }
        date = d; shown = rawDate;
      }
      if (!desc && !invoice && !rawPrice) return;
      if (!date) { note("no date", null); return; }
      const price = readPrice(rawPrice);
      if (price == null) { note("no price", date); return; }
      // A date well behind the rows above it is a typo (the 2026 tab has a 2/26/2025 among February 2026 rows): say so
      // rather than let it fall before `since` and vanish.
      if (latest && daysBetween(date, latest) > 60) { note(`the date ${shown} looks wrong (well before the rows above it)`, latest); return; }
      // ...and one well after today (a month and day swapped, 11/3 for 3/11): a problem, and it doesn't move `latest`,
      // so the rows after it still read.
      if (opts.today && daysBetween(opts.today, date) > 31) { note(`the date ${shown} looks wrong (after today)`, latest || opts.today); return; }
      if (date > latest) latest = date;
      if (date < opts.since) return;
      const amount = credit ? -Math.abs(price) : price;
      const base = [date, invoice, Math.round(amount * 100), desc.toLowerCase()].join("|");
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      // The key leaves the optional columns out, so filling them in later keeps the matches already made.
      const po = cell("po"), vendor = cell("vendor"), type = cell("type").toLowerCase(), orig = cell("orig");
      rows.push({ key: rowKey(credit ? "credit" : "row", date, invoice, amount, desc, n), tab: tab.title, date, desc, invoice, amount, credit,
        brand: (vendor && brandOf(vendor, opts.words)) || brandOf(desc, opts.words), special: /\([^)]+\)/.test(desc) || /special/.test(type),
        ...(po ? { po } : {}), ...(vendor ? { vendor } : {}), ...(type ? { type } : {}), ...(orig ? { origInvoice: orig } : {}) });
    });
  }
  return { rows, problems, tabsRead };
}
