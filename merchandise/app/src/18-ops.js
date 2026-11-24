// Pure receiving and season logic. No page globals, nothing read at load time,
// so tests can load this file alone (lib/merch/ops.test.ts).

/** Value that has arrived (invoice entries on an order), capped at the order's total. An entry
    without an amount means the whole order came in. */
function arrivedValue(invoicesIn, openValue) {
  const total = Math.max(0, Number(openValue) || 0);
  let sum = 0;
  for (const e of invoicesIn || []) {
    const a = e && e.amount != null && e.amount !== "" ? Number(e.amount) : NaN;
    sum += Number.isFinite(a) ? a : total;
  }
  return Math.min(total, Math.max(0, sum));
}

/** 'received' | 'arrived' | 'late' | 'due' | 'later'. openValue is the order's total cost; receivedValue is what
    month-end recorded as received; invoicesIn are the live entries (liveInvoices). An order is 'arrived' while
    storeRoomValue says goods are in the store room. A Clear (invoicesClearedAt, with nothing newer) only takes an
    order off the store-room list. Then, or when everything invoiced is already received, an open balance counts as
    late / due / later by its delivery month; with none left the order is 'received'. */
function rcvState(o, thisMonth) {
  if (o.status === "received" || o.status === "cancelled") return "received";
  const total = Number(o.openValue) || 0, rec = Number(o.receivedValue) || 0;
  if (!o.invoicesClearedAt && (o.invoicesIn || []).length && storeRoomValue(o.invoicesIn, total, rec) > 0.5) return "arrived";
  // Cleared, or everything invoiced is already received: an open balance still counts as late / due / later.
  if ((o.invoicesClearedAt || (o.invoicesIn || []).length) && total - rec <= 0.5) return "received";
  const m = o.deliveryMonth;
  if (!m) return "later";
  return m < thisMonth ? "late" : m === thisMonth ? "due" : "later";
}

/** Whole days from the earliest invoice entry to todayISO. */
function daysWaiting(invoicesIn, todayISO) {
  const ds = (invoicesIn || []).map((e) => e && e.date).filter(Boolean).sort();
  if (!ds.length) return 0;
  const t = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.max(0, Math.round((t(todayISO) - t(ds[0])) / 86400000));
}

/** The buying season a 'YYYY-MM' month falls in (null when missing or malformed). firsts: the first month of each season,
    in calendar order within the year (the Guidelines page; default spring Jan-Apr, summer May-Jul, fall Aug-Oct, holiday Nov-Dec). */
let SEASON_FIRSTS = {spring: 1, summer: 5, fall: 8, holiday: 11};
function seasonOf(month, firsts = SEASON_FIRSTS) {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])/.test(month)) return null;
  const y = +month.slice(0, 4), m = +month.slice(5, 7), f = firsts || {spring: 1, summer: 5, fall: 8, holiday: 11};
  const [key, label, firstMonth] =
    m < f.summer ? ["spring", "Spring", f.spring] : m < f.fall ? ["summer", "Summer", f.summer] : m < f.holiday ? ["fall", "Fall", f.fall] : ["holiday", "Holiday", f.holiday];
  return { key, label: label + " " + y, year: y, first: y + "-" + String(firstMonth).padStart(2, "0") };
}

function isPrebook(orderDate, season) {
  const d = orderDateISO(orderDate);
  return !!d && !!season && d.slice(0, 7) < season.first;
}

