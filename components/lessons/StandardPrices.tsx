"use client";

import { useState, useTransition } from "react";
import { setStandardPrices } from "@/lib/lessons/actions";

// The usual price for each package size. Most packages sell at these; the
// few that do not are edited on the package itself. A new package picks up
// the standard price for its size, and the backlog below can fill old ones.

type Row = { key: number; size: string; dollars: string };

let nextKey = 0;
const row = (size: string, dollars: string): Row => ({
  key: nextKey++,
  size,
  dollars,
});

export default function StandardPrices({
  prices,
}: {
  prices: Record<number, number>;
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    const sizes = Object.keys(prices)
      .map(Number)
      .sort((a, b) => a - b);
    return sizes.length
      ? sizes.map((s) => row(String(s), String(prices[s] / 100)))
      : // Ian sells 3, 5 and 10; a single lesson is the fourth.
        ["1", "3", "5", "10"].map((s) => row(s, ""));
  });
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, start] = useTransition();

  function edit(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function save() {
    const out: Record<number, number | null> = {};
    for (const r of rows) {
      if (!r.size.trim()) continue;
      const size = Number(r.size.trim());
      if (!Number.isInteger(size) || size < 1 || size > 50) {
        setNote({ kind: "err", text: `"${r.size}" is not a package size.` });
        return;
      }
      if (size in out) {
        setNote({ kind: "err", text: `${size} lessons is listed twice.` });
        return;
      }
      const t = r.dollars.trim();
      out[size] = t === "" ? null : Number(t);
    }
    setNote(null);
    start(async () => {
      const res = await setStandardPrices(out);
      setNote(
        res.ok
          ? { kind: "ok", text: "Standard prices saved." }
          : { kind: "err", text: res.error },
      );
    });
  }

  return (
    <div className="card">
      <h2 className="lb-ftitle">Standard prices</h2>
      <p className="lb-fhint">
        Leave a price blank to have no standard for that size.
      </p>

      <div className="lb-plist">
        {rows.map((r) => (
          <div key={r.key} className="lb-prow">
            <label className="lb-num small">
              Lessons
              <input
                className="field"
                type="number"
                min="1"
                max="50"
                inputMode="numeric"
                value={r.size}
                onChange={(e) => edit(r.key, { size: e.target.value })}
              />
            </label>
            <label className="lb-num">
              Price $
              <input
                className="field"
                type="number"
                min="0"
                step="5"
                inputMode="decimal"
                value={r.dollars}
                onChange={(e) => edit(r.key, { dollars: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="btn ghost small lb-x"
              aria-label="Remove this size"
              onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {note && (
        <p
          className={note.kind === "ok" ? "notice ok" : "notice err"}
          style={{ marginTop: 10 }}
        >
          {note.text}
        </p>
      )}

      <div className="lb-actions" style={{ marginTop: 12 }}>
        <button className="btn small" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save prices"}
        </button>
        <button
          type="button"
          className="btn secondary small"
          onClick={() => setRows((rs) => [...rs, row("", "")])}
        >
          Add a size
        </button>
      </div>
    </div>
  );
}
