import { describe, it, expect } from "vitest";
import { teamEmails } from "./tournament-email";
import type { EventRec, Player } from "./types";

const event = {
  title: "Member-Guest",
  location: "Pasatiempo",
  startsAt: "2026-08-01T15:00:00.000Z",
  endsAt: null,
  customFields: [
    { id: "shirt", label: "Shirt size", type: "short_text", required: false, options: [], scope: "player" },
    { id: "cart", label: "Cart", type: "short_text", required: false, options: [], scope: "team" },
    { id: "empty", label: "Empty", type: "short_text", required: false, options: [], scope: "player" },
  ],
} as unknown as EventRec;

const member: Player = {
  role: "member",
  name: "Mia Member",
  email: "mia@member.test",
  ghin: "1111111",
  answers: { shirt: "M", empty: "", ghost: "x" },
};
const guest: Player = {
  role: "guest",
  name: "Gus Guest",
  email: "gus@guest.test",
  ghin: "2222222",
  answers: { shirt: "L" },
};

describe("teamEmails", () => {
  it("addresses the member then the guest", () => {
    const [a, b] = teamEmails(event, [member, guest], { cart: "Yes" }, "confirmed");
    expect(a.to).toBe("mia@member.test");
    expect(b.to).toBe("gus@guest.test");
    expect(a.subject).toBe("Member-Guest: your team entry");
  });

  it("uses a waitlist subject and status line", () => {
    const [a] = teamEmails(event, [member, guest], {}, "waitlist");
    expect(a.subject).toBe("Member-Guest: you're on the waitlist");
    expect(a.text).toContain("on the waitlist; we'll be in touch");
  });

  it("never leaks the other player's email or GHIN", () => {
    const [a, b] = teamEmails(event, [member, guest], {}, "confirmed");
    for (const s of [a.text, a.html]) {
      expect(s).not.toContain(guest.email);
      expect(s).not.toContain(guest.ghin);
    }
    for (const s of [b.text, b.html]) {
      expect(s).not.toContain(member.email);
      expect(s).not.toContain(member.ghin);
    }
  });

  it("tells the guest who entered them", () => {
    const [a, b] = teamEmails(event, [member, guest], {}, "confirmed");
    expect(b.text).toContain("entered this team for you");
    expect(b.text).toContain("Mia Member entered this team for you.");
    expect(a.text).not.toContain("entered this team for you");
  });

  it("lists own and team answers, skipping empty and unknown", () => {
    const [a, b] = teamEmails(event, [member, guest], { cart: "Yes" }, "confirmed");
    expect(a.text).toContain("Shirt size: M");
    expect(b.text).toContain("Shirt size: L");
    expect(a.text).toContain("Cart: Yes");
    expect(a.text).not.toContain("Empty");
    expect(a.text).not.toContain("ghost");
    expect(a.text).toContain("Team: Mia Member & Gus Guest");
    expect(a.text.trim().endsWith("Questions? Contact the golf shop.")).toBe(true);
  });

  it("escapes names in html", () => {
    const evil = { ...guest, name: "<b>x</b>" };
    const [a] = teamEmails(event, [member, evil], {}, "confirmed");
    expect(a.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(a.html).not.toContain("<b>x</b>");
  });
});