/** An order date as 'YYYY-MM-DD', or null when it can't be read. Accepts YYYY-MM-DD, M/D/YYYY and M/D/YY (read as 20YY). */
function orderDateISO(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  let y, m, d, x;
  if ((x = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) { y = +x[1]; m = +x[2]; d = +x[3]; }
  else if ((x = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(t))) { m = +x[1]; d = +x[2]; y = x[3].length === 2 ? 2000 + +x[3] : +x[3]; }
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

/** 'YYYY-MM' plus n months. */
function slotMonth(m, n) {
  const t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n;
  return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0");
}

/**
 * The columns for a deliveries-by-month chart: from two months before `thisMonth` (or the first delivery, if later) for at
 * most 24 months. Deliveries before that are one "Earlier / late" column and any after it one "Later" column, so nothing drops out.
 * Returns {months, early, later, slot(m)}: slot is the column index (early first, later last).
 */
function deliverySlots(deliveryMonths, thisMonth) {
  const ms = deliveryMonths.filter(m => /^\d{4}-\d{2}/.test(m || "")).map(m => m.slice(0, 7)).sort();
  if (!ms.length) return {months: [], early: false, later: false, slot: () => null};
  const floor = slotMonth(thisMonth, -2), start = ms[0] > floor ? ms[0] : floor, months = [];
  for (let m = start; m <= ms[ms.length - 1] && months.length < 24; m = slotMonth(m, 1)) months.push(m);
  const early = ms[0] < start, later = ms[ms.length - 1] > months[months.length - 1];
  return {months, early, later, slot: m => { m = m.slice(0, 7); return m < start ? 0 : m > months[months.length - 1] ? months.length + (early ? 1 : 0) : months.indexOf(m) + (early ? 1 : 0); }};
}

/** A hand-entered "invoice in" entry from the form values, or {error}. Amount is optional (blank = the whole open balance).
    rcvd is what the POS showed received on the order when the entry was made (num(p.received)); see storeRoomValue. */
function makeInvoiceEntry(f, by, rcvd) {
  const date = String((f && f.date) || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the date the invoice came in." };
  const raw = f.amount == null ? "" : String(f.amount).replace(/[$,\s]/g, "");
  const e = { date, source: "hand", at: new Date().toISOString(), rcvd: Math.max(0, Number(rcvd) || 0) };
  if (raw !== "") {
    const a = /^\d*\.?\d+$|^\d+\.$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(a) || a <= 0) return { error: "The invoice amount must be a number above zero, like 1000 or $1,000.50, or left blank for the whole order." };
    e.amount = Math.round(a * 100) / 100;
  }
  if (by) e.by = by;
  const inv = String((f && f.invoice) || "").trim(), note = String((f && f.note) || "").trim();
  if (inv) e.invoice = inv.slice(0, 60);
  if (note) e.note = note.slice(0, 300);
  return { entry: e };
}

/** After a Clear: only entries made later than invoicesClearedAt still count (entries with no `at` are treated as cleared).
    Returns {entries, cleared}; cleared is true when the order was cleared and nothing newer has come in. */
function liveInvoices(invoicesIn, clearedAt) {
  const all = invoicesIn || [];
  if (!clearedAt) return { entries: all, cleared: false };
  const entries = all.filter((e) => e && typeof e.at === "string" && e.at > clearedAt);
  return { entries, cleared: !entries.length };
}

/** Goods in the store room for an order, from its live invoice entries. Each entry records `rcvd`, what the POS
    showed received when it was made (missing = 0, the old behaviour). Counting starts at base, the smallest `rcvd`:
    the entries add up to what arrived since then (an entry without an amount is the whole open balance at its
    entry, total - its rcvd), capped at total - base. The store room holds what of that the POS hasn't received since. */
function storeRoomValue(invoicesIn, totalValue, receivedValue) {
  const es = (invoicesIn || []).filter(Boolean);
  if (!es.length) return 0;
  const total = Math.max(0, Number(totalValue) || 0);
  const rcvdOf = (e) => Math.max(0, Number(e.rcvd) || 0);
  const base = Math.min(...es.map(rcvdOf));
  let sum = 0;
  for (const e of es) {
    const a = e.amount != null && e.amount !== "" ? Number(e.amount) : NaN;
    sum += Number.isFinite(a) ? a : Math.max(0, total - rcvdOf(e));
  }
  const since = Math.min(Math.max(0, total - base), Math.max(0, sum));
  return Math.max(0, since - ((Number(receivedValue) || 0) - base));
}

/** The calendar months ('YYYY-MM') a season covers: from its first month up to the next season's (holiday runs to
    December), by the same season months seasonOf uses. */
function seasonMonths(season, firsts = SEASON_FIRSTS) {
  if (!season) return [];
  const f = firsts || { spring: 1, summer: 5, fall: 8, holiday: 11 }, order = ["spring", "summer", "fall", "holiday"], i = order.indexOf(season.key);
  if (i < 0) return [];
  const start = +season.first.slice(5, 7), end = i < 3 ? f[order[i + 1]] - 1 : 12;
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, k) => slotMonth(season.first, k));
}

