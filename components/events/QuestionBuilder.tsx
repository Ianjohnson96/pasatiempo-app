"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomField, FieldType } from "@/lib/events/types";
import {
  COMMON_QUESTIONS,
  QUESTION_TYPES,
  blankQuestion,
  fromPreset,
  hasOptions,
  moveQuestion,
  presetAdded,
  withType,
} from "@/lib/events/question-builder";

// The editor's "Custom questions" builder. Each question gets a label, an
// answer type picked from icon chips, an option list for the list types, a
// Required switch and, for tournaments, an Each player / Once per team switch.
// Tournaments also show the built-in player fields as locked rows at the top
// and offer quick-add presets.

function tmpId() {
  // saveEventInner swaps tmp_* ids for real ones on save.
  return "tmp_" + Math.random().toString(36).slice(2, 10);
}

// Name, email and GHIN are asked of every player by the team form itself.
const LOCKED = ["Name", "Email", "GHIN #"];

export default function QuestionBuilder({
  fields,
  onChange,
  tournament,
}: {
  fields: CustomField[];
  onChange: (f: CustomField[]) => void;
  tournament: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Where to put the cursor after the next render: a question's label, or one
  // of its option rows.
  const focusNext = useRef<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusNext.current) return;
    const el = rootRef.current?.querySelector<HTMLInputElement>(
      `[data-qb-focus="${focusNext.current}"]`,
    );
    focusNext.current = null;
    el?.focus();
  }, [fields]);

  // Close the presets menu on an outside click or Escape.
  useEffect(() => {
    if (!presetsOpen) return;
    function onDown(e: MouseEvent) {
      if (!presetsRef.current?.contains(e.target as Node)) setPresetsOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPresetsOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [presetsOpen]);

  function upd(id: string, patch: Partial<CustomField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function setType(f: CustomField, type: FieldType) {
    const next = withType(f, type);
    if (hasOptions(type) && f.options.length === 0) {
      focusNext.current = `${f.id}:opt:0`;
    }
    onChange(fields.map((x) => (x.id === f.id ? next : x)));
  }
  function add() {
    const f = blankQuestion(tmpId(), tournament);
    focusNext.current = `${f.id}:label`;
    onChange([...fields, f]);
  }
  function addPreset(p: (typeof COMMON_QUESTIONS)[number]) {
    onChange([...fields, fromPreset(p, tmpId())]);
    setPresetsOpen(false);
  }
  function remove(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  // ---- options ----
  function setOption(f: CustomField, i: number, v: string) {
    upd(f.id, { options: f.options.map((o, j) => (j === i ? v : o)) });
  }
  function addOption(f: CustomField, after = f.options.length - 1) {
    const options = [...f.options];
    options.splice(after + 1, 0, "");
    focusNext.current = `${f.id}:opt:${after + 1}`;
    upd(f.id, { options });
  }
  function removeOption(f: CustomField, i: number) {
    upd(f.id, { options: f.options.filter((_, j) => j !== i) });
  }

  return (
    <div className="qb" ref={rootRef}>
      {tournament && (
        <div className="qb-locked-group" role="group" aria-label="Asked of every player">
          {LOCKED.map((label) => (
            <div key={label} className="qb-locked">
              <span className="qb-lock" aria-hidden="true">
                <LockIcon />
              </span>
              <span className="qb-locked-label">{label}</span>
              <span className="qb-tag">each player · required</span>
            </div>
          ))}
          <p className="qb-locked-note">
            Built in. Every player is asked these, so they aren&apos;t editable
            here.
          </p>
        </div>
      )}

      {fields.length === 0 && (
        <p className="qb-empty">
          {tournament
            ? "No extra questions yet. Add your own, or pick a common one."
            : "No questions yet."}
        </p>
      )}

      {fields.map((f, i) => {
        const filled = f.options.filter((o) => o.trim()).length;
        return (
          <div key={f.id} className="qb-row">
            <div className="qb-head">
              <span className="qb-num" aria-hidden="true">
                {i + 1}
              </span>
              <input
                type="text"
                className="qb-label"
                value={f.label}
                data-qb-focus={`${f.id}:label`}
                aria-label={`Question ${i + 1}`}
                placeholder="Your question, e.g. Shirt size"
                onChange={(e) => upd(f.id, { label: e.target.value })}
              />
              <div className="qb-tools">
                <button
                  type="button"
                  className="qb-icon-btn"
                  onClick={() => onChange(moveQuestion(fields, i, -1))}
                  disabled={i === 0}
                  aria-label={`Move question ${i + 1} up`}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="qb-icon-btn"
                  onClick={() => onChange(moveQuestion(fields, i, 1))}
                  disabled={i === fields.length - 1}
                  aria-label={`Move question ${i + 1} down`}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn ghost small qb-remove"
                  onClick={() => remove(f.id)}
                  aria-label={`Remove question ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            </div>

            <div
              className="qb-type-chips"
              role="radiogroup"
              aria-label="Answer type"
            >
              {QUESTION_TYPES.map((t) => {
                const on = f.type === t.value;
                return (
                  <label key={t.value} className={`qb-chip${on ? " on" : ""}`}>
                    <input
                      type="radio"
                      name={`qb-type-${f.id}`}
                      value={t.value}
                      checked={on}
                      onChange={() => setType(f, t.value)}
                    />
                    <TypeIcon type={t.value} />
                    <span>{t.label}</span>
                  </label>
                );
              })}
            </div>

            {hasOptions(f.type) && (
              <div className="qb-options">
                <div className="qb-sub">Options</div>
                {f.options.map((o, j) => (
                  <div key={j} className="qb-option">
                    <span className="qb-bullet" aria-hidden="true">
                      <OptionMark type={f.type} />
                    </span>
                    <input
                      type="text"
                      value={o}
                      data-qb-focus={`${f.id}:opt:${j}`}
                      aria-label={`Option ${j + 1}`}
                      placeholder={`Option ${j + 1}`}
                      onChange={(e) => setOption(f, j, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addOption(f, j);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="qb-icon-btn"
                      onClick={() => removeOption(f, j)}
                      aria-label={`Remove option ${j + 1}`}
                      title="Remove option"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn ghost small qb-add-option"
                  onClick={() => addOption(f)}
                >
                  + Add option
                </button>
                {filled === 0 && (
                  <p className="qb-warn">Add at least one option to choose from.</p>
                )}
              </div>
            )}

            <div className="qb-foot">
              <label className="qb-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={f.required}
                  onChange={(e) => upd(f.id, { required: e.target.checked })}
                />
                <span className="qb-track" aria-hidden="true" />
                <span>Required</span>
              </label>
              {tournament && (
                <div className="seg qb-scope" role="group" aria-label="Who answers">
                  <button
                    type="button"
                    className={`segbtn${f.scope === "player" ? " on" : ""}`}
                    aria-pressed={f.scope === "player"}
                    onClick={() => upd(f.id, { scope: "player" })}
                  >
                    Each player
                  </button>
                  <button
                    type="button"
                    className={`segbtn${f.scope === "team" ? " on" : ""}`}
                    aria-pressed={f.scope === "team"}
                    onClick={() => upd(f.id, { scope: "team" })}
                  >
                    Once per team
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="qb-actions">
        <button type="button" className="btn secondary small" onClick={add}>
          + Add question
        </button>
        {tournament && (
          <div className="qb-presets" ref={presetsRef}>
            <button
              type="button"
              className="btn ghost small"
              aria-haspopup="true"
              aria-expanded={presetsOpen}
              onClick={() => setPresetsOpen((o) => !o)}
            >
              + Add common question <span aria-hidden="true">▾</span>
            </button>
            {presetsOpen && (
              <div className="qb-menu">
                {COMMON_QUESTIONS.map((p) => {
                  const added = presetAdded(fields, p);
                  return (
                    <button
                      key={p.label}
                      type="button"
                      className="qb-menu-item"
                      disabled={added}
                      onClick={() => addPreset(p)}
                    >
                      <span className="qb-menu-label">{p.label}</span>
                      <span className="qb-menu-hint">
                        {added
                          ? "Added"
                          : p.options.length
                            ? p.options.join(" · ")
                            : "Short answer"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- icons (16px, stroke = currentColor) ----

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="qb-ico"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function TypeIcon({ type }: { type: FieldType }) {
  switch (type) {
    case "short_text":
      return (
        <Svg>
          <path d="M3 5h10M3 9h6" />
          <path d="M11.5 8v4" />
        </Svg>
      );
    case "long_text":
      return (
        <Svg>
          <path d="M2.5 4h11M2.5 7h11M2.5 10h11M2.5 13h7" />
        </Svg>
      );
    case "select":
      return (
        <Svg>
          <rect x="1.5" y="4" width="13" height="8" rx="2" />
          <path d="M9.5 7l1.5 1.5L12.5 7" />
        </Svg>
      );
    case "radio":
      return (
        <Svg>
          <circle cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
        </Svg>
      );
    case "multi":
      return (
        <Svg>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
          <path d="M5.5 8.2l1.8 1.8 3.4-3.6" />
        </Svg>
      );
    case "number":
      return (
        <Svg>
          <path d="M6 2.5L5 13.5M11 2.5l-1 11M3 6h10.5M2.5 10H13" />
        </Svg>
      );
    case "checkbox":
      return (
        <Svg>
          <rect x="1.5" y="4.5" width="13" height="7" rx="3.5" />
          <circle cx="11" cy="8" r="1.8" fill="currentColor" stroke="none" />
        </Svg>
      );
  }
}

// The little marker before each option row, echoing how it will look.
function OptionMark({ type }: { type: FieldType }) {
  if (type === "multi") {
    return (
      <Svg>
        <rect x="3" y="3" width="10" height="10" rx="2.5" />
      </Svg>
    );
  }
  if (type === "radio") {
    return (
      <Svg>
        <circle cx="8" cy="8" r="5" />
      </Svg>
    );
  }
  return (
    <Svg>
      <path d="M5 8h6" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </Svg>
  );
}
