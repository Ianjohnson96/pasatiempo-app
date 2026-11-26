// Every problem with a member's sign-up at once, in the order they appear on
// the page, each tied to the field's DOM id so the summary can link to it.

import { isAnswered } from "./tournament";
import type { Answers, EventRec } from "./types";

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
      errs.push({ field: `reg-q-${f.id}`, message: `Answer: ${f.label}` });
  return errs;
}
