"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRegistration } from "@/lib/events/actions";
import { formatSlot } from "@/lib/events/format";
import type { EventRec, RegStatus, Registration } from "@/lib/events/types";

// Staff editor for an existing sign-up. Lets the golf shop fix anything a
// member got wrong (or phoned in): name, contact, party size, guest names,
// which dates they're attending, custom answers, and status.
export default function RegistrationEditor({
  event,
  reg,
  onClose,
}: {
  event: EventRec;
  reg: Registration;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(reg.name);
  const [email, setEmail] = useState(reg.email);
  const [phone, setPhone] = useState(reg.phone);
  const [partySize, setPartySize] = useState(String(reg.partySize));
  const [guestNames, setGuestNames] = useState<string[]>(reg.guestNames);
  const [slotIds, setSlotIds] = useState<string[]>(reg.slotIds);
  const [answers, setAnswers] = useState<Record<string, string>>(reg.answers);
  const [status, setStatus] = useState<RegStatus>(reg.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const size = Math.max(1, parseInt(partySize, 10) || 1);
  const guestCount = Math.max(0, size - 1);

  function toggleSlot(id: string) {
    setSlotIds((cur) =>
      cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id],
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await updateRegistration({
      id: reg.id,
      name,
      email,
      phone,
      partySize: size,
      guestNames: guestNames.slice(0, guestCount),
      slotIds,
      answers,
      status,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save the changes.");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      style={{
        border: "1px solid var(--green)",
        borderRadius: 10,
        padding: 16,
        background: "var(--green-tint)",
      }}
    >
      <div className="section-title" style={{ marginBottom: 12 }}>
        Edit sign-up
      </div>
      {error && <div className="notice err">{error}</div>}

      <div className="row">
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Party size (including them)</label>
          <input
            type="number"
            min={1}
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RegStatus)}
          >
            <option value="confirmed">Confirmed</option>
            <option value="waitlist">Waitlist</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {guestCount > 0 && (
        <div className="field">
          <label>Guest names</label>
          {Array.from({ length: guestCount }).map((_, i) => (
            <input
              key={i}
              style={{ marginBottom: 6 }}
              placeholder={`Guest ${i + 1}`}
              value={guestNames[i] ?? ""}
              onChange={(e) => {
                const next = [...guestNames];
                next[i] = e.target.value;
                setGuestNames(next);
              }}
            />
          ))}
        </div>
      )}

      {event.slots.length > 0 && (
        <div className="field">
          <label>Dates attending</label>
          <div className="hint" style={{ marginTop: -2 }}>
            Check every date this person is coming to.
          </div>
          <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
            {event.slots.map((s) => (
              <label className="check" key={s.id}>
                <input
                  type="checkbox"
                  checked={slotIds.includes(s.id)}
                  onChange={() => toggleSlot(s.id)}
                />
                <span>{formatSlot(s)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {event.customFields.length > 0 && (
        <div className="field">
          <label>Questions</label>
          {event.customFields.map((f) => (
            <div key={f.id} style={{ marginBottom: 8 }}>
              <div className="hint" style={{ margin: "0 0 3px" }}>
                {f.label}
              </div>
              <input
                value={answers[f.id] ?? ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [f.id]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button className="btn" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          className="btn secondary"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
      </div>
      <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
        Staff edits are not limited by per-date capacity or the roster cap.
      </p>
    </div>
  );
}
