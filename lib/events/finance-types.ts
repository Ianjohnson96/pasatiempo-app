// Clinic financials — domain types. Admin-only data; never reaches a browser
// component on the public event page (it lives in its own tables, not on the
// event row, precisely so it cannot).
//
// All money is integer CENTS. Dollar floats produce payout totals that don't
// reconcile, which is the one thing a payout sheet must always do.

export type Tender = "cash" | "check" | "venmo" | "zelle";

export const TENDERS: Tender[] = ["cash", "check", "venmo", "zelle"];

export const TENDER_LABEL: Record<Tender, string> = {
  cash: "Cash",
  check: "Check",
  venmo: "Venmo",
  zelle: "Zelle",
};

export function isTender(v: string): v is Tender {
  return (TENDERS as string[]).includes(v);
}

// A person who helps run the clinic and shares in the pot.
export interface Instructor {
  id: string;
  name: string;
}

// One row per event. `presence` maps a slot (clinic date) id to the ids of the
// instructors who worked that date — that's what drives the per-date split.
export interface EventFinance {
  eventId: string;
  feeCents: number; // default fee per person
  organizerName: string; // who takes the cut off the top
  organizerCutCents: number; // taken before the pot is split
  instructors: Instructor[];
  presence: Record<string, string[]>; // slotId -> instructorId[]
}

export interface PrizePurchase {
  id: string;
  eventId: string;
  purchasedOn: string | null; // "yyyy-mm-dd"
  description: string;
  amountCents: number;
  createdAt: string;
}

// The payment recorded against one sign-up (one payment per person).
export interface Payment {
  paid: boolean;
  feeCents: number | null; // null = use the event default
  tender: Tender | null;
  paidOn: string | null; // "yyyy-mm-dd"
  paymentNote: string;
}