/**
 * Season buys from flat rows {month, cat, brand, orderDate, dateUnknown, po, amount, units}: each is committed cost for one order line
 * in the month it counts (delivery month, or the month it arrived). Special Orders (640) are left out. An order placed
 * before the season began is "prebooked", one placed during or after it a "reorder" (isPrebook).
 * seasonList: the seasons that have orders, current first, then coming, then past (latest first).
 */
// keep: months whose seasons are listed even with nothing on order (the season under way, whose room still counts).
function seasonList(rows, thisMonth, keep = []) {
  const m = new Map();
  for (const k of keep) { const s = seasonOf(k); if (s) m.set(s.key + s.year, s); }
  for (const r of rows) {
    if (r.cat === "640" || !(Number(r.amount) > 0)) continue;
    const s = seasonOf(r.month);
    if (s) m.set(s.key + s.year, s);
  }
  const cur = seasonOf(thisMonth), ck = cur ? cur.first : "";
  const rank = (s) => (s.first === ck ? 0 : s.first > ck ? 1 : 2);
  return [...m.values()].sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? b.first.localeCompare(a.first) : a.first.localeCompare(b.first)));
}

/** One season's totals: committed, prebooked, reorders, units, by month, by category and by brand (largest first). */
function seasonBuys(rows, season) {
  const out = { committed: 0, prebooked: 0, reorders: 0, unknown: 0, unknownOrders: 0, units: 0, byMonth: {}, byCat: {}, byBrand: [] };
  const brands = new Map(), unk = new Set();
  for (const m of seasonMonths(season)) out.byMonth[m] = { prebooked: 0, reorders: 0 };
  for (const r of rows) {
    const a = Number(r.amount) || 0;
    if (r.cat === "640" || !(a > 0)) continue;
    const s = seasonOf(r.month);
    if (!s || s.first !== season.first) continue;
    const k = r.dateUnknown ? "unknown" : isPrebook(r.orderDate, season) ? "prebooked" : "reorders";
    if (k === "unknown") unk.add(r.po);
    out.committed += a; out[k] += a; out.units += Number(r.units) || 0;
    const bm = out.byMonth[r.month.slice(0, 7)]; bm[k] = (bm[k] || 0) + a;
    out.byCat[r.cat] = (out.byCat[r.cat] || 0) + a;
    const name = r.brand || "Other / no brand";
    const b = brands.get(name) || { brand: name, committed: 0, prebooked: 0, reorders: 0, unknown: 0, units: 0 };
    b.committed += a; b[k] += a; b.units += Number(r.units) || 0; brands.set(name, b);
  }
  out.unknownOrders = unk.size;
  out.byBrand = [...brands.values()].sort((x, y) => y.committed - x.committed || x.brand.localeCompare(y.brand));
  return out;
}

/** POS-style dates in the SKU Analysis text ("Nov06/26") written the way the program writes dates ("Nov 6, 2026"). */
function posDates(t) {
  return String(t == null ? "" : t).replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2})\/(\d{2})\b/g, (_, m, d, y) => `${m} ${+d}, 20${y}`);
}

/* ---------- receiving log matching (pure) ----------
   Rows come from receivinglog/current (lib/merch/receiving-log.ts parses the sheet on the server). The page suggests
   which order a row belongs to; a person confirms. vendorKeyOf(po) gives an order's vendor key; openOf(po) what is
   still open on it. Spec: docs/superpowers/specs/2026-11-22-merch-phase2-design.md, stage 2. */
