"use client";

import { useState, useTransition } from "react";
import { setSingleRates } from "@/lib/lessons/actions";
import type { SingleRates as Rates } from "@/lib/lessons/types";

// What one lesson on its own costs: a member rate and a guest rate. A new
// single takes the one that fits the client (ticked "Club member" or not);
// any single's price can still be changed on its own card.

const toField = (c: number | undefined) => (c === undefined ? "" : String(c / 100));

export default function SingleRates({ rates }: { rates: Rates }) {
  const [member, setMember] = useState(toField(rates.member));
  const [guest, setGuest] = useState(toField(rates.guest));
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  function save() {
    setNote(null);
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    start(async () => {
      const r = await setSingleRates({ member: num(member), guest: num(guest) });
      setNote(
        r.ok
          ? { ok: true, text: "Single rates saved." }
          : { ok: false, text: r.error },
      );
    });
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h2 className="lb-ftitle">Single lesson</h2>
      <p className="lb-fhint">
        For lessons billed on their own. Members are clients ticked &ldquo;Club
        member&rdquo; under Details.
      </p>
      <div className="lb-controls" style={{ marginTop: 4 }}>
        <label className="lb-num">
          Member $
          <input
            className="field"
            type="number"
            min="0"
            step="5"
            inputMode="decimal"
            value={member}
            onChange={(e) => setMember(e.target.value)}
          />
        </label>
        <label className="lb-num">
          Guest $
          <input
            className="field"
            type="number"
            min="0"
            step="5"
            inputMode="decimal"
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
          />
        </label>
        <button className="btn small" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save rates"}
        </button>
      </div>
      {note && (
        <p
          className={note.ok ? "notice ok" : "notice err"}
          style={{ marginTop: 10 }}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
