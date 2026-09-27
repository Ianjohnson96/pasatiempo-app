// The Pro Shop reporting calendar: every report and task that keeps the
// open-to-buy accurate, when it's due, and when to remind people. One source
// for the program's Reports tab, the hub dashboard and the reminder emails
// (app/api/cron/merch). Ticks are stored as merch documents checklist/{key}.
//
// Dates are Pacific calendar days as "YYYY-MM-DD".

export type Cadence = "weekly" | "monthly" | "quarterly" | "seasonal" | "yearly";

export interface ReportItem {
  k: string;
  t: string;
  d: string;
}

export interface Period {
  key: string; // checklist document id
  cadence: Cadence;
  label: string;
  opens: string; // first day it shows
  due: string;
  late: string; // first day it counts as overdue
  closes: string; // last day it shows
  remind: string[]; // days a reminder email goes out while anything is left
  items: ReportItem[];
}

export type PeriodStatus = "upcoming" | "due" | "overdue" | "done";

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: "Every Monday",
  monthly: "Last day of the month",
  quarterly: "After each quarterly count",
  seasonal: "Before each buying window",
  yearly: "Fiscal year-end",
};

export const ITEMS: Record<Cadence, ReportItem[]> = {
  weekly: [
    { k: "daily", t: "Daily Sales Report for Sunday", d: "Run it for Sunday's date: month-to-date sales by category against plan." },
    { k: "orders", t: "Order Book is up to date", d: "Every PO written this week is entered; changes, cancellations and new cancel dates are in." },
    { k: "recv", t: "Last week's receipts are recorded", d: "Every delivery is marked received, so late orders and missed cancel dates get flagged." },
    { k: "todo", t: "Work the To do list", d: "Mark each item Done or Dismiss." },
  ],
  // Keys match the checklist the Month-end page has always used, so earlier ticks still count.
  monthly: [
    { k: "sku", t: "SKU Analysis", d: "PRSHP – SKU Analysis as of the last day, all categories. Must be run on the last day: on-hand can't be recreated later." },
    { k: "daily", t: "Daily Sales Report by Item", d: "Run for the last day of the month. Gives month-to-date and fiscal-year-to-date sales by category." },
    { k: "cat", t: "Sales by Category", d: "Net Sales by Category – Pro Shop: the month just closed, and fiscal year to date from May 1." },
    { k: "item", t: "Sales by Item", d: "Net Sales by Item – Pro Shop, fiscal year to date. Gives each SKU's average selling price." },
    { k: "best", t: "Cost & margin report", d: "PRSHP – BEST 100 based on Quantity Sold, fiscal year to date — without the zero-on-hand filter, past the top 100 if the system allows." },
    { k: "rounds", t: "Rounds Summary", d: "Yearly Rounds Summary by Golfer Classification, calendar year to date." },
    { k: "pos", t: "Every purchase order is in the Order Book", d: "Including phone and show orders. Mark anything received this month." },
    { k: "recv", t: "Receipts entered in the POS", d: "Every box that came in is received in the POS before the SKU Analysis runs." },
    { k: "send", t: "Upload the reports", d: "The owner uploads them on the Month-end page, PDF or Excel, checks what changes, then updates the program." },
  ],
  quarterly: [
    { k: "fix", t: "Fix data issues first", d: "Correct negative on-hand and retired SKUs before posting the count." },
    { k: "count", t: "Record the count", d: "Book and counted value at cost by category, on Inventory & counts. The POS count-variance report usually has both." },
    { k: "sku", t: "SKU Analysis after the count", d: "Run it once the count adjustments are posted, then upload it on the Month-end page." },
    { k: "split", t: "Split a few combined SKUs", d: "Move stock from combined SKUs onto new style-level SKUs, a few at a time." },
  ],
  seasonal: [
    { k: "events", t: "Event & tournament calendar", d: "Shotguns, outings, member-guests and anything with pre-ordered logo goods (golf operations)." },
    { k: "rounds", t: "Rounds budget or forecast", d: "Expected rounds by month for the coming season, and any green-fee or tee-sheet changes (golf operations / GM)." },
    { k: "vendors", t: "Vendor terms & price lists", d: "Lead times, order minimums, cancel windows and new cost prices from the reps." },
    { k: "aged", t: "Aged inventory review", d: "Decide markdown, vendor return or write-off for every SKU with no sale in 12+ months." },
  ],
  yearly: [
    { k: "count", t: "Physical inventory count", d: "Count on April 30, post the adjustment and note the shrink dollars." },
    { k: "sku", t: "SKU Analysis as of April 30", d: "Run after the count adjustment, before May's first receipt." },
    { k: "full", t: "Full-year Sales by Category, Sales by Item and BEST 100", d: "Each for May 1 – April 30: last year's actuals, the base of the new plan." },
    { k: "rounds", t: "Full-year Rounds Summary", d: "Last calendar year (pull it in January) and year to date at April 30." },
    { k: "targets", t: "Next year's targets", d: "Approved sales target, gross margin target and inventory ceiling (GM / board)." },
    { k: "special", t: "Special Orders clean-up", d: "Invoice, collect or write off every customer order more than a year old." },
  ],
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEASON: Record<number, string> = { 8: "Fall & holiday buying review", 11: "Spring buying review", 2: "Summer buying review" };
const QUARTER_ENDS = [1, 4, 7, 10];

const day = (s: string) => new Date(s + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(day(s).getTime() + n * 86400000));
const ymd = (y: number, m: number, d: number) => iso(new Date(Date.UTC(y, m - 1, d)));
const monthEnd = (y: number, m: number) => iso(new Date(Date.UTC(y, m, 0)));
/** "Sep 30" */
export const shortDate = (s: string) => `${MON[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`;

/** Today's date in Pacific time. */
export function pacificToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function weekly(today: string): Period[] {
  const monday = addDays(today, -((day(today).getUTCDay() + 6) % 7));
  return [{
    key: `wk-${monday}`, cadence: "weekly", label: `Week of ${shortDate(monday)}`,
    opens: monday, due: monday, late: addDays(monday, 2), closes: addDays(monday, 6),
    remind: [monday, addDays(monday, 2)], items: ITEMS.weekly,
  }];
}

// Month M is pulled on its last day (or first thing on the 1st) and uploaded
// in the first days of the next month.
function monthly(y: number, m: number): Period {
  const end = monthEnd(y, m);
  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return {
    key: `${y}-${String(m).padStart(2, "0")}`, cadence: "monthly", label: `${MON[m - 1]} month-end`,
    opens: addDays(end, -3), due: end, late: ymd(ny, nm, 4), closes: addDays(monthEnd(ny, nm), -4),
    remind: [addDays(end, -3), end, ymd(ny, nm, 4)], items: ITEMS.monthly,
  };
}

// Count dates vary, so the checklist opens at the quarter's end and is due ten days later.
function quarterly(y: number, m: number): Period {
  const end = monthEnd(y, m);
  return {
    key: `q-${y}-${String(m).padStart(2, "0")}`, cadence: "quarterly", label: `Quarterly count (${shortDate(end)})`,
    opens: end, due: addDays(end, 10), late: addDays(end, 11), closes: addDays(end, 45),
    remind: [end, addDays(end, 11)], items: ITEMS.quarterly,
  };
}

function seasonal(y: number, m: number): Period {
  return {
    key: `season-${y}-${String(m).padStart(2, "0")}`, cadence: "seasonal", label: `${SEASON[m]} (${MON[m - 1]})`,
    opens: ymd(y, m, 1), due: ymd(y, m, 15), late: ymd(y, m, 16), closes: monthEnd(y, m),
    remind: [ymd(y, m, 1), ymd(y, m, 16)], items: ITEMS.seasonal,
  };
}

function yearly(y: number): Period {
  return {
    key: `fy-${y}`, cadence: "yearly", label: `Year-end (Apr 30, ${y})`,
    opens: ymd(y, 4, 23), due: ymd(y, 4, 30), late: ymd(y, 5, 11), closes: ymd(y, 6, 30),
    remind: [ymd(y, 4, 23), ymd(y, 4, 30), ymd(y, 5, 11)], items: ITEMS.yearly,
  };
}

/** Every checklist that is showing on `today` (Pacific), soonest due first. */
export function openPeriods(today: string): Period[] {
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const months: [number, number][] = [0, 1, 2].map((back) => {
    const t = y * 12 + (m - 1) - back;
    return [Math.floor(t / 12), (t % 12) + 1];
  });
  const all = [
    ...weekly(today),
    ...months.map(([yy, mm]) => monthly(yy, mm)),
    ...months.filter(([, mm]) => QUARTER_ENDS.includes(mm)).map(([yy, mm]) => quarterly(yy, mm)),
    ...months.filter(([, mm]) => mm in SEASON).map(([yy, mm]) => seasonal(yy, mm)),
    yearly(y),
  ];
  return all.filter((p) => p.opens <= today && today <= p.closes).sort((a, b) => a.due.localeCompare(b.due));
}

export type Ticks = Record<string, boolean> | undefined;

export const remaining = (p: Period, ticks: Ticks) => p.items.filter((i) => !(ticks && ticks[i.k]));

export function periodStatus(p: Period, ticks: Ticks, today: string): PeriodStatus {
  if (!remaining(p, ticks).length) return "done";
  if (today < p.due) return "upcoming";
  if (today < p.late) return "due";
  return "overdue";
}

/** The checklists a reminder email goes out for today: not finished, and today is one of their reminder days. */
export function remindersFor(today: string, ticksByKey: Record<string, Ticks>): { period: Period; status: PeriodStatus; left: ReportItem[] }[] {
  return openPeriods(today)
    .filter((p) => p.remind.includes(today))
    .map((p) => ({ period: p, status: periodStatus(p, ticksByKey[p.key], today), left: remaining(p, ticksByKey[p.key]) }))
    .filter((r) => r.status !== "done");
}

/** The next checklist of each rhythm that isn't open yet, for a "coming up" list. */
export function upcoming(today: string): Period[] {
  const open = new Set(openPeriods(today).map((p) => p.key));
  const next = new Map<Cadence, Period>();
  for (let i = 1; i <= 400 && next.size < 5; i++) {
    for (const p of openPeriods(addDays(today, i))) if (!open.has(p.key) && !next.has(p.cadence)) next.set(p.cadence, p);
  }
  return [...next.values()].sort((a, b) => a.due.localeCompare(b.due));
}