const LOG_RE = new Map();   // compiled once per word: matching runs over every row and order on each redraw
const logWordRe = w => LOG_RE.get(w) || LOG_RE.set(w, new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])')).get(w);
/** The vendor key a vendor's name belongs to: the key itself or one of its words, as a whole word; longest wins. */
function vendorKeyFor(name, words) {
  const n = ' ' + String(name || '').toLowerCase() + ' ';
  let best = null, len = 0;
  for (const k of Object.keys(words || {})) for (const w of [k].concat(words[k] || [])) {
    const x = String(w).toLowerCase().trim();
    if (x && x.length > len && logWordRe(x).test(n)) { best = k; len = x.length; }
  }
  return best;
}
const monthGap = (a, b) => Math.abs((+a.slice(0, 4) * 12 + +a.slice(5, 7)) - (+b.slice(0, 4) * 12 + +b.slice(5, 7)));
/** Orders a log row could belong to: same vendor, delivery month within one month of the row's, and enough still
    open (2% leeway); a credit can go against any order of the vendor in that window that isn't cancelled. Nearest
    month first, then nearest amount. */
function logCandidates(row, orders, vendorKeyOf, openOf) {
  if (!row || !row.brand) return [];
  const m = String(row.date).slice(0, 7);
  return (orders || []).filter(p => {
    // a late order (due before the row's month) can match however late it is; otherwise within a month either way
    if (!p || !p.deliveryMonth || vendorKeyOf(p) !== row.brand || (monthGap(p.deliveryMonth, m) > 1 && !(p.deliveryMonth < m && !row.credit))) return false;
    if (row.credit) return p.status !== 'cancelled';
    return (p.status === 'open' || p.status === 'partial' || p.status === 'hold') && Number(openOf(p)) >= row.amount * 0.98;
  }).sort((a, b) => monthGap(a.deliveryMonth, m) - monthGap(b.deliveryMonth, m) || Math.abs(openOf(a) - row.amount) - Math.abs(openOf(b) - row.amount));
}
/** PO numbers compare without case, spaces, punctuation or a "PO" in front: "P-4471", "po 4471" and "4471" agree. */
const poNorm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^po?(?=\d)/, '');
/** The order a row names: its PO # column, or on a credit the order carrying its original invoice. Null if none. */
function logNamedOrder(row, orders) {
  const live = (orders || []).filter(p => p && p.status !== 'cancelled');
  const po = poNorm(row && row.po);
  if (po) { const p = live.find(x => poNorm(x.poNumber) === po); if (p) return p; }
  const orig = String((row && row.credit && row.origInvoice) || '').trim().toLowerCase();
  if (orig) { const p = live.find(x => (x.invoicesIn || []).some(e => e && String(e.invoice || '').trim().toLowerCase() === orig)); if (p) return p; }
  return null;
}
/** A vendor's orders a row could still belong to when none fits exactly: any not finished or cancelled (a credit: any
    not cancelled), nearest due month first, then nearest open amount. */
function logLooseCandidates(row, orders, openOf) {
  if (!row || !row.brand) return [];
  const m = String(row.date).slice(0, 7);
  return (orders || []).filter(p => p && (row.credit ? p.status !== 'cancelled' : (p.status === 'open' || p.status === 'partial' || p.status === 'hold')))
    .sort((a, b) => monthGap(a.deliveryMonth || m, m) - monthGap(b.deliveryMonth || m, m) || Math.abs(openOf(a) - row.amount) - Math.abs(openOf(b) - row.amount));
}
/** The Receiving view's lists: rows to match (with their candidates), rows not from an order (none possible, or marked
    by a person), rows matched, and matches whose row is no longer in the log. */
