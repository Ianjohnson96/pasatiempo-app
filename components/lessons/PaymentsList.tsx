"use client";

import { useMemo, useState, useTransition } from "react";
import { setPaymentKind } from "@/lib/lessons/actions";
import {
  formatDay,
  money,
  PAYMENT_KIND_LABEL,
  type PaymentKind,
  type PaymentRec,
} from "@/lib/lessons/types";

// Every Venmo payment that came in, and what it was for.
//
// Rows arrive pre-guessed by the importer and are labelled as guesses. Tapping
// any button marks the row answered, which is what stops a later statement
// import replacing Ian's decision with a fresh guess. Unanswered rows sort
// first, because this screen exists to be emptied.

const KINDS: PaymentKind[] = ["lesson", "clinic", "not_lesson"];
type Filter = "todo" | "lesson" | "clinic" | "not_lesson" | "all";

export default function PaymentsList({
  payments,
  clients,
}: {
  payments: PaymentRec[];
  clients: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<Filter>("todo");
  const [q, setQ] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return payments.filter((p) => {
      if (filter === "todo" && p.decidedBy !== "auto") return false;
      if (filter !== "todo" && filter !== "all" && p.kind !== filter) return false;
      if (!needle) return true;
      return (
        p.payerName.toLowerCase().includes(needle) ||
        p.note.toLowerCase().includes(needle) ||
        (p.clientName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [payments, filter, q]);

  const sums = useMemo(() => {
    const s = { todo: 0, lesson: 0, clinic: 0, not_lesson: 0 };
    for (const p of payments) {
      if (p.decidedBy === "auto") s.todo += p.amountCents;
      if (p.kind !== "unclassified") s[p.kind] += p.amountCents;
    }
    return s;
  }, [payments]);

  const todoCount = payments.filter((p) => p.decidedBy === "auto").length;

  return (
    <>
      <div className="fin-stats" style={{ marginBottom: 14 }}>
        <div className="fin-stat strong">
          <strong>{todoCount}</strong>
          <span>to sort &middot; {money(sums.todo)}</span>
        </div>
        <div className="fin-stat">
          <strong>{money(sums.lesson)}</strong>
          <span>lesson income</span>
        </div>
        <div className="fin-stat">
          <strong>{money(sums.clinic)}</strong>
          <span>clinics</span>
        </div>
        <div className="fin-stat">
          <strong>{money(sums.not_lesson)}</strong>
          <span>not teaching</span>
        </div>
      </div>

      <div className="lb-actions">
        <div className="seg">
          {(["todo", "lesson", "clinic", "not_lesson", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              className={f === filter ? "segbtn on" : "segbtn"}
              onClick={() => setFilter(f)}
            >
              {f === "todo" ? "To sort" : f === "all" ? "All" : PAYMENT_KIND_LABEL[f]}
            </button>
          ))}
        </div>
        <input
          className="field"
          type="search"
          placeholder="Find a payer or note"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 180px", minWidth: 0 }}
        />
      </div>

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>{note.text}</p>
      )}

      <p className="muted" style={{ fontSize: 13 }}>
        {shown.length} payment{shown.length === 1 ? "" : "s"}
        {filter === "todo" &&
          todoCount > 0 &&
          " · these are my guesses, not your answers"}
      </p>

      {shown.length === 0 && (
        <p className="empty">
          {filter === "todo" ? "Everything is sorted." : "Nothing matches that."}
        </p>
      )}

      <div className="stack" style={{ marginTop: 10 }}>
        {shown.map((p) => (
          <PaymentRow key={p.id} p={p} clients={clients} onNote={setNote} />
        ))}
      </div>
    </>
  );
}

function PaymentRow({
  p,
  clients,
  onNote,
}: {
  p: PaymentRec;
  clients: { id: string; name: string }[];
  onNote: (n: { kind: "ok" | "err"; text: string }) => void;
}) {
  const [clientId, setClientId] = useState(p.clientId ?? "");
  const [busy, start] = useTransition();

  function save(kind: PaymentKind, cid?: string) {
    start(async () => {
      const r = await setPaymentKind(p.id, kind, {
        clientId: kind === "lesson" ? (cid ?? clientId) || null : null,
      });
      if (!r.ok) onNote({ kind: "err", text: r.error });
    });
  }

  return (
    <div className="card">
      <div className="lb-head">
        <div style={{ minWidth: 0 }}>
          <strong>{p.payerName}</strong>
          {p.decidedBy === "auto" && (
            <span className="badge draft" style={{ marginLeft: 8 }}>
              guess
            </span>
          )}
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {formatDay(p.paidOn)}
            {p.clientName && ` · for ${p.clientName}`}
          </div>
          {p.note && (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {p.note}
            </div>
          )}
        </div>
        <div style={{ fontWeight: 700 }}>{money(p.amountCents)}</div>
      </div>

      <div
        className="row"
        style={{ gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}
      >
        <div className="seg">
          {KINDS.map((k) => (
            <button
              key={k}
              className={k === p.kind ? "segbtn on" : "segbtn"}
              disabled={busy}
              onClick={() => save(k)}
            >
              {PAYMENT_KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {/* Only a lesson payment belongs to a client. */}
        {p.kind === "lesson" && (
          <select
            className="field"
            value={clientId}
            disabled={busy}
            onChange={(e) => {
              setClientId(e.target.value);
              save("lesson", e.target.value);
            }}
            style={{ flex: "1 1 180px", minWidth: 0 }}
          >
            <option value="">Who was it for?</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
