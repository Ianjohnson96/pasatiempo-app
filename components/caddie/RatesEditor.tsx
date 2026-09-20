"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRates } from "@/lib/caddie/actions";
import { HOLE_OPTIONS, LOOP_TYPES, type RateCard } from "@/lib/caddie/types";

// The caddie rate card.
//
// No money moves through this app — the player pays the caddie directly at the
// end of the loop. These figures exist so both sides see the same number before
// the loop goes out, which is the whole reason they need to be editable here
// rather than baked into the code.
//
// Stored in cents, edited in dollars. A blank or zero cell means "not set", and
// the board shows a dash rather than inventing a number.

interface Props {
  rates: RateCard;
}

type Draft = Record<string, Record<string, string>>;

function toDraft(rates: RateCard): Draft {
  const d: Draft = {};
  for (const type of LOOP_TYPES) {
    d[type] = {};
    for (const holes of HOLE_OPTIONS) {
      const cents = rates?.[type]?.[String(holes)];
      d[type][String(holes)] =
        typeof cents === "number" && cents > 0 ? (cents / 100).toFixed(0) : "";
    }
  }
  return d;
}

export default function RatesEditor({ rates }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => toDraft(rates));
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [saving, start] = useTransition();

  const set = (type: string, holes: string, value: string) =>
    setDraft((d) => ({ ...d, [type]: { ...d[type], [holes]: value } }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(rates));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    start(async () => {
      const cents: Record<string, Record<string, number>> = {};
      for (const [type, byHoles] of Object.entries(draft)) {
        cents[type] = {};
        for (const [holes, dollars] of Object.entries(byHoles)) {
          const n = Number(dollars);
          cents[type][holes] =
            dollars.trim() === "" || Number.isNaN(n) ? 0 : Math.round(n * 100);
        }
      }
      const res = await saveRates(cents);
      if (res.ok) {
        setNote({ kind: "ok", text: "Rates saved." });
        router.refresh();
      } else {
        setNote({ kind: "err", text: res.error });
      }
    });
  }

  const unset = LOOP_TYPES.filter((t) => !draft[t]?.["18"]?.trim()).length;

  return (
    <form onSubmit={submit}>
      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      {unset > 0 && (
        <p className="notice warn">
          {unset === LOOP_TYPES.length
            ? "No rates are set yet, so the dispatch board shows a dash instead of a figure."
            : `${unset} loop ${
                unset === 1 ? "type has" : "types have"
              } no 18-hole rate set.`}
        </p>
      )}

      <div className="card">
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Loop type</th>
              {HOLE_OPTIONS.map((h) => (
                <th key={h} style={{ textAlign: "left", width: 120 }}>
                  {h} holes
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LOOP_TYPES.map((type) => (
              <tr key={type}>
                <td style={{ whiteSpace: "nowrap" }}>{type}</td>
                {HOLE_OPTIONS.map((h) => (
                  <td key={h}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span className="muted">$</span>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        inputMode="numeric"
                        value={draft[type]?.[String(h)] ?? ""}
                        onChange={(e) => set(type, String(h), e.target.value)}
                        placeholder="—"
                        style={inputStyle}
                      />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p
          className="muted"
          style={{ fontSize: 13, marginTop: 14, marginBottom: 0 }}
        >
          Paid in person, player to caddie. The app never handles the money — it
          just makes sure both sides are looking at the same number. A blank cell
          shows as a dash on the board.
        </p>
      </div>

      <div
        style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}
      >
        <button className="btn" type="submit" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save rates"}
        </button>
        {dirty && !saving && (
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setDraft(toDraft(rates));
              setNote(null);
            }}
          >
            Discard changes
          </button>
        )}
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: 84,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 15,
};
