"use client";

import { METHOD_LABEL, type PaymentMethod } from "@/lib/lessons/income";

// "How was it paid?" - asked the moment a package is marked paid, so the
// year-end income export can say Venmo / member charge / cash without Ian
// reconstructing it in December. Skip records the payment without a method.

const ORDER: PaymentMethod[] = ["venmo", "member_charge", "cash", "other"];

export default function MethodPicker({
  onPick,
  onCancel,
}: {
  onPick: (method: PaymentMethod | null) => void;
  onCancel: () => void;
}) {
  return (
    <div className="lb-method" role="group" aria-label="How was it paid?">
      <span className="lb-method-q">How was it paid?</span>
      <div className="lb-method-opts">
        {ORDER.map((m) => (
          <button
            key={m}
            type="button"
            className="btn small"
            onClick={() => onPick(m)}
          >
            {METHOD_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="lb-method-opts">
        <button
          type="button"
          className="btn ghost small"
          onClick={() => onPick(null)}
        >
          Skip
        </button>
        <button type="button" className="btn ghost small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
