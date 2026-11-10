"use client";

import { useState } from "react";
import {
  cancelMyRegistration,
  lookupMyRegistrations,
  updateMyRegistration,
  type MyRegistration,
} from "@/lib/events/actions";
import { answerText, formatSlot } from "@/lib/events/format";
import type { EventRec } from "@/lib/events/types";
import type { TeamInput } from "@/lib/events/tournament";
import TeamEntryForm from "@/components/events/TeamEntryForm";

const ROLE_LABEL = ["Member", "Guest"];

// One tournament team, as its own member sees it: a summary with "Edit team"
// and "Cancel entry". Editing reuses the entry form, prefilled, with the
// member's email locked. Answers stay as Answer (string | string[]) throughout.
export function TeamRegistration({
  event,
  reg,
  busy,
  onSave,
  onCancel,
}: {
  event: EventRec;
  reg: MyRegistration;
  busy: boolean;
  onSave: (team: TeamInput, phone: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const players = reg.players ?? [];
  const playerFields = event.customFields.filter((f) => f.scope === "player");
  const teamFields = event.customFields.filter((f) => f.scope === "team");

  if (editing) {
    return (
      <>
        <div className="section-title">Edit your team</div>
        <TeamEntryForm
          event={event}
          seats={{ remaining: null, full: false, slots: [] }}
          mode="public"
          lockMemberEmail
          initial={{
            team: { players, teamAnswers: reg.answers },
            phone: reg.phone,
          }}
          onSubmit={async (team, phone) => {
            const err = await onSave(team, phone);
            if (!err) setSaved(true);
            return err;
          }}
        />
        <div style={{ marginTop: 10 }}>
          <button
            className="btn secondary"
            onClick={() => {
              setEditing(false);
              setSaved(false);
            }}
          >
            {saved ? "Back to my entry" : "Never mind"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 17 }}>{event.title}</strong>
        {reg.status === "waitlist" && (
          <span className="pill" style={{ background: "#fff1df", color: "var(--warn)" }}>
            waitlist
          </span>
        )}
      </div>

      <div className="team-grid" style={{ marginTop: 10 }}>
        {players.map((p, i) => (
          <div className="review-player" key={i}>
            <div className="player-card-kicker">{ROLE_LABEL[i] ?? "Player"}</div>
            <div className="review-name">{p.name}</div>
            <dl className="review-list">
              <SummaryRow label="Email" value={p.email} />
              <SummaryRow label="GHIN #" value={p.ghin} />
              {i === 0 && reg.phone && <SummaryRow label="Phone" value={reg.phone} />}
              {playerFields.map((f) => (
                <SummaryRow
                  key={f.id}
                  label={f.label}
                  value={answerText(p.answers[f.id])}
                />
              ))}
            </dl>
          </div>
        ))}
      </div>
      {teamFields.length > 0 && (
        <div className="review-player review-teamqs">
          <div className="player-card-kicker">Team</div>
          <dl className="review-list">
            {teamFields.map((f) => (
              <SummaryRow
                key={f.id}
                label={f.label}
                value={answerText(reg.answers[f.id])}
              />
            ))}
          </dl>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn" disabled={busy} onClick={() => setEditing(true)}>
          Edit team
        </button>
        <button className="btn danger small" disabled={busy} onClick={onCancel}>
          Cancel entry
        </button>
      </div>
    </>
  );
}

// A long label (usually an admin's question) sits over its answer instead of
// squeezing into the label column.
const LONG_LABEL = 24;

function SummaryRow({ label, value }: { label: string; value: string }) {
  const v = value.trim();
  return (
    <div className={`review-row${label.length > LONG_LABEL ? " long" : ""}`}>
      <dt>{label}</dt>
      <dd>{v || <span className="muted">—</span>}</dd>
    </div>
  );
}

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
    setDAnswers(
      Object.fromEntries(
        Object.entries(r.answers).map(([k, v]) => [k, answerText(v)]),
      ),
    );
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

  // Tournament team edit: returns an error message, or null once saved.
  async function saveTeam(
    r: MyRegistration,
    team: TeamInput,
    phone: string,
  ): Promise<string | null> {
    const res = await updateMyRegistration(slug, email, r.id, {
      name: team.players[0]?.name ?? r.name,
      phone,
      partySize: 1,
      guestNames: [],
      slotIds: [],
      answers: {},
      team,
    });
    if (!res.ok) return res.error ?? "Could not save your changes.";
    await refresh(true);
    return null;
  }

  async function cancelAll(regId: string) {
    const team = event.type === "tournament";
    if (!confirm(team ? "Cancel this entry entirely?" : "Cancel this registration entirely?"))
      return;
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
          {event.type === "tournament" && r.players ? (
            <TeamRegistration
              event={event}
              reg={r}
              busy={busy}
              onSave={(team, phone) => saveTeam(r, team, phone)}
              onCancel={() => cancelAll(r.id)}
            />
          ) : editing === r.id ? (
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
