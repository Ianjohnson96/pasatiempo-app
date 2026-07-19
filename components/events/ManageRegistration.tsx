"use client";

import { useState } from "react";
import {
  cancelMyRegistration,
  dropMySlot,
  lookupMyRegistrations,
  type MyRegistration,
} from "@/lib/events/actions";

export default function ManageRegistration({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [regs, setRegs] = useState<MyRegistration[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNote("");
    setBusy(true);
    const res = await lookupMyRegistrations(slug, email);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setRegs(res.registrations ?? []);
  }

  async function cancelAll(regId: string) {
    if (!confirm("Cancel this registration?")) return;
    setBusy(true);
    const res = await cancelMyRegistration(slug, email, regId);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Could not cancel.");
    setNote("Your registration was cancelled.");
    setRegs((rs) => (rs ?? []).filter((r) => r.id !== regId));
  }

  async function dropDate(regId: string, slotId: string, label: string) {
    if (!confirm(`Remove ${label} from your registration?`)) return;
    setBusy(true);
    const res = await dropMySlot(slug, email, regId, slotId);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Could not update.");
    setNote(`Removed ${label}.`);
    setRegs((rs) =>
      (rs ?? [])
        .map((r) =>
          r.id === regId
            ? { ...r, slots: r.slots.filter((s) => s.id !== slotId) }
            : r,
        )
        .filter((r) => r.slots.length > 0 || true),
    );
  }

  if (!open) {
    return (
      <p style={{ textAlign: "center", marginTop: 18 }}>
        <button
          className="btn ghost small"
          onClick={() => setOpen(true)}
        >
          Already signed up? Manage or cancel your registration
        </button>
      </p>
    );
  }

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="section-title">Manage my registration</div>
      {error && <div className="notice err">{error}</div>}
      {note && <div className="notice ok">{note}</div>}

      <form onSubmit={lookup}>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Enter the email you registered with</label>
          <div className="row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <button
              className="btn"
              type="submit"
              disabled={busy}
              style={{ flex: "0 0 auto" }}
            >
              {busy ? "…" : "Find"}
            </button>
          </div>
        </div>
      </form>

      {regs && regs.length === 0 && (
        <p className="muted">No active registrations found for that email.</p>
      )}

      {regs && regs.length > 0 && (
        <div className="stack" style={{ marginTop: 8 }}>
          {regs.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>{r.name}</strong>
                {r.status === "waitlist" && (
                  <span className="pill" style={{ background: "#fff1df", color: "var(--warn)" }}>
                    waitlist
                  </span>
                )}
                {r.partySize > 1 && (
                  <span className="pill">party of {r.partySize}</span>
                )}
                <span className="spacer" style={{ flex: 1 }} />
                <button
                  className="btn small danger"
                  disabled={busy}
                  onClick={() => cancelAll(r.id)}
                >
                  Cancel all
                </button>
              </div>
              {r.slots.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {r.slots.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 0",
                        borderTop: "1px solid var(--line)",
                      }}
                    >
                      <span style={{ flex: 1 }}>{s.label}</span>
                      <button
                        className="btn small ghost"
                        disabled={busy}
                        onClick={() => dropDate(r.id, s.id, s.label)}
                      >
                        Can&apos;t make it
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
