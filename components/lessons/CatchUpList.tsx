"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { saveCatchUp, type CatchUpItem } from "@/lib/lessons/actions";
import { parseDollars } from "@/lib/lessons/calc";
import { seriesPaidOn } from "@/lib/lessons/catchup";
import { METHOD_LABEL } from "@/lib/lessons/income";
import {
  formatDay,
  packageTitle,
  PAYMENT_LABEL,
  type CatchUpBill,
  type PaymentStatus,
  type PayMethod,
} from "@/lib/lessons/types";

// Every bill that stops the money adding up - unpaid, pending, or paid with
// no price or no method - each with its own price, status, method and day.
// Tick a few and "Set paid" fills them in one go; nothing is written until
// Save, so a slip costs an edit, not a correction.
//
// A series is dated paid on its first lesson: it was paid up front, and
// entering last spring's packages today must not put that money in November.

type Draft = {
  dollars: string;
  status: PaymentStatus;
  method: PayMethod | "";
  paidOn: string;
};

const METHODS = Object.keys(METHOD_LABEL) as PayMethod[];

function startDraft(b: CatchUpBill): Draft {
  return {
    dollars: b.priceCents === null ? "" : String(b.priceCents / 100),
    status: b.paymentStatus,
    method: (b.paymentMethod as PayMethod | null) ?? "",
    paidOn: seriesPaidOn(b, b.firstLessonOn) ?? "",
  };
}

function same(a: Draft, b: Draft): boolean {
  return (
    a.dollars === b.dollars &&
    a.status === b.status &&
    a.method === b.method &&
    a.paidOn === b.paidOn
  );
}

