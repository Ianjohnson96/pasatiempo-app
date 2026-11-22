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
  special: boolean; // a customer's name in brackets: a special order
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

/** A row's identity: the tab, invoice, amount to the cent, description and a counter for exact repeats, never the
    row's position (rows get inserted). */
export function rowKey(tab: string, invoice: string, amount: number, desc: string, n: number): string {
  return createHash("sha1").update([tab, invoice, Math.round(amount * 100), desc.toLowerCase(), n].join("\u0001")).digest("hex").slice(0, 16);
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
function columns(header: string[]): { date: number; desc: number; invoice: number; price: number } | null {
  const h = header.map((x) => norm(x).toLowerCase().replace(/\s+/g, " "));
  const find = (f: (s: string) => boolean) => h.findIndex(f);
  const c = {
    date: find((s) => /^(rec\.? ?)?date$/.test(s)),
    desc: find((s) => /^item desc?ription$|^item decription$/.test(s)),
    invoice: find((s) => /^invoice ?#?$/.test(s)),
    price: find((s) => s === "price"),
  };
  return Object.values(c).every((i) => i >= 0) ? c : null;
}

/** The log's rows dated on or after `since`, from every tab laid out like it (found by headers, not tab names), with
    the Credits tab's as credits. A row with a description but no readable date or price is listed in `problems`;
    the rest are still read. */
export function parseLog(tabs: SheetTab[], opts: { since: string; words: Record<string, string[]> }): { rows: LogRow[]; problems: string[] } {
  const rows: LogRow[] = [], problems: string[] = [];
  for (const tab of tabs) {
    const values = tab.values || [];
    const cols = values.length ? columns(values[0]) : null;
    if (!cols) continue;
    const credit = /credit/i.test(tab.title);
    const seen = new Map<string, number>();
    let date: string | null = null, shown = "", latest = "";
    values.slice(1).forEach((r, i) => {
      const cell = (k: keyof typeof cols) => norm(r[cols[k]]);
      const rawDate = cell("date"), desc = cell("desc"), invoice = cell("invoice"), rawPrice = cell("price");
      const where = `${tab.title} row ${i + 2}`;
      if (rawDate) {
        const d = readDate(rawDate);
        if (!d) { problems.push(`${where}: the date "${rawDate}" can't be read`); return; }
        date = d; shown = rawDate;
      }
      if (!desc && !invoice && !rawPrice) return;
      if (!date) { problems.push(`${where}: no date`); return; }
      const price = readPrice(rawPrice);
      if (price == null) { problems.push(`${where}: no price`); return; }
      // A date well behind the rows above it is a typo (the 2026 tab has a 2/26/2025 among February 2026 rows): say so
      // rather than let it fall before `since` and vanish.
      if (latest && daysBetween(date, latest) > 60) { problems.push(`${where}: the date ${shown} looks wrong (well before the rows above it)`); return; }
      if (date > latest) latest = date;
      if (date < opts.since) return;
      const amount = credit ? -Math.abs(price) : price;
      const base = [invoice, Math.round(amount * 100), desc.toLowerCase()].join("|");
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      rows.push({ key: rowKey(tab.title, invoice, amount, desc, n), tab: tab.title, date, desc, invoice, amount, credit,
        brand: brandOf(desc, opts.words), special: /\([^)]+\)/.test(desc) });
    });
  }
  return { rows, problems };
}
