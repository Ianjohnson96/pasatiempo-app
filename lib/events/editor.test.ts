import { describe, expect, it } from "vitest";
import {
  EDITOR_SECTIONS,
  TYPE_TILES,
  TYPE_SWITCH_BLOCKED,
  buildEventInput,
  crossesTournamentBoundary,
  editorError,
  fromLocalInput,
  previewEvent,
  previewSeats,
  typeRules,
  type EditorState,
} from "./editor";
import type { Slot } from "./types";

const slot = (id: string): Slot => ({
  id,
  date: "2026-12-05",
  startTime: "09:00",
  endTime: "10:00",
  label: "",
  note: "",
  capacity: 8,
});

function state(over: Partial<EditorState> = {}): EditorState {
  return {
    title: "Member Twilight Dinner",
    slug: " twilight ",
    type: "dinner",
    description: "<p>Menu</p>",
    info: "",
    location: "The Hollins House",
    scheduleMode: "single",
    startsAt: "2026-12-05T18:00",
    endsAt: "",
    allowMultiSlot: true,
    slotsPrompt: "Pick one",
    slots: [],
    hasCapacity: true,
    capacity: "40",
    waitlistEnabled: true,
    hasRosterLimit: false,
    rosterLimit: "20",
    allowGuests: true,
    maxGuests: "3",
    collectGuestNames: true,
    inviteOnly: false,
    allowlistText: "a@x.com",
    inviteOnlyMessage: "Members only",
    pricingEnabled: false,
    pricing: "",
    fields: [],
    showRoster: false,
    rosterStyle: "first_initial",
    managersText: "pro@pasatiempo.com\nother@x.com",
    status: "open",
    ...over,
  };
}

describe("tiles and steps", () => {
  it("lists the four types with their one-liners, tournament first", () => {
    expect(TYPE_TILES.map((t) => [t.type, t.blurb])).toEqual([
      ["tournament", "Two-player team entry with GHIN"],
      ["dinner", "Seated or social, guests welcome"],
      ["clinic", "Dates or time slots"],
      ["general", "Anything else"],
    ]);
  });

  it("has the seven sections in order", () => {
    expect(EDITOR_SECTIONS.map((s) => s.id)).toEqual([
      "details",
      "schedule",
      "questions",
      "pricing",
      "roster",
      "access",
      "publish",
    ]);
    expect(EDITOR_SECTIONS[2].label).toBe("Players & Questions");
  });
});

describe("typeRules", () => {
  it("hides slots, roster cap and guests for a tournament and counts teams", () => {
    const r = typeRules("tournament");
    expect(r).toMatchObject({
      tournament: true,
      scheduleSwitch: false,
      slots: false,
      rosterCap: false,
      guests: false,
      capacityLabel: "Max teams",
    });
  });

  it("shows everything for the other types", () => {
    for (const t of ["dinner", "clinic", "general"] as const) {
      expect(typeRules(t)).toMatchObject({
        tournament: false,
        scheduleSwitch: true,
        slots: true,
        rosterCap: true,
        guests: true,
        capacityLabel: "Total spots",
      });
    }
  });
});

describe("buildEventInput", () => {
  it("builds a dinner's payload exactly as the editor always has", () => {
    expect(buildEventInput(state(), "ev1")).toEqual({
      id: "ev1",
      slug: "twilight",
      title: "Member Twilight Dinner",
      type: "dinner",
      description: "<p>Menu</p>",
      info: "",
      location: "The Hollins House",
      startsAt: fromLocalInput("2026-12-05T18:00"),
      endsAt: null,
      scheduleMode: "single",
      allowMultiSlot: false,
      slotsPrompt: "Pick one",
      slots: [],
      capacity: 40,
      rosterLimit: null,
      waitlistEnabled: true,
      allowGuests: true,
      maxGuests: 3,
      collectGuestNames: true,
      inviteOnly: false,
      allowlist: [],
      inviteOnlyMessage: "",
      customFields: [],
      pricingEnabled: false,
      pricing: "",
      showRoster: false,
      rosterStyle: "first_initial",
      managers: ["pro@pasatiempo.com", "other@x.com"],
      status: "open",
    });
  });

  it("keeps a clinic's slots and drops its single date", () => {
    const input = buildEventInput(
      state({ type: "clinic", scheduleMode: "slots", slots: [slot("s1")] }),
    );
    expect(input.scheduleMode).toBe("slots");
    expect(input.startsAt).toBeNull();
    expect(input.capacity).toBeNull();
    expect(input.allowMultiSlot).toBe(true);
    expect(input.slots).toHaveLength(1);
  });

  it("treats a tournament as a single date even if slots were picked first", () => {
    const input = buildEventInput(
      state({ type: "tournament", scheduleMode: "slots", capacity: "36" }),
    );
    expect(input.scheduleMode).toBe("single");
    expect(input.startsAt).toBe(fromLocalInput("2026-12-05T18:00"));
    expect(input.capacity).toBe(36);
  });

  it("clamps numbers the way the editor did", () => {
    const input = buildEventInput(
      state({ capacity: "0", hasRosterLimit: true, rosterLimit: "x", maxGuests: "" }),
    );
    expect(input.capacity).toBe(1);
    expect(input.rosterLimit).toBe(1);
    expect(input.maxGuests).toBe(1);
  });
});