function logQueue(rows, orders, decisions, vendorKeyOf, openOf) {
  const out = {toMatch: [], notOrder: [], matched: [], changed: [], twice: []}, have = new Set();
  // What an order carries is the record of a match: a row is matched when some order has its entry, even if the call
  // (logmatch) failed to save; a row on two orders is flagged.
  const carriers = new Map(), byVendor = new Map(), keyOf = new Map();
  for (const p of orders || []) {
    for (const e of p.invoicesIn || []) if (e && e.logKey) (carriers.get(e.logKey) || carriers.set(e.logKey, []).get(e.logKey)).push(p.id);
    const k = vendorKeyOf(p); keyOf.set(p, k);
    if (k) (byVendor.get(k) || byVendor.set(k, []).get(k)).push(p);
  }
  const vk = p => keyOf.has(p) ? keyOf.get(p) : vendorKeyOf(p);
  for (const row of rows || []) {
    have.add(row.key);
    const on = carriers.get(row.key) || [], d = (decisions || {})[row.key];
    if (on.length > 1) out.twice.push({key: row.key, pos: on.slice()});
    if (on.length) { out.matched.push({row, po: on[0]}); continue; }
    if (d && d.state === 'matched') { out.matched.push({row, po: d.po}); continue; }
    if (d && d.state === 'notorder') {
      // Marked not from an order, then a reorder that fits was entered: offer it again (reorders are entered sometimes,
      // not always, and often after the goods arrive).
      const later = logCandidates(row, byVendor.get(row.brand) || [], vk, openOf).filter(p => p.createdAt && d.at && p.createdAt > d.at);
      if (later.length) out.toMatch.push({row, cands: later, fit: 'good', reopened: true}); else out.notOrder.push({row, why: 'marked'});
      continue;
    }
    // The log names the order (a PO # column), or a credit names the invoice it is against: that order, no guessing.
    const named = logNamedOrder(row, orders);
    if (named) { out.toMatch.push({row, cands: [named], fit: 'exact'}); continue; }
    // A special order (a customer's name in brackets, or Type Special) has no order placed: nothing to confirm.
    if (row.special) { out.notOrder.push({row, why: 'special'}); continue; }
    const cands = logCandidates(row, byVendor.get(row.brand) || [], vk, openOf);
    if (cands.length) { out.toMatch.push({row, cands, fit: 'good'}); continue; }
    // No exact fit, but the vendor has orders still open (due months away, or less left open than the invoice: an
    // early or over-shipped delivery): offer those for a person to pick rather than file the row away.
    // A row the log calls a reorder isn't expected to be in the order book unless an order fits it.
    if (/reorder/.test(row.type || '')) { out.notOrder.push({row, why: 'reorder'}); continue; }
    const loose = logLooseCandidates(row, byVendor.get(row.brand) || [], openOf);
    if (loose.length) out.toMatch.push({row, cands: loose, fit: 'loose'}); else out.notOrder.push({row, why: 'none'});
  }
  const gone = new Set();
  for (const [key, on] of carriers) if (!have.has(key)) for (const po of on) { out.changed.push({key, po}); gone.add(key); }
  for (const [key, d] of Object.entries(decisions || {})) if (d && d.state === 'matched' && !have.has(key) && !gone.has(key)) out.changed.push({key, po: d.po});
  return out;
}
/** An order's invoice entries after a save conflict: theirs, less what we removed (an Undo), plus what we added (a
    Confirm), so two people's confirms on one order both survive (club-shim.js merge3). An entry is known by its log
    row, or by when and what it was. */
function mergeInvoices(base, ours, theirs) {
  const id = e => e && e.logKey ? 'L' + e.logKey : 'E' + [e && e.at, e && e.date, e && e.amount, e && e.invoice, e && e.source].join('|');
  const b = new Set((base || []).map(id)), o = new Set((ours || []).map(id)), t = new Set((theirs || []).map(id));
  return (theirs || []).filter(e => !(b.has(id(e)) && !o.has(id(e)))).concat((ours || []).filter(e => !b.has(id(e)) && !t.has(id(e))));
}

/** The invoice entry a confirmed log row puts on its order. `at` is the row's own date, so a row dated before the
    order was cleared from the store-room list stays cleared (liveInvoices). */
function logEntry(row, po, by) {
  return {date: row.date, amount: row.amount, invoice: row.invoice, note: row.desc, source: 'log', logKey: row.key, by,
    at: row.date + 'T00:00:00Z', rcvd: Math.max(0, Number(po && po.received) || 0)};
}
/** An order's entries with this log row's: one entry per row (a second confirm replaces it), and a hand entry for the
    same invoice number is replaced rather than counted twice. */
function withLogEntry(invoicesIn, entry) {
  const inv = String(entry.invoice || '').trim();
  return (invoicesIn || []).filter(e => e && e.logKey !== entry.logKey && !(e.source === 'hand' && inv && String(e.invoice || '').trim() === inv)).concat([entry]);
}
const withoutLogEntry = (invoicesIn, logKey) => (invoicesIn || []).filter(e => e && e.logKey !== logKey);
