import { describe, expect, it } from "vitest";
import {
  COMMON_QUESTIONS,
  QUESTION_TYPES,
  blankQuestion,
  fromPreset,
  moveQuestion,
  normalizeFields,
  presetAdded,
  withType,
} from "./question-builder";
import type { CustomField } from "./types";

const q = (id: string, label = id): CustomField => ({
  id,
  label,
  type: "short_text",
  required: false,
  options: [],
  scope: "player",
});

describe("QUESTION_TYPES", () => {
  it("lists every answer type once, in chip order", () => {
    expect(QUESTION_TYPES.map((t) => t.label)).toEqual([
      "Text",
      "Paragraph",
      "Dropdown",
      "Multiple choice",
      "Checkboxes",
      "Number",
      "Yes/No",
    ]);
    expect(QUESTION_TYPES.map((t) => t.value)).toEqual([
      "short_text",
      "long_text",
      "select",
      "radio",
      "multi",
      "number",
      "checkbox",
    ]);
  });
});

describe("COMMON_QUESTIONS", () => {
  it("has the four tournament presets with their exact options", () => {
    const byLabel = Object.fromEntries(COMMON_QUESTIONS.map((p) => [p.label, p]));
    expect(byLabel["Dietary restrictions"]).toMatchObject({
      type: "short_text",
      scope: "player",
      required: true,
    });
    expect(byLabel["Shirt size"]).toMatchObject({
      type: "radio",
      scope: "player",
      required: true,
      options: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
    });
    expect(byLabel["Hat size"]).toMatchObject({
      type: "radio",
      scope: "player",
      required: false,
      options: ["S/M", "L/XL"],
    });
    expect(byLabel["Glove size"]).toMatchObject({
      type: "radio",
      scope: "player",
      required: false,
      options: ["S", "M", "ML", "L", "XL"],
    });
  });

  it("fromPreset copies the options, so editing one never edits the preset", () => {
    const shirt = COMMON_QUESTIONS.find((p) => p.label === "Shirt size")!;
    const made = fromPreset(shirt, "tmp_1");
    made.options.push("XXXXL");
    expect(made.id).toBe("tmp_1");
    expect(shirt.options).toHaveLength(7);
  });

  it("presetAdded matches labels ignoring case and spaces", () => {
    const shirt = COMMON_QUESTIONS.find((p) => p.label === "Shirt size")!;
    expect(presetAdded([q("a", "  shirt SIZE ")], shirt)).toBe(true);
    expect(presetAdded([q("a", "Hat size")], shirt)).toBe(false);
  });
});

describe("blankQuestion", () => {
  it("defaults to each player in a tournament and once per team otherwise", () => {
    expect(blankQuestion("tmp_a", true).scope).toBe("player");
    expect(blankQuestion("tmp_b", false).scope).toBe("team");
    expect(blankQuestion("tmp_a", true)).toMatchObject({
      id: "tmp_a",
      label: "",
      type: "short_text",
      required: false,
      options: [],
    });
  });
});

describe("withType", () => {
  it("gives a list type with no options one empty row to type into", () => {
    expect(withType(q("a"), "select").options).toEqual([""]);
    expect(withType(q("a"), "multi").options).toEqual([""]);
  });
  it("keeps existing options when switching types", () => {
    const f = { ...q("a"), type: "radio" as const, options: ["A", "B"] };
    expect(withType(f, "select").options).toEqual(["A", "B"]);
    expect(withType(f, "number")).toMatchObject({ type: "number", options: ["A", "B"] });
  });
  it("adds no options for non-list types", () => {
    expect(withType(q("a"), "checkbox").options).toEqual([]);
  });
});

describe("moveQuestion", () => {
  const list = [q("a"), q("b"), q("c")];
  it("moves up and down", () => {
    expect(moveQuestion(list, 1, -1).map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(moveQuestion(list, 1, 1).map((f) => f.id)).toEqual(["a", "c", "b"]);
  });
  it("leaves the list alone at the ends", () => {
    expect(moveQuestion(list, 0, -1)).toBe(list);
    expect(moveQuestion(list, 2, 1)).toBe(list);
    expect(moveQuestion(list, 5, -1)).toBe(list);
  });
  it("does not change the list it was given", () => {
    moveQuestion(list, 0, 1);
    expect(list.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });
});

describe("normalizeFields", () => {
  const f = (over: Partial<CustomField>): CustomField => ({ ...q("x", "Q"), ...over });

  it("forces scope to team when the event is not a tournament", () => {
    const res = normalizeFields([f({ scope: "player" }), f({ scope: "team" })], false);
    expect(res.ok && res.fields.map((x) => x.scope)).toEqual(["team", "team"]);
  });

  it("keeps player scope in a tournament and defaults a missing scope to team", () => {
    const noScope = { ...f({}), scope: undefined } as unknown as CustomField;
    const res = normalizeFields([f({ scope: "player" }), f({ scope: "team" }), noScope], true);
    expect(res.ok && res.fields.map((x) => x.scope)).toEqual(["player", "team", "team"]);
  });

  it("clears options on non-list types", () => {
    const types = ["short_text", "long_text", "number", "checkbox"] as const;
    const res = normalizeFields(
      types.map((type) => f({ type, options: ["A", "B"] })),
      true,
    );
    expect(res.ok && res.fields.map((x) => x.options)).toEqual([[], [], [], []]);
  });

  it("trims list options and drops empty ones", () => {
    const res = normalizeFields(
      [f({ type: "radio", options: [" S ", "", "  ", "M"] })],
      true,
    );
    expect(res.ok && res.fields[0].options).toEqual(["S", "M"]);
  });

  it.each(["select", "radio", "multi"] as const)(
    "rejects a %s question with no real options",
    (type) => {
      const res = normalizeFields(
        [f({ type, label: " Meal choice ", options: ["", "  "] })],
        false,
      );
      expect(res).toEqual({
        ok: false,
        error: 'Add at least one choice for "Meal choice".',
      });
    },
  );

  it("keeps order and other properties", () => {
    const a = f({ id: "a", label: "A", required: true });
    const b = f({ id: "b", label: "B", type: "multi", options: ["x"] });
    const res = normalizeFields([a, b], true);
    expect(res.ok && res.fields.map((x) => [x.id, x.label, x.required, x.type])).toEqual([
      ["a", "A", true, "short_text"],
      ["b", "B", false, "multi"],
    ]);
  });
});
