import { describe, expect, it } from "vitest";
import { eventToRow, isMissingLookColumn, rowToEvent, rowToReg, withoutLookColumns } from "./map";
import { answerText } from "./format";

const baseEvent = {
  id: "e1",
  slug: "s",
  title: "T",
  type: "tournament",
  schedule_mode: "single",
  allow_multi_slot: false,
  waitlist_enabled: false,
  allow_guests: false,
  max_guests: null,
  collect_guest_names: false,
  invite_only: false,
  gallery_mode: "grid",
  show_roster: false,
  roster_style: "first_last",
  status: "open",
  created_at: "2026-01-01",
  starts_at: null,
  ends_at: null,
  capacity: null,
};

const baseReg = {
  id: "r1",
  event_id: "e1",
  name: "A",
  email: "a@b.c",
  party_size: 2,
  status: "confirmed",
  created_at: "2026-01-01",
};

describe("rowToEvent custom field scope", () => {
  it("defaults a missing scope to team", () => {
    const e = rowToEvent({
      ...baseEvent,
      custom_fields: [
        { id: "f1", label: "Q", type: "short_text", required: false, options: [] },
      ],
    });
    expect(e.customFields[0].scope).toBe("team");
  });

  it("keeps a stored player scope", () => {
    const e = rowToEvent({
      ...baseEvent,
      custom_fields: [
        {
          id: "f1",
          label: "Q",
          type: "radio",
          required: false,
          options: ["a"],
          scope: "player",
        },
      ],
    });
    expect(e.customFields[0].scope).toBe("player");
  });
});

describe("rowToReg players and emailFailed", () => {
  it("maps players and email_failed", () => {
    const player = (role: "member" | "guest") => ({
      role,
      name: role,
      email: `${role}@x.y`,
      ghin: "1",
      answers: {},
    });
    const r = rowToReg({
      ...baseReg,
      players: [player("member"), player("guest")],
      email_failed: true,
    });
    expect(r.players).toHaveLength(2);
    expect(r.emailFailed).toBe(true);
  });

  it("defaults to null players and emailFailed false", () => {
    const r = rowToReg(baseReg);
    expect(r.players).toBeNull();
    expect(r.emailFailed).toBe(false);
  });
});

describe("answerText", () => {
  it("joins arrays and blanks undefined", () => {
    expect(answerText(["S", "M"])).toBe("S, M");
    expect(answerText(undefined)).toBe("");
    expect(answerText("x")).toBe("x");
  });
});

describe("look and contact columns", () => {
  it("rowToEvent tolerates missing look columns", () => {
    const e = rowToEvent(baseEvent);
    expect(e.theme).toBeNull();
    expect(e.contactName).toBeNull();
    expect(e.contactEmail).toBeNull();
  });

  it("rowToEvent parses theme jsonb", () => {
    const e = rowToEvent({
      ...baseEvent,
      theme: { preset: "disco", accent: "#ABC" },
      contact_name: "Pat",
      contact_email: "pat@x.com",
    });
    expect(e.theme).toEqual({ preset: "clubhouse", accent: "#aabbcc" });
    expect(e.contactName).toBe("Pat");
    expect(e.contactEmail).toBe("pat@x.com");
  });

  it("eventToRow writes theme and contact", () => {
    const row = eventToRow({
      theme: { preset: "evening" },
      contactName: "Pat",
      contactEmail: "pat@x.com",
    });
    expect(row.theme).toEqual({ preset: "evening" });
    expect(row.contact_name).toBe("Pat");
    expect(row.contact_email).toBe("pat@x.com");
    expect(eventToRow({ title: "x" })).not.toHaveProperty("theme");
  });
});

describe("saving before the look migration has run", () => {
  it("recognises PostgREST's missing-column error for the look columns", () => {
    expect(
      isMissingLookColumn({
        code: "PGRST204",
        message: "Could not find the 'contact_email' column of 'events' in the schema cache",
      }),
    ).toBe(true);
    expect(isMissingLookColumn({ code: "42703", message: 'column "theme" does not exist' })).toBe(true);
    expect(isMissingLookColumn({ code: "PGRST204", message: "Could not find the 'title' column" })).toBe(false);
    expect(isMissingLookColumn(null)).toBe(false);
  });

  it("drops only the look columns from a row", () => {
    const row = eventToRow({ title: "T", theme: null, contactName: null, contactEmail: null });
    expect(withoutLookColumns(row)).toEqual({ title: "T" });
  });
});
