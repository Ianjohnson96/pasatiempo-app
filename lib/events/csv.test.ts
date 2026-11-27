import { describe, expect, it } from "vitest";
import {
  csvCell,
  csvFilename,
  golfGeniusFilename,
  golfGeniusRows,
  signupRows,
  splitName,
  toCsv,
  tournamentRows,
} from "./csv";
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
  it("guards cells a spreadsheet would run as a formula", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell("\tx")).toBe("'\tx");
    // A carriage return also needs quoting so it can't split the row.
    expect(csvCell("\rx")).toBe("\"'\rx\"");
    expect(csvCell("-cmd")).toBe("'-cmd");
    // The guard goes on first, then the usual quoting.
    expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });
  it("leaves plain negative numbers and ordinary text alone", () => {
    expect(csvCell("-12")).toBe("-12");
    expect(csvCell("-1.5")).toBe("-1.5");
    expect(csvCell("a=b")).toBe("a=b");
    expect(csvCell("")).toBe("");
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

describe("splitName", () => {
  it("splits first and last on the final word", () => {
    expect(splitName("Pat Lee")).toEqual({ first: "Pat", last: "Lee", suffix: "" });
    expect(splitName("  Mary Ann   Smith ")).toEqual({ first: "Mary Ann", last: "Smith", suffix: "" });
  });
  it("keeps a suffix out of the last name, so GHIN's name check matches", () => {
    expect(splitName("John Smith Jr.")).toEqual({ first: "John", last: "Smith", suffix: "Jr." });
    expect(splitName("Robert Jones III")).toEqual({ first: "Robert", last: "Jones", suffix: "III" });
  });
  it("reads 'Last, First'", () => {
    expect(splitName("Smith, John")).toEqual({ first: "John", last: "Smith", suffix: "" });
  });
  it("puts a single word in the last name (the one column Golf Genius requires)", () => {
    expect(splitName("Cher")).toEqual({ first: "", last: "Cher", suffix: "" });
  });
});

describe("golfGeniusRows", () => {
  const e = ev();
  const regs = [
    reg("a", "2026-01-01", {
      players: [
        { ...player("member", "Pat Lee", { shirt: "M" }), ghin: "123 456-7" },
        player("guest", "Sam Ortiz", { shirt: "L" }),
      ],
      answers: { cart: "Yes" },
      phone: "555-0100",
    }),
    reg("w", "2026-01-02", { status: "waitlist", players: [player("member", "Wait List"), player("guest", "Wait Guest")] }),
    reg("c", "2026-01-03", { status: "cancelled", players: [player("member", "Gone Away"), player("guest", "Also Gone")] }),
    reg("b", "2026-01-04", { players: [player("member", "Ann Bo"), player("guest", "Cy Dee")] }),
  ];
  const rows = golfGeniusRows(e, regs);

  it("has the headings Golf Genius matches on", () => {
    expect(rows[0]).toEqual([
      "First Name",
      "Last Name",
      "Suffix",
      "Email",
      "Handicap Service ID",
      "Team",
      "Member or Guest",
      "Phone",
      "Shirt",
      "Cart",
    ]);
  });

  it("lists confirmed teams only, one row per player, with the shared team number", () => {
    const body = rows.slice(1);
    expect(body.map((r) => r[1])).toEqual(["Lee", "Ortiz", "Bo", "Dee"]);
    // team numbers are the Manage page's: the waitlisted team keeps no. 2
    expect(body.map((r) => r[5])).toEqual(["1", "1", "3", "3"]);
  });

  it("cleans GHIN numbers to digits and fills each column", () => {
    expect(rows[1]).toEqual(["Pat", "Lee", "", "Pat Lee@x.com", "1234567", "1", "Member", "555-0100", "M", "Yes"]);
    expect(rows[2][6]).toBe("Guest");
    expect(rows[2][7]).toBe("");
  });

  it("names the file for Golf Genius", () => {
    expect(golfGeniusFilename(e)).toBe("member-guest-2026-golf-genius.csv");
  });
});
