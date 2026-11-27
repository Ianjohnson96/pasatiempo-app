import { describe, expect, test } from "vitest";
import { matchesRegFilter, matchesRegSearch, regFilterCounts } from "./search";
import type { Registration } from "./types";

function reg(over: Partial<Registration> = {}): Registration {
  return {
    id: "r1",
    eventId: "e1",
    name: "Pat Smith",
    email: "pat@example.com",
    phone: "831-555-0100",
    partySize: 1,
    guestNames: [],
    slotIds: [],
    answers: {},
    players: null,
    emailFailed: false,
    status: "confirmed",
    createdAt: "",
    paid: false,
    feeCents: null,
    tender: null,
    paidOn: null,
    paymentNote: "",
    ...over,
  };
}

describe("matchesRegSearch", () => {
  test("a blank search matches everyone", () => {
    expect(matchesRegSearch(reg(), "  ")).toBe(true);
  });
  test("matches name and email, ignoring case", () => {
    expect(matchesRegSearch(reg(), "SMITH")).toBe(true);
    expect(matchesRegSearch(reg(), "pat@ex")).toBe(true);
    expect(matchesRegSearch(reg(), "jones")).toBe(false);
  });
  test("every word must match somewhere", () => {
    expect(matchesRegSearch(reg(), "pat smith")).toBe(true);
    expect(matchesRegSearch(reg(), "pat jones")).toBe(false);
  });
  test("matches a guest's name", () => {
    expect(matchesRegSearch(reg({ guestNames: ["Lee Wong"] }), "wong")).toBe(true);
  });
  test("matches a tournament player's name, email or GHIN", () => {
    const r = reg({
      players: [
        { role: "member", name: "Pat Smith", email: "pat@example.com", ghin: "1234567", answers: {} },
        { role: "guest", name: "Chris Doe", email: "chris@doe.com", ghin: "7654321", answers: {} },
      ],
    });
    expect(matchesRegSearch(r, "doe")).toBe(true);
    expect(matchesRegSearch(r, "765432")).toBe(true);
    expect(matchesRegSearch(r, "chris@doe")).toBe(true);
  });
  test("matches a phone number by its digits", () => {
    expect(matchesRegSearch(reg(), "5550100")).toBe(true);
  });
});

describe("regFilter", () => {
  const rs = [
    reg({ id: "a", status: "confirmed" }),
    reg({ id: "b", status: "confirmed", emailFailed: true }),
    reg({ id: "c", status: "waitlist", emailFailed: true }),
    reg({ id: "d", status: "cancelled" }),
  ];
  test("each filter keeps its sign-ups", () => {
    expect(rs.filter((r) => matchesRegFilter(r, "all")).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
    expect(rs.filter((r) => matchesRegFilter(r, "confirmed")).map((r) => r.id)).toEqual(["a", "b"]);
    expect(rs.filter((r) => matchesRegFilter(r, "waitlist")).map((r) => r.id)).toEqual(["c"]);
    expect(rs.filter((r) => matchesRegFilter(r, "cancelled")).map((r) => r.id)).toEqual(["d"]);
  });
  test("'email not sent' skips cancelled sign-ups", () => {
    const withCancelledFail = [...rs, reg({ id: "e", status: "cancelled", emailFailed: true })];
    expect(withCancelledFail.filter((r) => matchesRegFilter(r, "email")).map((r) => r.id)).toEqual(["b", "c"]);
  });
  test("counts for the buttons", () => {
    expect(regFilterCounts(rs)).toEqual({ all: 4, confirmed: 2, waitlist: 1, cancelled: 1, email: 2 });
  });
});
