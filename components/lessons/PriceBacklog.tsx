"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { applyStandardPrices, setPackagePrice } from "@/lib/lessons/actions";
import { singleRate } from "@/lib/lessons/calc";
import {
  formatDay,
  money,
  packageTitle,
  type PackageRec,
  type SingleRates,
} from "@/lib/lessons/types";

// Packages sold with no price recorded. Until each has one, "owed" and
// "collected" leave it out, so this list is what makes the money add up.
//
// Most get the standard price for their size in one tap; the few that sold
// for something else get typed in. "Apply to all" only ever fills empty
// prices - the server filters on price_cents is null - so a hand-typed price
// is never overwritten.

export default function PriceBacklog({
  packages,
  prices,
  rates,
}: {
  packages: PackageRec[];
  prices: Record<number, number>;
  rates: SingleRates;
}) {
  // A package's standard is by size; a single's is the member or guest rate.
  const standardFor = (p: PackageRec): number | undefined =>
    p.kind === "single"
      ? (singleRate(p.clientIsMember, rates) ?? undefined)
      : prices[p.size];
  const [done, setDone] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, start] = useTransition();

  const left = packages.filter((p) => !done.has(p.id));
  const fillable = left.filter((p) => standardFor(p) !== undefined);

  function finish(ids: string[], ok: string) {
    setDone((d) => new Set([...d, ...ids]));
    setNote({ kind: "ok", text: ok });
  }

  function applyAll() {
    const ids = fillable.map((p) => p.id);
    setConfirming(false);
    setNote(null);
    start(async () => {
      const r = await applyStandardPrices(ids);
      if (!r.ok) setNote({ kind: "err", text: r.error });
      else finish(ids, `Filled ${r.value} package${r.value === 1 ? "" : "s"}.`);
    });
  }

  function setOne(p: PackageRec, dollars: number) {
    setNote(null);
    start(async () => {
      const r = await setPackagePrice(p.id, dollars, p.clientId);
      if (!r.ok) setNote({ kind: "err", text: r.error });
      else
        finish(
          [p.id],
          `${p.clientName}: ${money(Math.round(dollars * 100))}.`,
        );
    });
  }

  if (!left.length) {
    return (
      <p className="empty" style={{ marginTop: 16 }}>
        Every package has a price. The money on the dashboard is complete.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div className="lb-sechead" style={{ marginTop: 0 }}>
        <h2 className="section-title">{left.length} without a price</h2>
      </div>

      {fillable.length > 0 &&
        (confirming ? (
          <div className="notice warn lb-banner" style={{ marginTop: 0 }}>
            <span>
              Set {fillable.length} package{fillable.length === 1 ? "" : "s"}{" "}
              to the standard price for their size? Prices already typed in
              are not touched.
            </span>
            <span className="lb-actions">
              <button className="btn small" disabled={busy} onClick={applyAll}>
                Yes, fill them
              </button>
              <button
                className="btn secondary small"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </span>
          </div>
        ) : (
          <button
            className="btn small"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Apply standard to all {fillable.length}
          </button>
        ))}

      {fillable.length === 0 && (
        <p className="lb-fhint">
          None of these sizes has a standard price yet &mdash; set them above,
          or type each price in.
        </p>
      )}

      {note && (
        <p
          className={note.kind === "ok" ? "notice ok" : "notice err"}
          style={{ marginTop: 10 }}
        >
          {note.text}
        </p>
      )}

      <div className="stack" style={{ marginTop: 12 }}>
        {left.map((p) => (
          <BacklogRow
            key={p.id}
            p={p}
            standard={standardFor(p)}
            busy={busy}
            onSet={(d) => setOne(p, d)}
          />
        ))}
      </div>
    </div>
  );
}

function BacklogRow({
  p,
  standard,
  busy,
  onSet,
}: {
  p: PackageRec;
  standard: number | undefined;
  busy: boolean;
  onSet: (dollars: number) => void;
}) {
  const [custom, setCustom] = useState("");
  const n = Number(custom);
  const valid = custom.trim() !== "" && isFinite(n) && n >= 0;

  return (
    <div className="card">
      <div className="lb-head">
        <div>
          <Link href={`/lessons/clients/${p.clientId}`} className="lb-name">
            {p.clientName}
          </Link>
          <div className="lb-sub">
            {packageTitle(p)}
            {p.kind === "single"
              ? p.clientIsMember
                ? " · member"
                : " · guest"
              : ` · ${p.used} of ${p.size} used`}
            {p.kind !== "single" && p.soldOn && ` · sold ${formatDay(p.soldOn)}`}
          </div>
        </div>
        <span
          className={`badge ${p.paymentStatus === "paid" ? "full" : "gray"}`}
        >
          {p.paymentStatus}
        </span>
      </div>
      <div className="lb-controls">
        {standard !== undefined && (
          <button
            className="btn small"
            disabled={busy}
            onClick={() => onSet(standard / 100)}
          >
            Use {money(standard)}
          </button>
        )}
        <label className="lb-num">
          Other $
          <input
            className="field"
            type="number"
            min="0"
            step="5"
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) onSet(n);
            }}
          />
        </label>
        <button
          className="btn secondary small"
          disabled={busy || !valid}
          onClick={() => onSet(n)}
        >
          Save
        </button>
      </div>
    </div>
  );
}
