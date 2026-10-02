"use client";

import { METHOD_LABEL } from "@/lib/lessons/income";
import type { PayMethod } from "@/lib/lessons/types";

// Amount, how it was paid, and whether it has been - the three answers a
// bill needs, side by side so a row is filled in one pass. Used on the
// Billing screen and in a client's Select mode.

export type BillStatusChoice = "auto" | "paid" | "pending" | "unpaid";

export interface BillChoiceValue {
  dollars: string;
  method: PayMethod;
  status: BillStatusChoice;
}

const METHODS: PayMethod[] = ["member_charge", "venmo", "cash", "other"];

export default function BillChoices({
  value,
  onChange,
  disabled,
}: {
  value: BillChoiceValue;
  onChange: (v: BillChoiceValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="lb-billchoices">
      <label className="lb-num">
        Amount $
        <input
          className="field"
          type="number"
          min="0"
          step="5"
          inputMode="decimal"
          value={value.dollars}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, dollars: e.target.value })}
        />
      </label>
      <label className="lb-num lb-grow">
        Paid with
        <select
          className="field"
          value={value.method}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, method: e.target.value as PayMethod })
          }
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="lb-num lb-grow">
        Status
        <select
          className="field"
          value={value.status}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, status: e.target.value as BillStatusChoice })
          }
        >
          {/* Taught lessons were almost always paid; booked ones not yet. */}
          <option value="auto">Paid if taught, unpaid if booked</option>
          <option value="paid">All paid</option>
          <option value="pending">All pending</option>
          <option value="unpaid">All unpaid</option>
        </select>
      </label>
    </div>
  );
}
