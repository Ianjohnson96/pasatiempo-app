"use client";

import { useState } from "react";
import {
  cancelMyRegistration,
  lookupMyRegistrations,
  updateMyRegistration,
  type MyRegistration,
} from "@/lib/events/actions";
import { formatSlot } from "@/lib/events/format";
import type { EventRec } from "@/lib/events/types";

// Attendee self-service: look up by the email you registered with, then edit
// your own sign-up — dates, party size, guests, contact details — or cancel.
export default function ManageRegistration({ event }: { event: EventRec }) {
  const slug = event.slug;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [regs, setRegs] = useState<MyRegistration[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Draft state for the registration being edited
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dParty, setDParty] = useState("1");
  const [dGuests, setDGuests] = useState<string[]>([]);
  const [dSlots, setDSlots] = useState<string[]>([]);
  const [dAnswers, setDAnswers] = useState<Record<string, string>>({});

  async function refresh(quiet = false) {
    const res = await lookupMyRegistrations(slug, email);
    if (!res.ok) {
      if (!quiet) setError(res.error ?? "Something went wrong.");
      return;
    }
    setRegs(res.registrations ?? []);
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNote("");
    setBusy(true);
    await refresh();
    setBusy(false);
  }

  function startEdit(r: MyRegistration) {
    setError("");
    setNote("");
    setEditing(r.id);
    setDName(r.name);
    setDPhone(r.phone);
    setDParty(String(r.partySize));
    setDGuests(r.guestNames);
    setDSlots(r.slotIds);
    setDAnswers(r.answers);
  }

  async function saveEdit(regId: string) {
    setBusy(true);
    setError("");
    const size = Math.max(1, parseInt(dParty, 10) || 1);
    const res = await updateMyRegistration(slug, email, regId, {
      name: dName,
      phone: dPhone,
      partySize: size,
      guestNames: dGuests.slice(0, Math.max(0, size - 1)),
      slotIds: dSlots,
      answers: dAnswers,
    });
    if (!res.ok) {
      setBusy(false);
      setError(res.error ?? "Could not save your changes.");
      return;
    }
    await refresh(true);
    setBusy(false);
    setEditing(null);
    setNote("Your registration was updated. See you out there!");
  }

  async function cancelAll(regId: string) {
    if (!confirm("Cancel this registration entirely?")) return;
    setBusy(true);
    const res = await cancelMyRegistration(slug, email, regId);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Could not cancel.");
    setNote("Your registration was cancelled.");
    setRegs((rs) => (rs ?? []).filter((r) => r.id !== regId));
  }

  const size = Math.max(1, parseInt(dParty, 10) || 1);
  const guestCount = Math.max(0, size - 1);
  const isSlots = event.scheduleMode === "slots" && event.slots.length > 0;

  // ---- Big, obvious entry point ------------------------------------------
  if (!open) {
    return (
      <div className="manage-cta">
        <div className="mc-text">
          <div className="mc-title">Already signed up?</div>
          <p>
            Change your dates, update your party or guests, or cancel &mdash;
            all you need is the email you registered with.
          </p>
        </div>
        <button className="btn block mc-btn" onClick={() => setOpen(true)}>
          Manage my registration
        </button>
      </div>
    );
  }

  return (
    <div className="card manage-open" style={{ marginTop: 22 }}>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Manage my registration</h2>
          <div className="sub">
            Enter the email you signed up with to find your registration.
          </div>
        </div>
        <span className="spacer" />
        <button className="btn ghost small" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {error && <div className="notice err">{error}</div>}
      {note && <div className="notice ok">{note}</div>}

      <form onSubmit={lookup}>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Your email</label>
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
              {busy ? "…" : "Find my registration"}
            </button>
          </div>
        </div>
      </form>

      {regs && regs.length === 0 && (
        <p className="muted">
          No active registration found for that email. Double-check the address,
          or sign up above.
        </p>
      )}

      {regs?.map((r) => (
        <div key={r.id} className="mc-reg">
          {editing === r.id ? (
            <>
              <div className="section-title">Edit your registration</div>

              <div className="row">
                <div className="field">
                  <label>Name</label>
                  <input value={dName} onChange={(e) => setDName(e.target.value)} />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input value={dPhone} onChange={(e) => setDPhone(e.target.value)} />
                </div>
              </div>

              {event.allowGuests && (
                <div className="field">
                  <label>
                    Total in your party (including you)
                    {event.maxGuests != null && (
                      <span className="hint" style={{ display: "inline", marginLeft: 6 }}>
                        up to {event.maxGuests} guest(s)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={event.maxGuests != null ? event.maxGuests + 1 : undefined}
                    value={dParty}
                    onChange={(e) => setDParty(e.target.value)}
                    style={{ maxWidth: 160 }}
                  />
                </div>
              )}

              {event.allowGuests && event.collectGuestNames && guestCount > 0 && (
                <div className="field">
                  <label>Guest names</label>
                  {Array.from({ length: guestCount }).map((_, i) => (
                    <input
                      key={i}
                      style={{ marginBottom: 6 }}
                      placeholder={`Guest ${i + 1}`}
                      value={dGuests[i] ?? ""}
                      onChange={(e) => {
                        const next = [...dGuests];
                        next[i] = e.target.value;
                        setDGuests(next);
                      }}
                    />
                  ))}
                </div>
              )}

              {isSlots && (
                <div className="field">
                  <label>Which dates are you coming to?</label>
                  <div className="hint" style={{ marginTop: -2 }}>
                    Check the ones you&apos;ll attend, uncheck any you&apos;ll miss.
                  </div>
                  <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                    {event.slots.map((s) => (
                      <label className="check" key={s.id}>
                        <input
                          type="checkbox"
                          checked={dSlots.includes(s.id)}
                          onChange={() =>
                            setDSlots((cur) =>
                              cur.includes(s.id)
                                ? cur.filter((x) => x !== s.id)
                                : [...cur, s.id],
                            )
                          }
                        />
                        <span>{formatSlot(s)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {event.customFields.length > 0 && (
                <div className="field">
                  {event.customFields.map((f) => (
                    <div key={f.id} style={{ marginBottom: 8 }}>
                      <label>{f.label}</label>
                      <input
                        value={dAnswers[f.id] ?? ""}
                        onChange={(e) =>
                          setDAnswers({ ...dAnswers, [f.id]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn" disabled={busy} onClick={() => saveEdit(r.id)}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Never mind
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 17 }}>{r.name}</strong>
                {r.status === "waitlist" && (
                  <span className="pill" style={{ background: "#fff1df", color: "var(--warn)" }}>
                    waitlist
                  </span>
                )}
                {r.partySize > 1 && <span className="pill">party of {r.partySize}</span>}
              </div>

              {r.slots.length > 0 && (
                <ul className="mc-dates">
                  {r.slots.map((s) => (
                    <li key={s.id}>{s.label}</li>
                  ))}
                </ul>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn" disabled={busy} onClick={() => startEdit(r)}>
                  Change my registration
                </button>
                <button
                  className="btn danger small"
                  disabled={busy}
                  onClick={() => cancelAll(r.id)}
                >
                  Cancel registration
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
