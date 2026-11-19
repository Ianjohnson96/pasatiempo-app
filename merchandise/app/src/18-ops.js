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

/** 'received' | 'arrived' | 'late' | 'due' | 'later'. openValue is the order's total cost;
    receivedValue is what month-end recorded as received. */
function rcvState(o, thisMonth) {
  if (o.status === "received" || o.status === "cancelled" || o.invoicesClearedAt) return "received";
  const arrived = arrivedValue(o.invoicesIn, o.openValue);
  if (arrived > 0.5) return (Number(o.receivedValue) || 0) >= arrived ? "received" : "arrived";
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
  return !!orderDate && !!season && orderDate.slice(0, 7) < season.first;
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

/** A hand-entered "invoice in" entry from the form values, or {error}. Amount is optional (blank = the whole open balance). */
function makeInvoiceEntry(f, by) {
  const date = String((f && f.date) || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the date the invoice came in." };
  const raw = f.amount == null ? "" : String(f.amount).replace(/[$,\s]/g, "");
  const e = { date, source: "hand" };
  if (raw !== "") {
    const a = Number(raw);
    if (!Number.isFinite(a) || a <= 0) return { error: "The invoice amount must be more than zero, or left blank for the whole order." };
    e.amount = Math.round(a * 100) / 100;
  }
  if (by) e.by = by;
  const inv = String((f && f.invoice) || "").trim(), note = String((f && f.note) || "").trim();
  if (inv) e.invoice = inv.slice(0, 60);
  if (note) e.note = note.slice(0, 300);
  return { entry: e };
}
