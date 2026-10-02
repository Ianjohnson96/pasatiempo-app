"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createPackage, setPackagePayment } from "@/lib/lessons/actions";
import { money, type PackageRec, type PaymentStatus } from "@/lib/lessons/types";
import { nextPackageText, smsHref } from "@/lib/lessons/contact";
import type { PaymentMethod } from "@/lib/lessons/income";
import MethodPicker from "./MethodPicker";

// Actions right on the dashboard's follow-up lists, so the common jobs -
// "she paid", "he bought another five" - do not need a trip to the client.

/**
 * A row in the Unpaid list with Pending / Paid buttons.
 *
 * The row leaves the list the moment it is tapped; if the save fails it comes
 * back with the reason, rather than vanishing as if it had worked.
 */
export function UnpaidItem({
  p,
  children,
}: {
  p: PackageRec;
  children: React.ReactNode;
}) {
  const [gone, setGone] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function mark(s: PaymentStatus, method?: PaymentMethod | null) {
    setError(null);
    setAsking(false);
    setGone(true);
    start(async () => {
      const r = await setPackagePayment(p.id, s, {
        clientId: p.clientId,
        ...(s === "paid" ? { method: method ?? null } : {}),
      });
      if (!r.ok) {
        setGone(false);
        setError(r.error);
      }
    });
  }

  if (gone) return null;
  return (
    <li className="lb-qrow">
      {children}
      <div className="lb-qacts">
        <button
          type="button"
          className="btn secondary small"
          onClick={() => mark("pending")}
        >
          Pending
        </button>
        <button
          type="button"
          className="btn small"
          onClick={() => setAsking(true)}
        >
          Paid
        </button>
      </div>
      {asking && (
        <MethodPicker
          onPick={(m) => mark("paid", m)}
          onCancel={() => setAsking(false)}
        />
      )}
      {error && <p className="notice err lb-qerr">{error}</p>}
    </li>
  );
}

/**
 * A row in the Running-out list with "Sell next".
 *
 * Asks first: there is no delete for a package, so a stray tap should not
 * be able to make one. Uses the standard price for the size when there is
 * one; a different price is changed on the card afterwards.
 */
export function SellNextItem({
  p,
  standardCents,
  children,
}: {
  p: PackageRec;
  standardCents: number | undefined;
  children: React.ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function sell() {
    setError(null);
    start(async () => {
      const r = await createPackage(p.clientId, { size: p.size });
      if (!r.ok) setError(r.error);
      else {
        setDone(true);
        setAsking(false);
      }
    });
  }

  const price =
    standardCents !== undefined ? money(standardCents) : "no price yet";
  const text = smsHref(p.clientPhone, nextPackageText(p.clientName, p.size));

  return (
    <li className="lb-qrow">
      {children}
      {done ? (
        <p className="notice ok lb-qerr">
          New {p.size}-lesson package added ({price}).{" "}
          <Link href={`/lessons/clients/${p.clientId}`}>Open &rarr;</Link>
        </p>
      ) : asking ? (
        <div className="lb-qask">
          <span>
            Sell {p.clientName} another {p.size}-lesson package at {price}?
          </span>
          <div className="lb-qacts">
            <button
              type="button"
              className="btn small"
              disabled={busy}
              onClick={sell}
            >
              {busy ? "Adding…" : "Yes, add it"}
            </button>
            <button
              type="button"
              className="btn secondary small"
              disabled={busy}
              onClick={() => setAsking(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="lb-qacts">
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setAsking(true)}
          >
            Sell next
          </button>
          {text && (
            // Opens Messages with the words filled in; Ian presses send.
            <a className="btn secondary small" href={text}>
              Text
            </a>
          )}
        </div>
      )}
      {error && <p className="notice err lb-qerr">{error}</p>}
    </li>
  );
}
