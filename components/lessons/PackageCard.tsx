"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import {
  setPackagePayment,
  setPackagePrice,
  setPackageSize,
} from "@/lib/lessons/actions";
import { parseDollars } from "@/lib/lessons/calc";
import {
  formatDay,
  formatWhen,
  money,
  PAYMENT_BADGE,
  PAYMENT_LABEL,
  type NumberedLesson,
  type PackageRec,
  type PaymentStatus,
} from "@/lib/lessons/types";

// One package: what was sold, how much is used, and whether it is paid.
//
// The three payment states are three buttons rather than a toggle. "Pending"
// is a member charge submitted but not yet posted to the club's books - real
// money in flight - and collapsing it into paid or unpaid would misstate what
// Ian is owed.
//
// Payment changes are optimistic: the button lights up on the tap, and the
// save happens behind it. Waiting a full server round trip before a button
// reacts is what made the book feel slow.

const STATES: PaymentStatus[] = ["unpaid", "pending", "paid"];

export default function PackageCard({
  pkg,
  showClient = false,
  lessons,
}: {
  pkg: PackageRec;
  showClient?: boolean;
  /** This package's lessons; when given, the card can list their dates. */
  lessons?: NumberedLesson[];
}) {
  const [price, setPrice] = useState(
    pkg.priceCents === null ? "" : String(pkg.priceCents / 100),
  );
  const [size, setSize] = useState(String(pkg.size));
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [status, showStatus] = useOptimistic(pkg.paymentStatus);
  // Price and size show the new value the moment it is entered, like the
  // payment buttons; the card falls back to the saved values if a save fails.
  const [shown, showEdit] = useOptimistic(
    { priceCents: pkg.priceCents, size: pkg.size },
    (cur, patch: Partial<{ priceCents: number | null; size: number }>) => ({
      ...cur,
      ...patch,
    }),
  );

  function pay(s: PaymentStatus) {
    if (s === status) return;
    setError(null);
    start(async () => {
      showStatus(s);
      const r = await setPackagePayment(pkg.id, s, { clientId: pkg.clientId });
      // On failure the optimistic state falls back to the real one by itself.
      if (!r.ok) setError(r.error ?? "That did not work.");
    });
  }

  // Commit on blur, not per keystroke: otherwise "120" fires three writes.
  const savedPrice = pkg.priceCents === null ? "" : String(pkg.priceCents / 100);

  function commitPrice() {
    const parsed = parseDollars(price);
    if (!parsed.ok) {
      setError("That is not a valid price.");
      setPrice(savedPrice);
      return;
    }
    if (parsed.cents === pkg.priceCents) return;
    setError(null);
    start(async () => {
      showEdit({ priceCents: parsed.cents });
      const r = await setPackagePrice(
        pkg.id,
        parsed.cents === null ? null : parsed.cents / 100,
        pkg.clientId,
      );
      if (!r.ok) {
        setError(r.error);
        setPrice(savedPrice); // don't leave the rejected value in the box
      }
    });
  }

  function commitSize() {
    const n = Number(size.trim());
    if (!Number.isInteger(n) || n === pkg.size) return;
    setError(null);
    start(async () => {
      showEdit({ size: n });
      const r = await setPackageSize(pkg.id, n, pkg.clientId);
      if (!r.ok) {
        setError(r.error);
        setSize(String(pkg.size));
      }
    });
  }

  // Worked out from the shown size, so a size change moves "remaining" at once.
  const remaining = shown.size - pkg.used;
  const complete = remaining <= 0;
  const nearlyDone = !complete && remaining <= 1;

  return (
    <div className="card">
      <div className="lb-head">
        <div>
          {showClient && (
            <Link href={`/lessons/clients/${pkg.clientId}`} className="lb-name">
              {pkg.clientName}
            </Link>
          )}
          <div style={{ fontWeight: showClient ? 400 : 700 }}>
            {pkg.label || `${pkg.size}-lesson package`}
          </div>
          <div className="lb-sub">
            {pkg.used} of {shown.size} used
            {pkg.booked > 0 && ` · ${pkg.booked} booked`}
            {pkg.soldOn && ` · sold ${formatDay(pkg.soldOn)}`}
          </div>
        </div>
        <div>
          <span className={PAYMENT_BADGE[status]}>{PAYMENT_LABEL[status]}</span>
          <div style={{ fontWeight: 700, marginTop: 4 }}>
            {money(shown.priceCents)}
          </div>
          {pkg.paidOn && status === "paid" && (
            <div className="muted" style={{ fontSize: 12 }}>
              paid {formatDay(pkg.paidOn)}
            </div>
          )}
        </div>
      </div>

      {(complete || nearlyDone || shown.priceCents === null) && (
        <div className="lb-chips">
          {complete && <span className="badge gray">Finished</span>}
          {nearlyDone && <span className="badge open">1 lesson left</span>}
          {/* Said out loud rather than shown as $0, which would read as free. */}
          {shown.priceCents === null && (
            <span className="badge draft">No price recorded</span>
          )}
        </div>
      )}

      {error && (
        <p className="notice err" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}

      <div className="lb-controls">
        <label className="lb-num">
          Price $
          <input
            className="field"
            type="number"
            min="0"
            step="10"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>

        <label className="lb-num small">
          Lessons
          <input
            className="field"
            type="number"
            min="1"
            max="50"
            inputMode="numeric"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>

        <div className="seg lb-pay" role="radiogroup" aria-label="Payment">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === status}
              className={s === status ? "segbtn on" : "segbtn"}
              onClick={() => pay(s)}
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

      {lessons && <PackageDates lessons={lessons} />}
    </div>
  );
}

const STATE: Record<NumberedLesson["status"], string> = {
  completed: "✓",
  scheduled: "booked",
  cancelled: "cancelled",
  no_show: "no-show",
};

/**
 * Which lessons of the package happened when: "1 · Tue, Sep 3 ✓".
 *
 * Closed by default - it is there when Ian wants it, not in the way when he
 * does not. Cancelled lessons are listed but unnumbered, because they did not
 * use up the package.
 */
function PackageDates({ lessons }: { lessons: NumberedLesson[] }) {
  const ordered = [...lessons].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  return (
    <details className="lb-dates">
      <summary>
        Show dates <span className="muted">({ordered.length})</span>
      </summary>
      {ordered.length === 0 ? (
        <p className="lb-fhint" style={{ marginTop: 8 }}>
          No lessons attached yet. Use the dropdown on each lesson below to
          put it in this package.
        </p>
      ) : (
        <ol className="lb-dlist">
          {ordered.map((l) => {
            const off = l.status === "cancelled" || l.status === "no_show";
            return (
              <li key={l.id} className={off ? "off" : l.status}>
                <span className="lb-dseq">{off ? "–" : (l.seq ?? "–")}</span>
                <span className="lb-dwhen">{formatWhen(l.startsAt)}</span>
                <span className="lb-dstate">{STATE[l.status]}</span>
              </li>
            );
          })}
        </ol>
      )}
    </details>
  );
}
