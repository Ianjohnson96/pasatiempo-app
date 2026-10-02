// The year-end income export: every paid package, by the day it was paid.
//
// Cash basis - a package counts in the year the money arrived, which is how
// Ian's taxes see it - and money is integer cents until the last moment.

export type PaymentMethod = "venmo" | "member_charge" | "cash" | "other";

/** The four the database's check constraint allows, in that order. */
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  member_charge: "Member charge",
  cash: "Cash",
  other: "Other",
};

export interface IncomeRow {
  paidOn: string;
  clientName: string;
  label: string | null;
  size: number;
  priceCents: number;
  method: PaymentMethod | null;
}

/** One CSV cell: quoted when it must be, and never a live formula. */
function cell(v: string | number): string {
  let s = String(v);
  // A cell starting =, +, - or @ is run as a formula by Excel and Sheets;
  // a client name has no business doing that.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

export function incomeCsv(rows: IncomeRow[]): string {
  const sorted = [...rows].sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  const label = (m: PaymentMethod | null) =>
    m ? METHOD_LABEL[m] : "Not recorded";

  const lines = [
    "Paid on,Client,Package,Lessons,Amount,Method",
    ...sorted.map((r) =>
      [
        r.paidOn,
        r.clientName,
        r.label || `${r.size}-lesson package`,
        r.size,
        dollars(r.priceCents),
        label(r.method),
      ]
        .map(cell)
        .join(","),
    ),
  ];

  const byMethod = new Map<string, number>();
  for (const r of sorted) {
    const k = label(r.method);
    byMethod.set(k, (byMethod.get(k) ?? 0) + r.priceCents);
  }
  lines.push("");
  for (const [k, cents] of byMethod) {
    lines.push(`,,,,${dollars(cents)},${cell(`Total ${k}`)}`);
  }
  const total = sorted.reduce((t, r) => t + r.priceCents, 0);
  lines.push(`,,,,${dollars(total)},Total`);
  return lines.join("\r\n");
}
