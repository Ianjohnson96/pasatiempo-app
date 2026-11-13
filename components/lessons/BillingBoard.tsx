"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  billLessons,
  unbillSingles,
  type BillItem,
} from "@/lib/lessons/actions";
import { defaultBillStatus, parseDollars } from "@/lib/lessons/calc";
import {
  formatDay,
  formatWhen,
  type BillingClient,
  type BillingData,
  type PackageOption,
} from "@/lib/lessons/types";
import BillChoices, { type BillChoiceValue } from "./BillChoices";
import CatchUpList from "./CatchUpList";

// One screen for every lesson on no bill yet. A row per client, pre-filled
// with what they paid last time (or the member / guest rate and their usual
// method), so most clients are one tap: each lesson becomes its own single,
// never bundled. Below it, the catch-up list: every bill still unpaid,
// unpriced or missing how it was paid.

type Undo = { text: string; run: () => Promise<void> };

export default function BillingBoard({
  data,
  packages,
}: {
  data: BillingData;
  /** Every package (not single), for Catch up's "part of a package?". */
  packages: PackageOption[];
}) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [, start] = useTransition();
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  const rows = data.clients.filter((c) => !done.has(c.clientId));
  const left = rows.reduce((t, c) => t + c.lessons.length, 0);

  return (
    <>
      {undo ? (
        <div className="notice ok lb-undo" role="status">
          <span>{undo.text}</span>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              const run = undo.run;
              setUndo(null);
              start(run);
            }}
          >
            Undo
          </button>
        </div>
      ) : (
        note && (
          <p className={note.ok ? "notice ok" : "notice err"}>{note.text}</p>
        )
      )}

      <div className="lb-sechead">
        <h2 className="section-title">Not billed</h2>
        <span className="lb-sub">
          {left} lesson{left === 1 ? "" : "s"} · {rows.length} client
          {rows.length === 1 ? "" : "s"}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="empty">Every lesson is on a bill.</p>
      ) : (
        <div className="stack">
          {rows.map((c) => (
            <ClientRow
              key={c.clientId}
              c={c}
              onBilled={(n, ids) => {
                setDone((s) => new Set([...s, c.clientId]));
                setNote(null);
                setUndo({
                  text: `Billed ${n} lesson${n === 1 ? "" : "s"} for ${c.name}.`,
                  run: async () => {
                    const r = await unbillSingles(c.clientId, ids);
                    if (!r.ok) {
                      setNote({ ok: false, text: r.error });
                      return;
                    }
                    setDone((s) => {
                      const next = new Set(s);
                      next.delete(c.clientId);
                      return next;
                    });
                    setNote({ ok: true, text: `${c.name}: back to not billed.` });
                  },
                });
              }}
              onError={(text) => setNote({ ok: false, text })}
            />
          ))}
        </div>
      )}

      <CatchUpList bills={data.catchUp} packages={packages} />
    </>
  );
}

function ClientRow({
  c,
  onBilled,
  onError,
}: {
  c: BillingClient;
  onBilled: (n: number, packageIds: string[]) => void;
  onError: (text: string) => void;
}) {
  const [choice, setChoice] = useState<BillChoiceValue>({
    dollars:
      c.defaults.priceCents === null ? "" : String(c.defaults.priceCents / 100),
    method: c.defaults.method,
    status: "auto",
  });
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(c.lessons.map((l) => l.id)),
  );
  const [busy, start] = useTransition();
  const taught = c.lessons.filter((l) => l.status === "completed").length;
  const booked = c.lessons.length - taught;
  const first = c.lessons[0];
  const last = c.lessons[c.lessons.length - 1];

  function bill() {
    const parsed = parseDollars(choice.dollars);
    if (!parsed.ok) {
      onError("That is not a valid amount.");
      return;
    }
    const items: BillItem[] = c.lessons
      .filter((l) => picked.has(l.id))
      .map((l) => {
        const status =
          choice.status === "auto" ? defaultBillStatus(l.status) : choice.status;
        return {
          lessonId: l.id,
          priceCents: parsed.cents,
          status,
          method: status === "unpaid" ? null : choice.method,
        };
      });
    start(async () => {
      const r = await billLessons(c.clientId, items);
      if (!r.ok) onError(r.error);
      else onBilled(r.value.billed, r.value.packageIds);
    });
  }

  const n = picked.size;
  // No amount, no bill: a "paid" single worth nothing would hide the gap.
  const noAmount = choice.dollars.trim() === "";
  return (
    <div className="card lb-billrow">
      <div>
        <Link href={`/lessons/clients/${c.clientId}`} className="lb-name">
          {c.name}
        </Link>
        {c.isMember && (
          <span className="badge gray" style={{ marginLeft: 8 }}>
            Member
          </span>
        )}
        <div className="lb-sub">
          {c.lessons.length} not billed · {formatDay(first.startsAt)}
          {c.lessons.length > 1 && ` – ${formatDay(last.startsAt)}`}
          {booked > 0 && ` · ${booked} booked`}
        </div>
      </div>

      {c.roomIn.length > 0 && (
        // These might be the rest of a series, not singles.
        <p className="notice warn" style={{ margin: "10px 0 0" }}>
          Has room in{" "}
          {c.roomIn.map((p) => `${p.title} (${p.left} left)`).join(", ")} &mdash;
          if these belong to it,{" "}
          <Link href={`/lessons/clients/${c.clientId}`}>move them there</Link>{" "}
          instead.
        </p>
      )}

      <BillChoices value={choice} onChange={setChoice} disabled={busy} />

      <details className="lb-dates">
        <summary>
          Choose lessons{" "}
          <span className="muted">
            ({n} of {c.lessons.length})
          </span>
        </summary>
        <ul className="lb-dlist">
          {c.lessons.map((l) => (
            <li key={l.id}>
              <label className="lb-billpick">
                <input
                  type="checkbox"
                  checked={picked.has(l.id)}
                  onChange={() =>
                    setPicked((s) => {
                      const next = new Set(s);
                      if (next.has(l.id)) next.delete(l.id);
                      else next.add(l.id);
                      return next;
                    })
                  }
                />
                <span className="lb-dwhen">
                  {formatWhen(l.startsAt)}
                  {l.titleRaw && (
                    <span className="lb-sub" style={{ display: "block" }}>
                      {l.titleRaw}
                    </span>
                  )}
                </span>
                <span className="lb-dstate">
                  {l.status === "completed" ? "taught" : "booked"}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </details>

      {noAmount && (
        <p className="lb-fhint" style={{ margin: "8px 0 0" }}>
          Enter an amount &mdash; or set the single rates on{" "}
          <Link href="/lessons/prices">Prices</Link> to fill every row.
        </p>
      )}
      <div className="lb-actions" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn small"
          disabled={busy || n === 0 || noAmount}
          onClick={bill}
        >
          {busy
            ? "Billing…"
            : `Bill ${n === c.lessons.length ? "all " : ""}${n} as single${n === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
