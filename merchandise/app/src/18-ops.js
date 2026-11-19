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
    order off the store-room list: an open balance then counts as late / due / later by its delivery month. */
function rcvState(o, thisMonth) {
  if (o.status === "received" || o.status === "cancelled") return "received";
  const total = Number(o.openValue) || 0, rec = Number(o.receivedValue) || 0;
  if (o.invoicesClearedAt) {
    if (total - rec <= 0.5) return "received";
  } else if ((o.invoicesIn || []).length) {
    return storeRoomValue(o.invoicesIn, total, rec) > 0.5 ? "arrived" : "received";
  }
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

/** The buying season a 'YYYY-MM' month falls in (null when missing or malformed): spring Jan-Apr, summer May-Jul, fall Aug-Oct, holiday Nov-Dec. */
function seasonOf(month) {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])/.test(month)) return null;
  const y = +month.slice(0, 4), m = +month.slice(5, 7);
  const [key, label, firstMonth] =
    m <= 4 ? ["spring", "Spring", 1] : m <= 7 ? ["summer", "Summer", 5] : m <= 10 ? ["fall", "Fall", 8] : ["holiday", "Holiday", 11];
  return { key, label: label + " " + y, year: y, first: y + "-" + String(firstMonth).padStart(2, "0") };
}

/** True when the order was placed before its season began. */
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

/** The calendar months ('YYYY-MM') a season covers. */
function seasonMonths(season) {
  if (!season) return [];
  const n = { spring: 4, summer: 3, fall: 3, holiday: 2 }[season.key] || 0;
  return Array.from({ length: n }, (_, i) => slotMonth(season.first, i));
}

/**
 * Season buys from flat rows {month, cat, brand, orderDate, dateUnknown, po, amount, units}: each is committed cost for one order line
 * in the month it counts (delivery month, or the month it arrived). Special Orders (640) are left out. An order placed
 * before the season began is "prebooked", one placed during or after it a "reorder" (isPrebook).
 * seasonList: the seasons that have orders, current first, then coming, then past (latest first).
 */
function seasonList(rows, thisMonth) {
  const m = new Map();
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
