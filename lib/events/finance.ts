// Clinic financials — the math. Pure functions: no I/O, no React, no Supabase.
// This is the module where a bug costs real money, so it is the one thing in
// this project with unit tests (finance.test.ts).
//
// The waterfall, mirroring the clinic spreadsheet:
//
//   gross fees collected  (people marked paid x their fee)
//   - organizer cut       (one person's fee off the top, to whoever ran it)
//   - prize purchases     (logged line items)
//   = net pot
//   / clinic dates        (every date on the event)
//   / pros present        (per date — everyone marked present shares it)
//
// Note this deliberately DIVERGES from the spreadsheet in one place: the sheet's
// `COUNTIF(B32:B34,"yes")` spans only three rows, so a fourth helper (Tyler, on
// row 35) is marked present but never counted — overpaying the other three and
// paying him nothing. Here every instructor marked present shares the date.

import type { EventRec, Registration } from "./types";
import type { EventFinance, Instructor, PrizePurchase } from "./finance-types";

// What this person owes for the clinic: their override if set, else the event fee.
export function feeForCents(
  reg: Pick<Registration, "feeCents">,
  finance: Pick<EventFinance, "feeCents">,
): number {
  return reg.feeCents ?? finance.feeCents;
}

export interface DateRow {
  slotId: string;
  present: Instructor[];
  perClinicCents: number; // this date's share of the net pot
  perPersonCents: number; // what each present instructor earns for this date
}

export interface PayoutRow {
  instructor: Instructor;
  datesWorked: number;
  sharesCents: number; // earned from working clinics
  organizerCutCents: number; // the cut off the top, if this is the organizer
  owedCents: number; // shares + cut
  isOrganizer: boolean;
}

export interface FinanceSummary {
  signedUpCount: number; // confirmed sign-ups
  paidCount: number;
  unpaidCount: number;

  grossCents: number; // collected
  outstandingCents: number; // signed up but not paid yet
  prizeTotalCents: number;
  organizerCutCents: number;
  netPotCents: number; // what gets split across the dates

  dateCount: number;
  perClinicCents: number;
  dates: DateRow[];

  payouts: PayoutRow[];
  sharesTotalCents: number; // sum of all instructor shares
  remainderCents: number; // net pot not allocated (rounding / unstaffed dates)
}

// Integer division that floors toward negative infinity, so a negative pot
// (prizes exceeded fees) still splits predictably instead of drifting.
function splitCents(total: number, parts: number): number {
  if (parts <= 0) return 0;
  return Math.floor(total / parts);
}

export function computeFinance(
  event: Pick<EventRec, "slots">,
  regs: Registration[],
  finance: EventFinance,
  prizes: PrizePurchase[],
): FinanceSummary {
  // Cancelled sign-ups are out of the money entirely — including any payment
  // once recorded against them, which the golf shop refunds outside the app.
  const active = regs.filter((r) => r.status !== "cancelled");
  const confirmed = active.filter((r) => r.status === "confirmed");

  let grossCents = 0;
  let paidCount = 0;
  for (const r of active) {
    if (!r.paid) continue;
    grossCents += feeForCents(r, finance);
    paidCount += 1;
  }

  let outstandingCents = 0;
  let unpaidCount = 0;
  for (const r of confirmed) {
    if (r.paid) continue;
    outstandingCents += feeForCents(r, finance);
    unpaidCount += 1;
  }

  const prizeTotalCents = prizes.reduce((n, p) => n + p.amountCents, 0);
  const organizerCutCents = finance.organizerCutCents;
  const netPotCents = grossCents - organizerCutCents - prizeTotalCents;

  const dateCount = event.slots.length;
  const perClinicCents = splitCents(netPotCents, dateCount);

  const byId = new Map(finance.instructors.map((i) => [i.id, i]));

  const dates: DateRow[] = event.slots.map((s) => {
    const ids = finance.presence[s.id] ?? [];
    // Only instructors still on the list count — removing someone shouldn't
    // leave a ghost sharing the pot via a stale presence entry.
    const present = ids
      .map((id) => byId.get(id))
      .filter((i): i is Instructor => !!i);
    return {
      slotId: s.id,
      present,
      perClinicCents,
      perPersonCents: splitCents(perClinicCents, present.length),
    };
  });

  const organizer = finance.organizerName.trim().toLowerCase();

  const payouts: PayoutRow[] = finance.instructors.map((instructor) => {
    let sharesCents = 0;
    let datesWorked = 0;
    for (const d of dates) {
      if (!d.present.some((p) => p.id === instructor.id)) continue;
      sharesCents += d.perPersonCents;
      datesWorked += 1;
    }
    const isOrganizer =
      organizer.length > 0 && instructor.name.trim().toLowerCase() === organizer;
    const cut = isOrganizer ? organizerCutCents : 0;
    return {
      instructor,
      datesWorked,
      sharesCents,
      organizerCutCents: cut,
      owedCents: sharesCents + cut,
      isOrganizer,
    };
  });

  const sharesTotalCents = payouts.reduce((n, p) => n + p.sharesCents, 0);

  return {
    signedUpCount: confirmed.length,
    paidCount,
    unpaidCount,
    grossCents,
    outstandingCents,
    prizeTotalCents,
    organizerCutCents,
    netPotCents,
    dateCount,
    perClinicCents,
    dates,
    payouts,
    sharesTotalCents,
    // Whatever the divisions left behind: rounding pennies, plus the full share
    // of any date nobody was marked present for. Always shown, so the payout
    // column reconciles back to the net pot instead of quietly losing money.
    remainderCents: netPotCents - sharesTotalCents,
  };
}

// ---- money formatting / parsing -------------------------------------------

export function formatCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const s = (abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return neg ? `-${s}` : s;
}

// Dollars typed by a human ("320", "$320.50", "1,200") -> cents.
// Returns null when there's no number in there at all.
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToDollarInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}
