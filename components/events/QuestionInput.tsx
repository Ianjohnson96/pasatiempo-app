"use client";

import { useId } from "react";
import type { Answer, CustomField } from "@/lib/events/types";

// One custom question, rendered as a labelled `.field`. Shared by the public
// sign-up form, the tournament team form and the admin editors.
// - radio: single-select chips (value: string)
// - multi: multi-select chips (value: string[], kept as a real array)
// - checkbox: a "Yes" tick (value: "Yes" | "")
export default function QuestionInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: {
  field: CustomField;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const errId = `${id}-err`;
  const labelId = `${id}-label`;
  const invalid = error ? true : undefined;
  const describedBy = error ? errId : undefined;

  // String-valued types read a string; an array (unexpected here) is shown
  // joined rather than dropped, and only replaced if the person edits it.
  const text = Array.isArray(value) ? value.join(", ") : (value ?? "");
  const list = Array.isArray(value) ? value : value ? [value] : [];

  const label = (
    <label id={labelId} htmlFor={isGroup(field) ? undefined : id}>
      {field.label} {field.required && <span className="req">*</span>}
    </label>
  );

  let control: React.ReactNode;
  switch (field.type) {
    case "long_text":
      control = (
        <textarea
          id={id}
          value={text}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "select":
      control = (
        <select
          id={id}
          value={text}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    case "checkbox":
      control = (
        <label className="check">
          <input
            id={id}
            type="checkbox"
            checked={text === "Yes"}
            disabled={disabled}
            aria-labelledby={labelId}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.checked ? "Yes" : "")}
          />
          <span>Yes</span>
        </label>
      );
      break;
    case "radio":
      control = (
        <div
          className="choice-chips"
          role="radiogroup"
          aria-labelledby={labelId}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          {field.options.map((o) => {
            const on = text === o;
            return (
              <label key={o} className={`chip${on ? " on" : ""}`}>
                <input
                  type="radio"
                  name={id}
                  value={o}
                  checked={on}
                  disabled={disabled}
                  onChange={() => onChange(o)}
                />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      );
      break;
    case "multi":
      control = (
        <div
          className="choice-chips"
          role="group"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          data-invalid={invalid}
        >
          {field.options.map((o) => {
            const on = list.includes(o);
            return (
              <label key={o} className={`chip multi${on ? " on" : ""}`}>
                <input
                  type="checkbox"
                  value={o}
                  checked={on}
                  disabled={disabled}
                  onChange={() =>
                    onChange(on ? list.filter((x) => x !== o) : [...list, o])
                  }
                />
                <span>{o}</span>
              </label>
            );
          })}
        </div>
      );
      break;
    default:
      control = (
        <input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          value={text}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <div className={`field${error ? " has-err" : ""}`}>
      {label}
      {control}
      {error && (
        <p className="field-err" id={errId}>
          {error}
        </p>
      )}
    </div>
  );
}

function isGroup(f: CustomField): boolean {
  return f.type === "radio" || f.type === "multi" || f.type === "checkbox";
}
