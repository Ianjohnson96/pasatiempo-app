"use client";

import { useMemo, useState } from "react";
import { register } from "@/lib/events/actions";
import { formatSlot } from "@/lib/events/format";
import QuestionInput from "@/components/events/QuestionInput";
import TeamEntryForm from "@/components/events/TeamEntryForm";
import ErrorSummary from "@/components/events/public/ErrorSummary";
import Confirmation from "@/components/events/public/Confirmation";
import { registrationErrors, type FieldError } from "@/lib/events/validate";
import SubmitButton, { useSubmit } from "@/components/events/public/SubmitButton";
import type { Answers, EventRec } from "@/lib/events/types";

export interface SeatInfo {
  remaining: number | null; // event-level (null = unlimited)
  full: boolean;
  slots: { id: string; remaining: number | null; full: boolean }[];
}

export default function RegistrationForm({
  event,
  seats,
}: {
  event: EventRec;
  seats: SeatInfo;
}) {
  if (event.type === "tournament")
    return <TeamEntryForm event={event} seats={seats} mode="public" />;
  return <StandardForm event={event} seats={seats} />;
}

// Dinners, clinics and general events: one registrant (plus guests).
function StandardForm({ event, seats }: { event: EventRec; seats: SeatInfo }) {
  const isSlots = event.scheduleMode === "slots";
  const multi = isSlots && event.allowMultiSlot;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(() => {
    if (!isSlots || multi) return [];
    const first = event.slots.find(
      (s) => !seats.slots.find((x) => x.id === s.id)?.full,
    );
    return first ? [first.id] : event.slots[0] ? [event.slots[0].id] : [];
  });
  const [answers, setAnswers] = useState<Answers>({});
  const { phase, run } = useSubmit();
  const [result, setResult] = useState<
    { status: "confirmed" | "waitlist" } | null
  >(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [tries, setTries] = useState(0);
  const errFor = (field: string) => errors.find((e) => e.field === field)?.message;

  const maxParty = event.allowGuests ? 1 + (event.maxGuests ?? 1) : 1;

  // Whether the submission would land on the waitlist.
  const targetFull = useMemo(() => {
    if (!isSlots) return seats.full;
    if (selected.length === 0) return false;
    return selected.some((id) => seats.slots.find((s) => s.id === id)?.full);
  }, [isSlots, seats, selected]);

  function toggleSlot(id: string) {
    if (multi) {
      setSelected((s) =>
        s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
      );
    } else {
      setSelected([id]);
    }
  }

  function setGuest(i: number, v: string) {
    setGuestNames((g) => {
      const next = [...g];
      next[i] = v;
      return next;
    });
  }
  function changeParty(n: number) {
    setPartySize(n);
    setGuestNames((g) => g.slice(0, Math.max(0, n - 1)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = registrationErrors({
      event,
      name,
      email,
      slotIds: isSlots ? selected : [],
      answers,
    });
    setErrors(found);
    setTries((n) => n + 1);
    if (found.length) return;
    const res = await run(
      () =>
        register({
          slug: event.slug,
          name,
          email,
          phone,
          partySize,
          guestNames,
          slotIds: isSlots ? selected : [],
          answers,
        }),
      (r) => r.ok && (r.status === "confirmed" || r.status === "waitlist"),
    );
    if (res.ok && (res.status === "confirmed" || res.status === "waitlist")) {
      setResult({ status: res.status });
    } else {
      setErrors([
        { field: "", message: res.error ?? "Something went wrong. Please try again." },
      ]);
      setTries((n) => n + 1);
    }
  }

  if (result) {
    return (
      <div className="card">
        <div className="success-box">
          <div className="check-circle" aria-hidden="true">
            <svg
              className="check-mark"
              viewBox="0 0 48 48"
              width="44"
              height="44"
              aria-hidden="true"
            >
              <path d="M12 25.5l8 8L36 16" />
            </svg>
          </div>
          {result.status === "confirmed" ? (
            <>
              <h2>You&apos;re registered!</h2>
              <p className="muted">
                Thanks, {name.split(" ")[0]}. We&apos;ve got you down for{" "}
                <strong>{event.title}</strong>.
              </p>
            </>
          ) : (
            <>
              <h2>You&apos;re on the waitlist</h2>
              <p className="muted">
                {event.title} is currently full. We&apos;ll be in touch at{" "}
                <strong>{email}</strong> if a spot opens up.
              </p>
            </>
          )}
        </div>
        <Confirmation
          event={event}
          status={result.status}
          email={email}
          slotIds={isSlots ? selected : []}
        />
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <ErrorSummary errors={errors} focusKey={tries} />

      {targetFull && event.waitlistEnabled && (
        <div className="notice warn">
          {isSlots ? "Your selection is" : "This event is"} full — you can still
          sign up to join the <strong>waitlist</strong>.
        </div>
      )}

      {isSlots && (
        <div className="field">
          {event.slotsPrompt && (
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 15,
                color: "var(--green-dark)",
                fontWeight: 600,
              }}
            >
              {event.slotsPrompt}
            </p>
          )}
          <label id="reg-slots-label">
            {multi ? "Choose your date(s)" : "Choose a date / time"}{" "}
            <span className="req">*</span>
          </label>
          <div
            id="reg-slots"
            role="group"
            aria-labelledby="reg-slots-label"
            aria-describedby={errFor("reg-slots") ? "reg-slots-err" : undefined}
          >
          {event.slots.map((s) => {
            const info = seats.slots.find((x) => x.id === s.id);
            const full = !!info?.full;
            const disabled = full && !event.waitlistEnabled;
            const checked = selected.includes(s.id);
            return (
              <label
                key={s.id}
                className={`slot ${checked ? "selected" : ""} ${
                  disabled ? "full" : ""
                }`}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name="slot"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleSlot(s.id)}
                />
                <span className="slot-name">{formatSlot(s)}</span>
                <span className="slot-cap">
                  {s.capacity == null
                    ? "Open"
                    : full
                      ? event.waitlistEnabled
                        ? "Full — waitlist"
                        : "Full"
                      : `${info?.remaining} left`}
                </span>
              </label>
            );
          })}
          </div>
          <FieldErr id="reg-slots" message={errFor("reg-slots")} />
        </div>
      )}

      <div className={`field${errFor("reg-name") ? " has-err" : ""}`}>
        <label htmlFor="reg-name">
          Your name <span className="req">*</span>
        </label>
        <input
          id="reg-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          aria-invalid={errFor("reg-name") ? true : undefined}
          aria-describedby={errFor("reg-name") ? "reg-name-err" : undefined}
        />
        <FieldErr id="reg-name" message={errFor("reg-name")} />
      </div>
      <div className="row">
        <div className={`field${errFor("reg-email") ? " has-err" : ""}`}>
          <label htmlFor="reg-email">
            Email <span className="req">*</span>
          </label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            aria-invalid={errFor("reg-email") ? true : undefined}
            aria-describedby={errFor("reg-email") ? "reg-email-err" : undefined}
          />
          <FieldErr id="reg-email" message={errFor("reg-email")} />
        </div>
        <div className="field">
          <label htmlFor="reg-phone">Phone</label>
          <input
            id="reg-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>

      {event.allowGuests && maxParty > 1 && (
        <div className="field">
          <label>How many total in your party? (including you)</label>
          <select
            value={partySize}
            onChange={(e) => changeParty(parseInt(e.target.value, 10))}
          >
            {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
      {event.allowGuests && event.collectGuestNames && partySize > 1 && (
        <div className="field">
          <label>Guest names</label>
          {Array.from({ length: partySize - 1 }, (_, i) => (
            <input
              key={i}
              type="text"
              value={guestNames[i] ?? ""}
              onChange={(e) => setGuest(i, e.target.value)}
              placeholder={`Guest ${i + 1}`}
              style={{ marginBottom: 8 }}
            />
          ))}
        </div>
      )}

      {event.customFields.map((f) => (
        <QuestionInput
          key={f.id}
          field={f}
          value={answers[f.id]}
          onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))}
          idBase={`reg-q-${f.id}`}
          error={errFor(`reg-q-${f.id}`)}
        />
      ))}

      <SubmitButton phase={phase} className="btn block">
        {targetFull && event.waitlistEnabled ? "Join the waitlist" : "Register"}
      </SubmitButton>
    </form>
  );
}

function FieldErr({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p className="field-err" id={`${id}-err`}>
      {message}
    </p>
  );
}
