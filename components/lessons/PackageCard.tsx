"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  setPackagePayment,
  setPackagePrice,
  setPackageSize,
} from "@/lib/lessons/actions";
import {
  formatDay,
  money,
  PAYMENT_BADGE,
  PAYMENT_LABEL,
  type PackageRec,
  type PaymentStatus,
} from "@/lib/lessons/types";

// One package: what was sold, how much is used, and whether it is paid.
//
// The three payment states are three buttons rather than a toggle. "Pending"
// is a member charge submitted but not yet posted to the club's books - real
// money in flight - and collapsing it into paid or unpaid would misstate what
// Ian is owed.

const STATES: PaymentStatus[] = ["unpaid", "pending", "paid"];

export default function PackageCard({
  pkg,
  showClient = false,
}: {
  pkg: PackageRec;
  showClient?: boolean;
}) {
  const [price, setPrice] = useState(
    pkg.priceCents === null ? "" : String(pkg.priceCents / 100),
  );
  const [size, setSize] = useState(String(pkg.size));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "That did not work.");
    });
  }

  // Commit on blur, not per keystroke: otherwise "120" fires three writes.
  function commitPrice() {
    const t = price.trim();
    const next = t === "" ? null : Number(t);
    if (next !== null && !isFinite(next)) return;
    const cents = next === null ? null : Math.round(next * 100);
    if (cents === pkg.priceCents) return;
    run(() => setPackagePrice(pkg.id, next, pkg.clientId));
  }

  function commitSize() {
    const n = Number(size.trim());
    if (!Number.isInteger(n) || n === pkg.size) return;
    run(() => setPackageSize(pkg.id, n, pkg.clientId));
  }

  const nearlyDone = !pkg.isComplete && pkg.remaining <= 1;

  return (
    <div className="card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
        }}
      >
        <div>
          {showClient && (
            <Link
              href={`/lessons/clients/${pkg.clientId}`}
              style={{ fontWeight: 700, fontSize: 16 }}
            >
              {pkg.clientName}
            </Link>
          )}
          <div style={{ fontWeight: showClient ? 400 : 700 }}>
            {pkg.label || `${pkg.size}-lesson package`}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {pkg.used} of {pkg.size} used
            {pkg.booked > 0 && ` · ${pkg.booked} booked`}
            {pkg.soldOn && ` · sold ${formatDay(pkg.soldOn)}`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className={PAYMENT_BADGE[pkg.paymentStatus]}>
            {PAYMENT_LABEL[pkg.paymentStatus]}
          </span>
          <div style={{ fontWeight: 700, marginTop: 4 }}>
            {money(pkg.priceCents)}
          </div>
          {pkg.paidOn && (
            <div className="muted" style={{ fontSize: 12 }}>
              paid {formatDay(pkg.paidOn)}
            </div>
          )}
        </div>
      </div>

      {(pkg.isComplete || nearlyDone || pkg.priceCents === null) && (
        <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {pkg.isComplete && <span className="badge gray">Finished</span>}
          {nearlyDone && <span className="badge open">1 lesson left</span>}
          {/* Said out loud rather than shown as $0, which would read as free. */}
          {pkg.priceCents === null && (
            <span className="badge draft">No price recorded</span>
          )}
        </div>
      )}

      {error && (
        <p className="notice err" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}

      <div
        className="row"
        style={{ gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        <label className="muted" style={{ fontSize: 12 }}>
          Price $
          <input
            className="field"
            type="number"
            min="0"
            step="10"
            inputMode="decimal"
            value={price}
            disabled={busy}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={{ width: 90, marginLeft: 4 }}
          />
        </label>

        <label className="muted" style={{ fontSize: 12 }}>
          Size
          <input
            className="field"
            type="number"
            min="1"
            max="50"
            value={size}
            disabled={busy}
            onChange={(e) => setSize(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={{ width: 70, marginLeft: 4 }}
          />
        </label>

        <span style={{ flex: 1 }} />

        <div className="seg">
          {STATES.map((s) => (
            <button
              key={s}
              className={s === pkg.paymentStatus ? "segbtn on" : "segbtn"}
              disabled={busy}
              onClick={() =>
                run(() =>
                  setPackagePayment(pkg.id, s, { clientId: pkg.clientId }),
                )
              }
            >
              {PAYMENT_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {pkg.notes && (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          {pkg.notes}
        </p>
      )}
    </div>
  );
}
