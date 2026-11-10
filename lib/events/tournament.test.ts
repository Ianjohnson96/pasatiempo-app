import { describe, expect, it } from "vitest";
import {
  cleanTeam,
  duplicateMessage,
  findDuplicate,
  isAnswered,
  isValidGhin,
  normalizeGhin,
  validateTeam,
  type TeamInput,
} from "./tournament";
import type { CustomField, EventRec, Player, Registration } from "./types";

const field = (
  id: string,
  label: string,
  scope: CustomField["scope"],
  required = true,
): CustomField => ({ id, label, type: "short_text", required, options: [], scope });

const player = (role: Player["role"], over: Partial<Player> = {}): Player => ({
  role,
  name: role === "member" ? "Mia Member" : "Gus Guest",
  email: role === "member" ? "mia@x.com" : "gus@x.com",
  ghin: role === "member" ? "1111111" : "2222222",
  answers: {},
  ...over,
});

const team = (
  m: Partial<Player> = {},
  g: Partial<Player> = {},
  teamAnswers: TeamInput["teamAnswers"] = {},
): TeamInput => ({
  players: [player("member", m), player("guest", g)],
  teamAnswers,
});

const event = (customFields: CustomField[] = []) =>
  ({ customFields }) as unknown as EventRec;

const SAME = "The member and guest can't be the same person.";

describe("GHIN", () => {
  it("normalises and validates", () => {
    expect(normalizeGhin(" 123-4567 ")).toBe("1234567");
    expect(isValidGhin("12a4")).toBe(false);
    expect(isValidGhin("")).toBe(false);
    expect(isValidGhin("123 4567")).toBe(true);
  });
});

describe("isAnswered", () => {
  it("treats blanks and empty arrays as unanswered", () => {
    expect(isAnswered([])).toBe(false);
    expect(isAnswered("  ")).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered(["M"])).toBe(true);
  });
});

describe("validateTeam", () => {
  const opts = { enforceRequired: true };

  it("accepts a good team", () => {
    expect(validateTeam(event(), team(), opts)).toBeNull();
  });

  it("flags player errors with a role prefix", () => {
    expect(validateTeam(event(), team({}, { email: "" }), opts)).toBe(
      "Guest: please enter a valid email.",
    );
    expect(validateTeam(event(), team({ name: " " }), opts)).toBe(
      "Member: please enter a name.",
    );
    expect(validateTeam(event(), team({ ghin: "" }), opts)).toBe(
      "Member: please enter a GHIN number.",
    );
    expect(validateTeam(event(), team({}, { ghin: "12a" }), opts)).toBe(
      "Guest: GHIN numbers are digits only.",
    );
  });

  it("checks required player questions only when enforced", () => {
    const ev = event([field("shirt", "Shirt size", "player")]);
    const t = team({ answers: { shirt: "L" } }, { answers: { shirt: " " } });
    expect(validateTeam(ev, t, opts)).toBe("Guest: please answer Shirt size.");
    expect(validateTeam(ev, t, { enforceRequired: false })).toBeNull();
  });

  it("checks required team questions", () => {
    const ev = event([field("tn", "Team name", "team")]);
    expect(validateTeam(ev, team(), opts)).toBe("Please answer Team name.");
    expect(validateTeam(ev, team({}, {}, { tn: "Aces" }), opts)).toBeNull();
  });

  it("rejects the same person as member and guest", () => {
    expect(
      validateTeam(event(), team({ email: "A@x.com" }, { email: "a@X.com" }), opts),
    ).toBe(SAME);
    expect(
      validateTeam(event(), team({ ghin: "123-4567" }, { ghin: "1234567" }), opts),
    ).toBe(SAME);
  });
});

describe("findDuplicate", () => {
  const existing = (
    status: Registration["status"],
    players: Player[] | null,
    id = "r1",
  ) => ({ id, status, players }) as unknown as Registration;

  it("matches a guest email against any player, normalised", () => {
    const regs = [existing("confirmed", [player("member", { email: "bob@x.com", ghin: "5555" }), player("guest", { email: "q@x.com", ghin: "6666" })])];
    expect(findDuplicate(regs, team({}, { email: " Bob@X.com" }))).toBe("guest");
  });

  it("matches a member GHIN", () => {
    const regs = [existing("waitlist", [player("member", { email: "p@x.com", ghin: "7777" }), player("guest", { email: "r@x.com", ghin: "1234567" })])];
    expect(findDuplicate(regs, team({ ghin: "123-4567" }))).toBe("member");
  });

  it("returns null when there is no clash", () => {
    const regs = [existing("confirmed", [player("member", { email: "z@z.com", ghin: "9" }), player("guest", { email: "y@z.com", ghin: "8" })])];
    expect(findDuplicate(regs, team())).toBeNull();
  });

  it("ignores cancelled, excluded and non-tournament registrations", () => {
    const clash = [player("member", { email: "bob@x.com", ghin: "5555" }), player("guest", { email: "q@x.com", ghin: "6666" })];
    const t = team({}, { email: "bob@x.com" });
    expect(findDuplicate([existing("cancelled", clash)], t)).toBeNull();
    expect(findDuplicate([existing("confirmed", clash, "r1")], t, "r1")).toBeNull();
    expect(findDuplicate([existing("confirmed", null)], t)).toBeNull();
  });

  it("has the contact-the-shop copy", () => {
    expect(duplicateMessage("guest")).toBe(
      "That guest is already entered on another team. Questions? Contact the golf shop.",
    );
    expect(duplicateMessage("member")).toBe(
      "You're already entered on another team. Questions? Contact the golf shop.",
    );
  });
});

describe("cleanTeam", () => {
  it("trims, lower-cases, forces roles and drops stale or wrong-scope keys", () => {
    const fields = [field("shirt", "Shirt", "player"), field("tn", "Team", "team")];
    const out = cleanTeam(
      {
        players: [
          player("guest", {
            name: " Mia ",
            email: " MIA@x.com ",
            ghin: "1-2",
            answers: { shirt: " L ", gone: "x", tn: "wrong" },
          }),
          player("member", { answers: { shirt: ["a", " ", " b "] } }),
        ],
        teamAnswers: { tn: " Aces ", shirt: "wrong", gone: "x" },
      },
      fields,
    );
    expect(out.players.map((p) => p.role)).toEqual(["member", "guest"]);
    expect(out.players[0].name).toBe("Mia");
    expect(out.players[0].email).toBe("mia@x.com");
    expect(out.players[0].ghin).toBe("12");
    expect(out.players[0].answers).toEqual({ shirt: "L" });
    expect(out.players[1].answers).toEqual({ shirt: ["a", "b"] });
    expect(out.teamAnswers).toEqual({ tn: "Aces" });
  });
});
