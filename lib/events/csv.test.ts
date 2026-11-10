import { describe, expect, it } from "vitest";
import { csvCell, csvFilename, signupRows, toCsv, tournamentRows } from "./csv";
import type { CustomField, EventRec, Player, Registration } from "./types";

const field = (id: string, label: string, scope: "player" | "team"): CustomField => ({
  id,
  label,
  type: "short_text",
  required: false,
  options: [],
  scope,
});

function ev(over: Partial<EventRec> = {}): EventRec {
  return {
    id: "e1",
    slug: "s",
    title: "Member-Guest 2026",
    type: "tournament",
    customFields: [field("shirt", "Shirt", "player"), field("cart", "Cart", "team")],
    slots: [],
    collectGuestNames: false,
    ...over,
  } as EventRec;
}

const player = (role: "member" | "guest", name: string, answers = {}): Player => ({
  role,
  name,
  email: `${name}@x.com`,
  ghin: "123",
  answers,
});

function reg(id: string, createdAt: string, over: Partial<Registration> = {}): Registration {
  return {
    id,
    eventId: "e1",
    name: "Mem " + id,
    email: "m@x.com",
    phone: "555-1",
    partySize: 2,
    guestNames: [],
    slotIds: [],
    answers: { cart: "Yes" },
    players: [
      player("member", "Mem" + id, { shirt: ["S", "M"] }),
      player("guest", "Gst" + id, { shirt: "L" }),
    ],
    emailFailed: false,
    status: "confirmed",
    createdAt,
    ...over,
  } as Registration;
}

describe("csvCell / toCsv", () => {
  it("quotes commas and quotes", () => {
    expect(csvCell('No nuts, "severe"')).toBe('"No nuts, ""severe"""');
    expect(csvCell("plain")).toBe("plain");
  });
  it("joins with CRLF", () => {
    expect(toCsv([["a", "b,c"], ["d", "e"]])).toBe('a,"b,c"\r\nd,e');
  });
});

describe("tournamentRows", () => {
  it("one row per player under the header", () => {
    const rows = tournamentRows(ev(), [
      reg("a", "2026-01-01T00:00:00Z"),
      reg("b", "2026-01-02T00:00:00Z"),
    ]);
    expect(rows).toHaveLength(5);
    expect(rows[0].slice(0, 6)).toEqual(["Team #", "Role", "Name", "Email", "GHIN", "Phone"]);
    expect(rows[0].slice(6)).toEqual(["Shirt", "Cart", "Status", "Registered at"]);
    expect(rows[1].slice(0, 2)).toEqual(["1", "Member"]);
    expect(rows[2].slice(0, 2)).toEqual(["1", "Guest"]);
    expect(rows[3].slice(0, 2)).toEqual(["2", "Member"]);
  });

  it("phone on the member row only; team answers repeat", () => {
    const rows = tournamentRows(ev(), [reg("a", "2026-01-01T00:00:00Z")]);
    expect(rows[1][5]).toBe("555-1");
    expect(rows[2][5]).toBe("");
    expect(rows[1][7]).toBe("Yes");
    expect(rows[2][7]).toBe("Yes");
  });

  it("joins multi answers", () => {
    const rows = tournamentRows(ev(), [reg("a", "2026-01-01T00:00:00Z")]);
    expect(rows[1][6]).toBe("S, M");
    expect(rows[2][6]).toBe("L");
  });

  it("ignores stale answer keys and blanks missing answers", () => {
    const r = reg("a", "2026-01-01T00:00:00Z", {
      answers: { stale: "zzz" },
      players: [player("member", "M", { gone: "x" }), player("guest", "G")],
    });
    const rows = tournamentRows(ev(), [r]);
    expect(rows[0]).toHaveLength(10);
    expect(rows.flat()).not.toContain("zzz");
    expect(rows.flat()).not.toContain("x");
    expect(rows[1][6]).toBe("");
    expect(rows[1][7]).toBe("");
  });

  it("puts cancelled teams last with blank Team #", () => {
    const rows = tournamentRows(ev(), [
      reg("a", "2026-01-01T00:00:00Z", { status: "cancelled" }),
      reg("b", "2026-01-02T00:00:00Z"),
      reg("c", "2026-01-03T00:00:00Z", { status: "waitlist" }),
    ]);
    expect(rows.slice(1).map((r) => r[0])).toEqual(["1", "1", "2", "2", "", ""]);
    expect(rows[5][2]).toBe("Mema");
    expect(rows[1][2]).toBe("Memb");
  });
});

describe("signupRows / csvFilename", () => {
  it("keeps today's columns", () => {
    const e = ev({
      type: "general",
      slots: [],
      collectGuestNames: true,
      customFields: [field("q", "Diet", "player")],
    });
    const rows = signupRows(e, [
      reg("a", "2026-01-01T00:00:00Z", { players: null, guestNames: ["A", "B"], answers: { q: "None" } }),
    ]);
    expect(rows[0]).toEqual([
      "Status", "Name", "Email", "Phone", "Party size", "Guests", "Diet", "Registered at",
    ]);
    expect(rows[1].slice(0, 7)).toEqual(["confirmed", "Mem a", "m@x.com", "555-1", "2", "A; B", "None"]);
  });

  it("names files by type", () => {
    expect(csvFilename(ev())).toBe("member-guest-2026-teams.csv");
    expect(csvFilename(ev({ type: "dinner" }))).toBe("member-guest-2026-signups.csv");
  });
});
