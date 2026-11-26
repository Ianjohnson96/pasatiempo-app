import { describe, expect, test } from "vitest";
import { questionError, registrationErrors } from "./validate";
import type { CustomField, EventRec } from "./types";

const q = (over: Partial<CustomField> = {}): CustomField => ({
  id: "q1",
  label: "Dietary needs",
  type: "short_text",
  required: true,
  options: [],
  scope: "player",
  ...over,
});

const ev = (over: Partial<EventRec> = {}) =>
  ({
    scheduleMode: "slots",
    customFields: [q()],
    ...over,
  }) as EventRec;

describe("registrationErrors", () => {
  test("an empty submission lists every problem, in page order", () => {
    const errs = registrationErrors({ event: ev(), name: " ", email: "", slotIds: [], answers: {} });
    expect(errs).toEqual([
      { field: "reg-slots", message: "Choose at least one date" },
      { field: "reg-name", message: "Enter your name" },
      { field: "reg-email", message: "Enter an email address like name@example.com" },
      { field: "reg-q-q1", message: "Enter dietary needs" },
    ]);
  });

  test("a half-typed email is invalid", () => {
    const errs = registrationErrors({
      event: ev({ scheduleMode: "single", customFields: [] }),
      name: "Pat",
      email: "bob@",
      slotIds: [],
      answers: {},
    });
    expect(errs).toEqual([
      { field: "reg-email", message: "Enter an email address like name@example.com" },
    ]);
  });

  test("a complete submission has no errors", () => {
    expect(
      registrationErrors({
        event: ev(),
        name: "Pat Lee",
        email: "pat@example.com",
        slotIds: ["s1"],
        answers: { q1: "None" },
      }),
    ).toEqual([]);
  });

  test("optional questions and single-date events need nothing extra", () => {
    expect(
      registrationErrors({
        event: ev({ scheduleMode: "single", customFields: [q({ required: false })] }),
        name: "Pat",
        email: "pat@example.com",
        slotIds: [],
        answers: {},
      }),
    ).toEqual([]);
  });
});

describe("questionError", () => {
  const q = (label: string, type: string) => ({ label, type }) as never;
  test("a text question asks to enter it", () => {
    expect(questionError(q("Dietary restrictions", "short_text"))).toBe("Enter dietary restrictions");
    expect(questionError(q("Anything we should know", "long_text"))).toBe("Enter anything we should know");
  });
  test("a choice asks to choose", () => {
    expect(questionError(q("Shirt size", "select"))).toBe("Choose a shirt size");
    expect(questionError(q("Arrival time", "radio"))).toBe("Choose an arrival time");
    expect(questionError(q("Sessions", "multi"))).toBe("Choose at least one: sessions");
  });
  test("a question asks to be answered", () => {
    expect(questionError(q("Playing the Skins Game?", "checkbox"))).toBe("Answer “Playing the Skins Game?”");
  });
  test("a number asks for one", () => {
    expect(questionError(q("Handicap", "number"))).toBe("Enter a number for handicap");
  });
  test("acronyms and names keep their capitals", () => {
    expect(questionError(q("GHIN number", "short_text"))).toBe("Enter GHIN number");
  });
});
