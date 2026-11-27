"use client";

import { useEffect, useId, useRef } from "react";
import type { FieldError } from "@/lib/events/validate";

// A box at the top of a form listing everything to fix. It takes focus each
// time the form is submitted with problems (focusKey changes), not while the
// person is typing fixes; each item links to its field.
export default function ErrorSummary({
  errors,
  focusKey,
}: {
  errors: FieldError[];
  focusKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const has = errors.length > 0;

  useEffect(() => {
    if (focusKey > 0 && has) ref.current?.focus();
    // only a new submission moves focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  if (errors.length === 0) return null;
  const n = errors.length;

  return (
    <div
      ref={ref}
      className="error-summary"
      // focus (on submit) announces it; role="alert" as well would read it twice
      role="region"
      tabIndex={-1}
      aria-labelledby={titleId}
    >
      <p className="es-title" id={titleId}>
        {n === 1 ? "1 thing to fix" : `${n} things to fix`}
      </p>
      <ul>
        {errors.map((e, i) => (
          <li key={i}>
            {e.field ? (
              <a
                href={`#${e.field}`}
                onClick={(ev) => {
                  const el = document.getElementById(e.field);
                  if (!el) return;
                  ev.preventDefault();
                  el.scrollIntoView({ block: "center" });
                  // a group (slots, a card) focuses its first control; a
                  // heading id leads to the section it labels
                  const controls = "input:not([disabled]), select, textarea";
                  const scope = el.matches(controls)
                    ? el
                    : el.querySelector(controls)
                      ? el
                      : (document.querySelector(`[aria-labelledby~="${e.field}"]`) ??
                        el.parentElement);
                  const target = scope?.matches(controls)
                    ? (scope as HTMLElement)
                    : scope?.querySelector<HTMLElement>(controls);
                  (target ?? el).focus({ preventScroll: true });
                }}
              >
                {e.message}
              </a>
            ) : (
              e.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
