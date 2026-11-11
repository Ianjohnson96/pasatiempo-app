import { describe, expect, it } from "vitest";
import { rowToEvent, rowToReg } from "./map";
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
