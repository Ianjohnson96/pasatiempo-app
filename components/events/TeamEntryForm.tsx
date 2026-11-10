"use client";

import { useEffect, useId, useRef, useState } from "react";
import { register } from "@/lib/events/actions";
import { answerText } from "@/lib/events/format";
import {
  isAnswered,
  isValidGhin,
  normalizeGhin,
  validateTeam,
  type TeamInput,
} from "@/lib/events/tournament";
import QuestionInput from "@/components/events/QuestionInput";
import type { SeatInfo } from "@/components/events/RegistrationForm";
import type {
  Answer,
  CustomField,
  EventRec,
  Player,
  PlayerRole,
} from "@/lib/events/types";

type Mode = "public" | "preview" | "admin";
type Step = "form" | "review" | "done";
type Errs = Record<string, string>;

const ROLES: PlayerRole[] = ["member", "guest"];
const ROLE_LABEL: Record<PlayerRole, string> = {
  member: "Member",
  guest: "Guest",
};
const ROLE_SUB: Record<PlayerRole, string> = {
  member: "The club member entering the team",
  guest: "Your partner for the event",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = "Something went wrong. Please try again.";

function blankPlayer(role: PlayerRole): Player {
  return { role, name: "", email: "", ghin: "", answers: {} };
}

function startTeam(initial?: TeamInput): TeamInput {
  return {
    players: ROLES.map((role, i) => {
      const p = initial?.players[i];
      return p
        ? { ...p, role, answers: { ...p.answers } }
        : blankPlayer(role);
    }),
    teamAnswers: { ...(initial?.teamAnswers ?? {}) },
  };
}

// Every problem at once, keyed by field, so both cards can show their errors
// together. The wording matches validateTeam's (without the role prefix).
function fieldErrors(
  fields: CustomField[],
  team: TeamInput,
  enforceRequired: boolean,
): Errs {
  const errs: Errs = {};
  team.players.forEach((p, i) => {
    const role = ROLES[i];
    if (!p.name.trim()) errs[`${role}.name`] = "Please enter a name.";
    if (!EMAIL_RE.test(p.email.trim()))
      errs[`${role}.email`] = "Please enter a valid email.";
    if (!normalizeGhin(p.ghin))
      errs[`${role}.ghin`] = "Please enter a GHIN number.";
    else if (!isValidGhin(p.ghin))
      errs[`${role}.ghin`] = "GHIN numbers are digits only.";
    if (enforceRequired) {
      for (const f of fields) {
        if (f.scope === "player" && f.required && !isAnswered(p.answers[f.id]))
          errs[`${role}.q.${f.id}`] = "Please answer this question.";
      }
    }
  });
  if (enforceRequired) {
    for (const f of fields) {
      if (f.scope === "team" && f.required && !isAnswered(team.teamAnswers[f.id]))
        errs[`team.q.${f.id}`] = "Please answer this question.";
    }
  }
  return errs;
}

// "Member: please enter a name." → { role: "member", text: "Please enter a name." }
function splitRoleError(
  msg: string,
): { role: PlayerRole | null; text: string } {
  for (const role of ROLES) {
    const prefix = `${ROLE_LABEL[role]}: `;
    if (msg.startsWith(prefix)) {
      const rest = msg.slice(prefix.length);
      return { role, text: rest.charAt(0).toUpperCase() + rest.slice(1) };
    }
  }
  return { role: null, text: msg };
}

export default function TeamEntryForm({
  event,
  seats,
  mode,
  initial,
  lockMemberEmail = false,
  onSubmit,
}: {
  event: EventRec;
  seats: SeatInfo;
  mode: Mode;
  initial?: { team: TeamInput; phone: string };
  lockMemberEmail?: boolean;
  onSubmit?: (
    team: TeamInput,
    phone: string,
    sendEmails: boolean,
  ) => Promise<string | null>;
}) {
  const isAdmin = mode === "admin";
  const isPreview = mode === "preview";
  const isEdit = initial !== undefined;
  const playerFields = event.customFields.filter((f) => f.scope === "player");
  const teamFields = event.customFields.filter((f) => f.scope === "team");

  const [team, setTeam] = useState<TeamInput>(() => startTeam(initial?.team));
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [sendEmails, setSendEmails] = useState(true);
  const [step, setStep] = useState<Step>("form");
  const [attempt, setAttempt] = useState(0);
  const [cardErr, setCardErr] = useState<Partial<Record<PlayerRole, string>>>(
    {},
  );
  const [formErr, setFormErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [doneStatus, setDoneStatus] = useState<"confirmed" | "waitlist">(
    "confirmed",
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);

  // Errors appear after the first "Review" press and then track each edit.
  const errs: Errs =
    attempt > 0 ? fieldErrors(event.customFields, team, !isAdmin) : {};

  const willWaitlist = seats.full && event.waitlistEnabled;
  // A new public entry can't go in; staff (admin) may still add or edit.
  const closedFull =
    seats.full && !event.waitlistEnabled && !isEdit && !isAdmin;

  // Bring the top of the form into view when the step changes (the review and
  // confirmation screens are shorter than the form on a phone).
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  // After a failed attempt, move focus to the first field that needs fixing.
  useEffect(() => {
    if (attempt === 0) return;
    const el = rootRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-invalid="true"]',
    );
    if (!el) return;
    const target =
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
        ? el
        : el.querySelector<HTMLElement>("input");
    target?.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [attempt]);

  function setPlayer(i: number, patch: Partial<Player>) {
    setTeam((t) => ({
      ...t,
      players: t.players.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));
    const role = ROLES[i];
    if (cardErr[role]) setCardErr((c) => ({ ...c, [role]: undefined }));
  }
  function setPlayerAnswer(i: number, id: string, v: Answer) {
    setTeam((t) => ({
      ...t,
      players: t.players.map((p, j) =>
        j === i ? { ...p, answers: { ...p.answers, [id]: v } } : p,
      ),
    }));
  }
  function setTeamAnswer(id: string, v: Answer) {
    setTeam((t) => ({ ...t, teamAnswers: { ...t.teamAnswers, [id]: v } }));
  }

  // Route an error to the card it belongs to, or to the form as a whole.
  function showError(msg: string) {
    const { role, text } = splitRoleError(msg);
    if (role) {
      setCardErr({ [role]: text });
      setFormErr("");
    } else {
      setCardErr({});
      setFormErr(msg);
    }
  }

  // Client-side check: true when the team is ready to submit.
  function check(): boolean {
    setAttempt((n) => n + 1);
    setCardErr({});
    setFormErr("");
    const local = fieldErrors(event.customFields, team, !isAdmin);
    if (Object.keys(local).length > 0) return false;
    const invalid = validateTeam(event, team, { enforceRequired: !isAdmin });
    if (invalid) {
      showError(invalid);
      return false;
    }
    return true;
  }

  async function send() {
    setSubmitting(true);
    setFormErr("");
    let err: string | null = null;
    let status: "confirmed" | "waitlist" = willWaitlist
      ? "waitlist"
      : "confirmed";
    try {
      if (onSubmit) {
        err = await onSubmit(team, phone, sendEmails);
      } else {
        const member = team.players[0];
        const res = await register({
          slug: event.slug,
          name: member.name,
          email: member.email,
          phone,
          partySize: 1,
          guestNames: [],
          slotIds: [],
          answers: {},
          team,
        });
        if (res.ok && (res.status === "confirmed" || res.status === "waitlist"))
          status = res.status;
        else if (res.ok) status = "confirmed";
        else err = res.error ?? GENERIC_ERROR;
      }
    } catch {
      err = GENERIC_ERROR;
    }
    setSubmitting(false);
    if (err) {
      // Player-specific problems go back to the form, on the right card.
      if (splitRoleError(err).role && step === "review") setStep("form");
      showError(err);
      return;
    }
    if (isAdmin) return; // the admin screen closes or refreshes itself
    setDoneStatus(status);
    setStep("done");
  }

  async function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPreview || closedFull) return;
    if (!check()) return;
    if (isAdmin) await send();
    else setStep("review");
  }

  const member = team.players[0];

  // ---- Confirmation -------------------------------------------------------
  if (step === "done") {
    return (
      <div className="team-entry" ref={rootRef}>
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
            {isEdit ? (
              <>
                <h2>Your team is updated</h2>
                <p className="muted">
                  Thanks, {member.name.trim().split(/\s+/)[0]}. Your changes
                  to your <strong>{event.title}</strong> entry are saved.
                </p>
              </>
            ) : doneStatus === "waitlist" ? (
              <>
                <h2>You&apos;re on the waitlist</h2>
                <p className="muted">
                  Your team is on the waitlist. A confirmation email has been
                  sent to both players.
                </p>
              </>
            ) : (
              <>
                <h2>Your team is entered</h2>
                <p className="muted">
                  A confirmation email has been sent to both players.
                </p>
              </>
            )}
          </div>
          <TeamSummary
            team={team}
            phone={phone}
            playerFields={playerFields}
            teamFields={teamFields}
            title={event.title}
          />
        </div>
      </div>
    );
  }

  // ---- Review -------------------------------------------------------------
  if (step === "review") {
    return (
      <div className="team-entry" ref={rootRef}>
        <div className="card review-team">
          <div className="review-head">
            <h3>Review your team</h3>
            <p className="muted">
              Check both players&apos; details, then{" "}
              {isEdit ? "save your changes" : "submit your entry"}.
            </p>
          </div>
          {willWaitlist && !isEdit && (
            <div className="notice warn">
              The field is full, so this team will join the{" "}
              <strong>waitlist</strong>.
            </div>
          )}
          <TeamSummary
            team={team}
            phone={phone}
            playerFields={playerFields}
            teamFields={teamFields}
            title={event.title}
          />
          {formErr && (
            <div className="notice err" role="alert">
              {formErr}
            </div>
          )}
          <div className="review-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setStep("form")}
              disabled={submitting}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn"
              onClick={send}
              disabled={submitting}
            >
              {submitting
                ? "Submitting…"
                : isEdit
                  ? "Save changes"
                  : "Submit entry"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Form ---------------------------------------------------------------
  const errCount = Object.keys(errs).length;
  return (
    <div
      className={`team-entry${isPreview ? " preview" : ""}`}
      ref={rootRef}
    >
      <form onSubmit={onFormSubmit} noValidate>
        <fieldset className="team-fieldset" disabled={isPreview}>
          {!isAdmin && willWaitlist && !isEdit && (
            <div className="notice warn">
              The field is full — you can still enter your team on the{" "}
              <strong>waitlist</strong>.
            </div>
          )}
          {!isAdmin && closedFull && (
            <div className="notice err">
              The field is full and entries are closed.
            </div>
          )}

          <div className="team-grid">
            {team.players.map((p, i) => {
              const role = ROLES[i];
              const k = (f: string) => errs[`${role}.${f}`];
              const lockEmail = role === "member" && lockMemberEmail;
              const hasErr =
                !!cardErr[role] ||
                Object.keys(errs).some((x) => x.startsWith(`${role}.`));
              return (
                <section
                  key={role}
                  className={`player-card${hasErr ? " has-err" : ""}`}
                  aria-labelledby={`pc-${role}`}
                >
                  <header className="player-card-head">
                    <span className="player-card-kicker" id={`pc-${role}`}>
                      {ROLE_LABEL[role]}
                    </span>
                    <span className="player-card-sub">{ROLE_SUB[role]}</span>
                  </header>
                  {cardErr[role] && (
                    <div className="notice err" role="alert">
                      {cardErr[role]}
                    </div>
                  )}
                  <TextField
                    label="Name"
                    required
                    value={p.name}
                    error={k("name")}
                    autoComplete={role === "member" ? "name" : "off"}
                    onChange={(v) => setPlayer(i, { name: v })}
                  />
                  <TextField
                    label="Email"
                    type="email"
                    required
                    value={p.email}
                    error={k("email")}
                    readOnly={lockEmail}
                    hint={
                      lockEmail
                        ? "Your entry is under this email."
                        : undefined
                    }
                    autoComplete={role === "member" ? "email" : "off"}
                    onChange={(v) => setPlayer(i, { email: v })}
                  />
                  <TextField
                    label="GHIN #"
                    required
                    value={p.ghin}
                    error={k("ghin")}
                    hint="Usually 7–8 digits"
                    inputMode="numeric"
                    autoComplete="off"
                    onChange={(v) => setPlayer(i, { ghin: v })}
                  />
                  {role === "member" && (
                    <TextField
                      label="Phone"
                      type="tel"
                      value={phone}
                      autoComplete="tel"
                      onChange={setPhone}
                    />
                  )}
                  {playerFields.length > 0 && <div className="player-card-rule" />}
                  {playerFields.map((f) => (
                    <QuestionInput
                      key={f.id}
                      field={f}
                      value={p.answers[f.id]}
                      error={errs[`${role}.q.${f.id}`]}
                      onChange={(v) => setPlayerAnswer(i, f.id, v)}
                    />
                  ))}
                </section>
              );
            })}
          </div>

          {teamFields.length > 0 && (
            <section className="player-card team-qs" aria-labelledby="pc-team">
              <header className="player-card-head">
                <span className="player-card-kicker" id="pc-team">
                  Team
                </span>
                <span className="player-card-sub">Answered once for the team</span>
              </header>
              {teamFields.map((f) => (
                <QuestionInput
                  key={f.id}
                  field={f}
                  value={team.teamAnswers[f.id]}
                  error={errs[`team.q.${f.id}`]}
                  onChange={(v) => setTeamAnswer(f.id, v)}
                />
              ))}
            </section>
          )}

          {formErr && (
            <div className="notice err" role="alert">
              {formErr}
            </div>
          )}
          {errCount > 0 && (
            <p className="field-err team-summary-err" role="alert">
              {errCount === 1
                ? "One field needs your attention above."
                : `${errCount} fields need your attention above.`}
            </p>
          )}

          {isAdmin && !isEdit && (
            <label className="check team-send">
              <input
                type="checkbox"
                checked={sendEmails}
                onChange={(e) => setSendEmails(e.target.checked)}
              />
              <span>Send confirmation emails</span>
            </label>
          )}

          <button
            className="btn block team-submit"
            type="submit"
            disabled={isPreview || submitting || closedFull}
          >
            {isAdmin
              ? submitting
                ? "Saving…"
                : isEdit
                  ? "Save team"
                  : "Add team"
              : "Review your team →"}
          </button>
          {isPreview && (
            <p className="muted team-preview-note">
              Preview — members submit from the public event page.
            </p>
          )}
        </fieldset>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  error,
  hint,
  type = "text",
  inputMode,
  autoComplete,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  type?: "text" | "email" | "tel";
  inputMode?: "numeric";
  autoComplete?: string;
  readOnly?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy =
    [hint ? hintId : "", error ? errId : ""].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={`field${error ? " has-err" : ""}`}>
      <label htmlFor={id}>
        {label} {required && <span className="req">*</span>}
      </label>
      {hint && (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      )}
      <input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        readOnly={readOnly}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p className="field-err" id={errId}>
          {error}
        </p>
      )}
    </div>
  );
}

// Both players' details and answers, read-only (review and confirmation).
function TeamSummary({
  team,
  phone,
  playerFields,
  teamFields,
  title,
}: {
  team: TeamInput;
  phone: string;
  playerFields: CustomField[];
  teamFields: CustomField[];
  title: string;
}) {
  return (
    <div className="review-body" aria-label={`Your team for ${title}`}>
      <div className="team-grid">
        {team.players.map((p, i) => {
          const role = ROLES[i];
          return (
            <div className="review-player" key={role}>
              <div className="player-card-kicker">{ROLE_LABEL[role]}</div>
              <div className="review-name">{p.name.trim()}</div>
              <dl className="review-list">
                <ReviewRow label="Email" value={p.email.trim()} />
                <ReviewRow label="GHIN #" value={normalizeGhin(p.ghin)} />
                {role === "member" && phone.trim() && (
                  <ReviewRow label="Phone" value={phone.trim()} />
                )}
                {playerFields.map((f) => (
                  <ReviewRow
                    key={f.id}
                    label={f.label}
                    value={answerText(p.answers[f.id]).trim()}
                  />
                ))}
              </dl>
            </div>
          );
        })}
      </div>
      {teamFields.length > 0 && (
        <div className="review-player review-teamqs">
          <div className="player-card-kicker">Team</div>
          <dl className="review-list">
            {teamFields.map((f) => (
              <ReviewRow
                key={f.id}
                label={f.label}
                value={answerText(team.teamAnswers[f.id]).trim()}
              />
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

// A long label (usually an admin's question) sits over its answer instead of
// squeezing into the label column.
const LONG_LABEL = 24;

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={`review-row${label.length > LONG_LABEL ? " long" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || <span className="muted">—</span>}</dd>
    </div>
  );
}