export default function CatchUpList({ bills }: { bills: CatchUpBill[] }) {
  const start0 = useMemo(
    () => new Map(bills.map((b) => [b.id, startDraft(b)])),
    [bills],
  );
  const [drafts, setDrafts] = useState<Map<string, Draft>>(start0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkMethod, setBulkMethod] = useState<PayMethod>("venmo");
  const [q, setQ] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  // The server sends a fresh list after a save; start again from it.
  const [seen, setSeen] = useState(bills);
  if (seen !== bills) {
    setSeen(bills);
    setDrafts(start0);
    setPicked(new Set());
  }

  const needle = q.trim().toLowerCase();
  const shown = bills.filter(
    (b) => !needle || b.clientName.toLowerCase().includes(needle),
  );
  const draftOf = (b: CatchUpBill) => drafts.get(b.id) ?? startDraft(b);
  const changed = bills.filter((b) => !same(draftOf(b), start0.get(b.id)!));

  function edit(id: string, patch: Partial<Draft>) {
    setDrafts((m) => {
      const next = new Map(m);
      const b = bills.find((x) => x.id === id)!;
      next.set(id, { ...(m.get(id) ?? startDraft(b)), ...patch });
      return next;
    });
  }

  function setPaid() {
    for (const id of picked) {
      const b = bills.find((x) => x.id === id);
      if (!b) continue;
      const d = draftOf(b);
      edit(id, {
        status: "paid",
        method: d.method || bulkMethod,
        // Keep a day already chosen; otherwise the first lesson of the series.
        paidOn: d.paidOn || (seriesPaidOn(b, b.firstLessonOn) ?? ""),
      });
    }
    setPicked(new Set());
  }

  function save() {
    const items: CatchUpItem[] = [];
    for (const b of changed) {
      const d = draftOf(b);
      const price = parseDollars(d.dollars);
      if (!price.ok) {
        setNote({ ok: false, text: `${b.clientName}: "${d.dollars}" is not an amount.` });
        return;
      }
      if (d.status === "paid" && !d.paidOn) {
        setNote({ ok: false, text: `${b.clientName}: say which day it was paid.` });
        return;
      }
      items.push({
        packageId: b.id,
        priceCents: price.cents,
        status: d.status,
        method: d.status === "unpaid" || !d.method ? null : d.method,
        paidOn: d.status === "paid" ? d.paidOn : null,
      });
    }
    setNote(null);
    start(async () => {
      const r = await saveCatchUp(items);
      if (!r.ok) setNote({ ok: false, text: r.error });
      else setNote({ ok: true, text: `Saved ${r.value} bill${r.value === 1 ? "" : "s"}.` });
    });
  }

  return (
    <>
      <div className="lb-sechead">
        <h2 className="section-title">Catch up</h2>
        <span className="lb-sub">
          {bills.length} bill{bills.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="lb-fhint" style={{ marginTop: 0 }}>
        Unpaid, pending, or paid with no price or no payment type. A series is
        dated paid on its first lesson.
      </p>
      {note && <p className={note.ok ? "notice ok" : "notice err"}>{note.text}</p>}

      {bills.length === 0 ? (
        <p className="empty">Nothing to catch up &mdash; every bill is priced and paid.</p>
      ) : (
        <div className="card">
          <div className="lb-billbar">
            <input
              className="field"
              type="search"
              placeholder="Find a client"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ flex: "1 1 160px", minWidth: 0 }}
            />
          </div>
          <div className="lb-billbar">
            <label className="lb-billpick">
              <input
                type="checkbox"
                checked={picked.size > 0 && picked.size === shown.length}
                onChange={(e) =>
                  setPicked(e.target.checked ? new Set(shown.map((b) => b.id)) : new Set())
                }
              />
              <span>All</span>
            </label>
            <select
              className="field"
              value={bulkMethod}
              onChange={(e) => setBulkMethod(e.target.value as PayMethod)}
              aria-label="Paid with"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn secondary small"
              disabled={busy || picked.size === 0}
              onClick={setPaid}
            >
              Set {picked.size} paid
            </button>
            <button
              type="button"
              className="btn small"
              disabled={busy || changed.length === 0}
              onClick={save}
            >
              {busy ? "Saving…" : `Save ${changed.length}`}
            </button>
          </div>

          <ul className="lb-flist">
            {shown.map((b) => {
              const d = draftOf(b);
              const dirty = !same(d, start0.get(b.id)!);
              return (
                <li key={b.id} className="lb-catch" data-dirty={dirty || undefined}>
                  <label className="lb-billpick">
                    <input
                      type="checkbox"
                      checked={picked.has(b.id)}
                      onChange={() =>
                        setPicked((s) => {
                          const next = new Set(s);
                          if (next.has(b.id)) next.delete(b.id);
                          else next.add(b.id);
                          return next;
                        })
                      }
                      aria-label={`Pick ${b.clientName}`}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={`/lessons/clients/${b.clientId}`}
                        className="lb-name"
                      >
                        {b.clientName}
                      </Link>
                      <span className="lb-sub" style={{ display: "block" }}>
                        {packageTitle(b)}
                        {b.kind === "package" &&
                          b.firstLessonOn &&
                          ` · first lesson ${formatDay(b.firstLessonOn)}`}
                        {" · "}
                        {b.gaps.join(", ")}
                      </span>
                    </span>
                  </label>

                  <div className="lb-catch-fields">
                    <label>
                      <span className="lb-led-lbl">Price $</span>
                      <input
                        className="field"
                        inputMode="decimal"
                        value={d.dollars}
                        placeholder="—"
                        onChange={(e) => edit(b.id, { dollars: e.target.value })}
                        disabled={busy}
                      />
                    </label>
                    <label>
                      <span className="lb-led-lbl">Status</span>
                      <select
                        className="field"
                        value={d.status}
                        onChange={(e) => {
                          const status = e.target.value as PaymentStatus;
                          edit(b.id, {
                            status,
                            paidOn:
                              status === "paid"
                                ? d.paidOn || (seriesPaidOn(b, b.firstLessonOn) ?? "")
                                : d.paidOn,
                          });
                        }}
                        disabled={busy}
                      >
                        {(["unpaid", "pending", "paid"] as PaymentStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {PAYMENT_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="lb-led-lbl">Paid with</span>
                      <select
                        className="field"
                        value={d.method}
                        onChange={(e) =>
                          edit(b.id, { method: e.target.value as PayMethod | "" })
                        }
                        disabled={busy || d.status === "unpaid"}
                      >
                        <option value="">Not recorded</option>
                        {METHODS.map((m) => (
                          <option key={m} value={m}>
                            {METHOD_LABEL[m]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {d.status === "paid" && (
                      <label>
                        <span className="lb-led-lbl">Paid on</span>
                        <input
                          className="field"
                          type="date"
                          value={d.paidOn}
                          onChange={(e) => edit(b.id, { paidOn: e.target.value })}
                          disabled={busy}
                        />
                      </label>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
