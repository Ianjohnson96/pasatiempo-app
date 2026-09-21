"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveWaterfall } from "@/lib/caddie/actions";
import type { Waterfall } from "@/lib/caddie/types";

// When an offer widens down the ladder.
//
// Banded by how soon the loop is, because urgency should compress seniority
// rather than override it: a senior caddie still gets first refusal on
// tomorrow morning, just not for two hours when the shop needs an answer
// tonight. Every number here belongs to the shop, not to the code.

export default function WaterfallEditor({
  current,
  tierCount,
}: {
  current: Waterfall;
  tierCount: number;
}) {
  const router = useRouter();
  const [w, setW] = useState<Waterfall>(current);
  const [busy, start] = useTransition();
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const set = <K extends keyof Waterfall>(k: K, v: Waterfall[K]) =>
    setW((prev) => ({ ...prev, [k]: v }));

  const dirty = JSON.stringify(w) !== JSON.stringify(current);

  return (
    <section style={{ marginTop: 30 }}>
      <h2 className="section-title">Widening a tier offer</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        When a loop is offered to a tier and nobody takes it, this decides how
        long before it reaches the next tier down. It only ever widens one tier
        at a time, and never a loop somebody has already accepted.
      </p>

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      {tierCount < 2 && (
        <p className="notice warn">
          There is only one tier, so there is nothing to widen into. Add another
          tier first.
        </p>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            fontSize: 15,
          }}
        >
          <input
            type="checkbox"
            checked={w.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>
            <strong>Widen automatically.</strong> Off means an offer stays with
            the tier you chose until you widen it yourself.
          </span>
        </label>

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 16,
            opacity: w.enabled ? 1 : 0.5,
          }}
        >
          <Band
            label="Teeing off soon"
            hours={w.urgentWithinHours}
            minutes={w.urgentMinutes}
            disabled={!w.enabled}
            onHours={(v) => set("urgentWithinHours", v)}
            onMinutes={(v) => set("urgentMinutes", v)}
          />
          <Band
            label="Coming up"
            hours={w.soonWithinHours}
            minutes={w.soonMinutes}
            disabled={!w.enabled}
            onHours={(v) => set("soonWithinHours", v)}
            onMinutes={(v) => set("soonMinutes", v)}
          />

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ minWidth: 132, fontSize: 15 }}>
              Anything further out
            </span>
            <span className="muted" style={{ fontSize: 13 }}>
              each tier gets
            </span>
            <input
              type="number"
              min={1}
              disabled={!w.enabled}
              value={w.laterMinutes}
              onChange={(e) => set("laterMinutes", Number(e.target.value))}
              style={{ ...inputStyle, width: 84 }}
            />
            <span className="muted" style={{ fontSize: 13 }}>
              minutes
            </span>
          </div>
        </div>

        <p
          className="muted"
          style={{ fontSize: 13, marginTop: 16, marginBottom: 0 }}
        >
          Widening happens on the housekeeping run, so the real delay is at most
          one run longer than the number set here.
        </p>
      </div>

      <div
        style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}
      >
        <button
          className="btn"
          disabled={busy || !dirty}
          onClick={() =>
            start(async () => {
              setNote(null);
              const res = await saveWaterfall(w);
              if (res.ok) {
                setNote({ kind: "ok", text: "Escalation rules saved." });
                router.refresh();
              } else {
                setNote({ kind: "err", text: res.error });
              }
            })
          }
        >
          {busy ? "Saving…" : "Save rules"}
        </button>
        {dirty && !busy && (
          <button className="btn ghost small" onClick={() => setW(current)}>
            Discard changes
          </button>
        )}
      </div>
    </section>
  );
}

function Band({
  label,
  hours,
  minutes,
  disabled,
  onHours,
  onMinutes,
}: {
  label: string;
  hours: number;
  minutes: number;
  disabled: boolean;
  onHours: (v: number) => void;
  onMinutes: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span style={{ minWidth: 132, fontSize: 15 }}>{label}</span>
      <span className="muted" style={{ fontSize: 13 }}>
        within
      </span>
      <input
        type="number"
        min={1}
        disabled={disabled}
        value={hours}
        onChange={(e) => onHours(Number(e.target.value))}
        style={{ ...inputStyle, width: 72 }}
      />
      <span className="muted" style={{ fontSize: 13 }}>
        hours — each tier gets
      </span>
      <input
        type="number"
        min={1}
        disabled={disabled}
        value={minutes}
        onChange={(e) => onMinutes(Number(e.target.value))}
        style={{ ...inputStyle, width: 84 }}
      />
      <span className="muted" style={{ fontSize: 13 }}>
        minutes
      </span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 15,
};
