import { describe, expect, test } from "vitest";
import { registrationErrors } from "./validate";
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
      { field: "reg-q-q1", message: "Answer: Dietary needs" },
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
