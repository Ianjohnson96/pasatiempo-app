// Every problem with a member's sign-up at once, in the order they appear on
// the page, each tied to the field's DOM id so the summary can link to it.

import { isAnswered } from "./tournament";
import type { Answers, CustomField, EventRec } from "./types";

export interface FieldError {
  field: string; // the input's DOM id; "" for a problem with no one field
  message: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registrationErrors(input: {
  event: Pick<EventRec, "scheduleMode" | "customFields">;
  name: string;
  email: string;
  slotIds: string[];
  answers: Answers;
}): FieldError[] {
  const errs: FieldError[] = [];
  if (input.event.scheduleMode === "slots" && input.slotIds.length === 0)
    errs.push({ field: "reg-slots", message: "Choose at least one date" });
  if (!input.name.trim()) errs.push({ field: "reg-name", message: "Enter your name" });
  if (!EMAIL.test(input.email.trim()))
    errs.push({
      field: "reg-email",
      message: "Enter an email address like name@example.com",
    });
  for (const f of input.event.customFields)
    if (f.required && !isAnswered(input.answers[f.id]))
      errs.push({ field: `reg-q-${f.id}`, message: questionError(f) });
  return errs;
}

/** "Dietary restrictions" → "dietary restrictions", but "GHIN number" stays. */
function inSentence(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/**
 * What to tell someone who skipped a required question, phrased as what to
 * do: "Enter dietary restrictions", "Choose a shirt size".
 */
export function questionError(f: Pick<CustomField, "label" | "type">): string {
  const label = f.label.trim();
  if (label.endsWith("?") || f.type === "checkbox") return `Answer “${label}”`;
  const words = inSentence(label);
  switch (f.type) {
    case "select":
    case "radio":
      return `Choose ${/^[aeiou]/i.test(words) ? "an" : "a"} ${words}`;
    case "multi":
      return `Choose at least one: ${words}`;
    case "number":
      return `Enter a number for ${words}`;
    default:
      return `Enter ${words}`;
  }
}
