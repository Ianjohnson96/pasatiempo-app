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
