import type { CustomField, FieldScope, FieldType } from "./types";

// Pure helpers behind components/events/QuestionBuilder.tsx, kept here so they
// can be tested without a browser.

// The answer types in the order the builder shows them as chips.
export const QUESTION_TYPES: { value: FieldType; label: string }[] = [
  { value: "short_text", label: "Text" },
  { value: "long_text", label: "Paragraph" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Multiple choice" },
  { value: "multi", label: "Checkboxes" },
  { value: "number", label: "Number" },
  { value: "checkbox", label: "Yes/No" },
];

// Types whose answers come from a list of options Ian writes.
export function hasOptions(type: FieldType): boolean {
  return type === "select" || type === "radio" || type === "multi";
}

// Quick-add questions for tournaments. A convenience only: once added they
// are ordinary questions Ian can edit or remove.
export const COMMON_QUESTIONS: Omit<CustomField, "id">[] = [
  {
    label: "Dietary restrictions",
    type: "short_text",
    required: true,
    options: [],
    scope: "player",
  },
  {
    label: "Shirt size",
    type: "radio",
    required: true,
    options: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
    scope: "player",
  },
  {
    label: "Hat size",
    type: "radio",
    required: false,
    options: ["S/M", "L/XL"],
    scope: "player",
  },
  {
    label: "Glove size",
    type: "radio",
    required: false,
    options: ["S", "M", "ML", "L", "XL"],
    scope: "player",
  },
];

// A blank question. Tournament questions default to each player; everything
// else is asked once per registration ("team" is the one-answer scope).
export function blankQuestion(id: string, tournament: boolean): CustomField {
  const scope: FieldScope = tournament ? "player" : "team";
  return { id, label: "", type: "short_text", required: false, options: [], scope };
}

// A preset as a new question, with its own copy of the options.
export function fromPreset(
  preset: Omit<CustomField, "id">,
  id: string,
): CustomField {
  return { ...preset, id, options: [...preset.options] };
}

// True when the event already has a question with the preset's label, so the
// menu can show it as added rather than adding a duplicate.
export function presetAdded(
  fields: CustomField[],
  preset: Omit<CustomField, "id">,
): boolean {
  const want = preset.label.trim().toLowerCase();
  return fields.some((f) => f.label.trim().toLowerCase() === want);
}

// Switch a question's answer type. Options are kept (so switching back and
// forth loses nothing); a list type with none yet gets one empty row to type
// into.
export function withType(field: CustomField, type: FieldType): CustomField {
  const options =
    hasOptions(type) && field.options.length === 0 ? [""] : field.options;
  return { ...field, type, options };
}

// The save-time cleanup of an event's questions (the server is authoritative;
// the builder only warns). Outside a tournament every question is asked once,
// so scope is forced to "team"; otherwise a question added while the type was
// tournament would keep a hidden "player" scope. Non-list types carry no
// options; list types keep their trimmed, non-empty options and must have at
// least one, or the question could never be answered.
export function normalizeFields(
  fields: CustomField[],
  tournament: boolean,
): { ok: true; fields: CustomField[] } | { ok: false; error: string } {
  const out: CustomField[] = [];
  for (const f of fields) {
    const list = hasOptions(f.type);
    const options = list
      ? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
      : [];
    if (list && options.length === 0) {
      return {
        ok: false,
        error: `Add at least one choice for "${f.label.trim()}".`,
      };
    }
    const scope: FieldScope =
      tournament && f.scope === "player" ? "player" : "team";
    out.push({ ...f, options, scope });
  }
  return { ok: true, fields: out };
}

// Move the question at `index` one place up (-1) or down (+1). Out-of-range
// moves return the same list unchanged.
export function moveQuestion(
  fields: CustomField[],
  index: number,
  dir: -1 | 1,
): CustomField[] {
  const to = index + dir;
  if (index < 0 || index >= fields.length || to < 0 || to >= fields.length) {
    return fields;
  }
  const next = [...fields];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