describe("editorError", () => {
  it("needs a title", () => {
    expect(editorError(state({ title: "  " }))).toBe(
      "Please give the event a title.",
    );
  });
  it("needs a slot in slots mode, but not for a tournament", () => {
    expect(editorError(state({ scheduleMode: "slots" }))).toBe(
      "Add at least one date/time slot, or switch to a single date.",
    );
    expect(
      editorError(state({ type: "tournament", scheduleMode: "slots" })),
    ).toBeNull();
  });
});

describe("previewEvent", () => {
  it("fills placeholders and forces a tournament's team settings", () => {
    const ev = previewEvent(
      buildEventInput(
        state({
          type: "tournament",
          title: "  ",
          slug: "",
          allowGuests: false,
          hasRosterLimit: true,
          fields: [
            {
              id: "q1",
              label: "",
              type: "short_text",
              required: false,
              options: [],
              scope: "team",
            },
          ],
        }),
      ),
    );
    expect(ev).toMatchObject({
      id: "preview",
      slug: "preview",
      title: "Untitled event",
      photos: [],
      allowGuests: true,
      maxGuests: 1,
      collectGuestNames: true,
      rosterLimit: null,
    });
    expect(ev.customFields[0]).toMatchObject({
      label: "Untitled question",
      scope: "team",
    });
  });

  it("asks every question of the one registrant off-tournament", () => {
    const ev = previewEvent(
      buildEventInput(
        state({
          fields: [
            {
              id: "q1",
              label: "Meal",
              type: "short_text",
              required: true,
              options: [],
              scope: "team",
            },
          ],
        }),
      ),
    );
    expect(ev.customFields[0].scope).toBe("player");
  });

  it("opens every seat and slot", () => {
    const ev = previewEvent(
      buildEventInput(
        state({
          type: "clinic",
          scheduleMode: "slots",
          slots: [slot("a"), { ...slot("b"), capacity: null }],
        }),
      ),
    );
    expect(previewSeats(ev)).toEqual({
      remaining: null,
      full: false,
      slots: [
        { id: "a", remaining: 8, full: false },
        { id: "b", remaining: null, full: false },
      ],
    });
  });

  it("leaves the whole capacity open for a single date", () => {
    const ev = previewEvent(buildEventInput(state({ capacity: "40" })));
    expect(previewSeats(ev)).toEqual({ remaining: 40, full: false, slots: [] });
  });
});

describe("crossesTournamentBoundary", () => {
  it("is true only when exactly one side is a tournament", () => {
    expect(crossesTournamentBoundary("dinner", "tournament")).toBe(true);
    expect(crossesTournamentBoundary("clinic", "tournament")).toBe(true);
    expect(crossesTournamentBoundary("tournament", "general")).toBe(true);
    expect(crossesTournamentBoundary("tournament", "tournament")).toBe(false);
    expect(crossesTournamentBoundary("dinner", "clinic")).toBe(false);
    expect(crossesTournamentBoundary("general", "general")).toBe(false);
  });

  it("tells staff why the save was refused", () => {
    expect(TYPE_SWITCH_BLOCKED).toBe(
      "This event already has sign-ups, so it can't be switched to or from Tournament. Make a new event instead.",
    );
  });
});
