import { describe, expect, it } from "vitest";
import { renderEmail, type EmailDoc } from "./email-layout";

const doc = (over: Partial<EmailDoc> = {}): EmailDoc => ({
  to: "pat@example.com",
  subject: "Holiday Dinner: you're registered",
  preheader: "Fri, Dec 11 · Hollins House",
  status: "confirmed",
  greeting: "Hi Pat,",
  heading: "Holiday Dinner",
  intro: "You're registered for Holiday Dinner.",
  details: [
    { label: "When", lines: ["Fri, Dec 11, 2026 · 6:00 PM"] },
    { label: "Where", lines: ["Hollins House"] },
  ],
  sections: [{ title: "Your answers", rows: [{ label: "Dietary needs", value: "Vegetarian" }] }],
  message: "Jackets suggested.\nThe bar opens at 6.",
  signOff: "— The Social Committee",
  manage: { url: "https://club.test/events/e/holiday-dinner", verb: "change or cancel" },
  contact: { name: "Ian Johnson", email: "ijohnson@club.test" },
  ...over,
});

describe("renderEmail: plain text", () => {
  it("reads top to bottom in a sensible order", () => {
    const t = renderEmail(doc()).text;
    const order = [
      "Hi Pat,",
      "You're registered for Holiday Dinner.",
      "When: Fri, Dec 11, 2026 · 6:00 PM",
      "Where: Hollins House",
      "YOUR ANSWERS",
      "Dietary needs: Vegetarian",
      "Jackets suggested.\nThe bar opens at 6.",
      "— The Social Committee",
      'To change or cancel, open https://club.test/events/e/holiday-dinner and choose "Manage my registration".',
      "Questions? Contact Ian Johnson at ijohnson@club.test.",
    ];
    let at = -1;
    for (const s of order) {
      const i = t.indexOf(s);
      expect(i, s).toBeGreaterThan(at);
      at = i;
    }
    expect(t.trim().endsWith("Questions? Contact Ian Johnson at ijohnson@club.test.")).toBe(true);
  });
  it("a detail with several lines lists them under its label", () => {
    const t = renderEmail(doc({ details: [{ label: "When", lines: ["Dec 1", "Dec 8"] }] })).text;
    expect(t).toContain("When:\n  Dec 1\n  Dec 8");
  });
  it("no manage link without a page address", () => {
    expect(renderEmail(doc({ manage: null })).text).not.toContain("To change");
  });
});

describe("renderEmail: HTML that email programs render well", () => {
  const html = renderEmail(doc()).html;
  it("is a full document laid out with tables and inline styles", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('role="presentation"');
    expect(html).toContain('width="600"');
    expect(html).not.toMatch(/<style|<script|class="/i);
  });
  it("carries a hidden preview line for the inbox", () => {
    expect(html).toContain("Fri, Dec 11 · Hollins House");
    expect(html).toMatch(/display:none[^>]*>Fri, Dec 11 · Hollins House/);
  });
  it("shows the status, the event and the details", () => {
    expect(html).toContain("You&#39;re registered");
    expect(html).toContain("Holiday Dinner");
    expect(html).toContain("Hollins House");
    expect(html).toContain("Dietary needs");
  });
  it("has a real button to manage the registration, and a mailto contact", () => {
    expect(html).toContain('href="https://club.test/events/e/holiday-dinner"');
    expect(html).toContain("Manage my registration");
    expect(html).toContain('href="mailto:ijohnson@club.test"');
  });
  it("keeps the message's line breaks", () => {
    expect(html).toContain("Jackets suggested.<br>The bar opens at 6.");
  });
  it("a waitlist email says so in the banner", () => {
    expect(renderEmail(doc({ status: "waitlist" })).html).toContain("You&#39;re on the waitlist");
  });
  it("escapes everything a member or staff member typed", () => {
    const h = renderEmail(
      doc({
        greeting: "Hi <b>Pat</b>,",
        sections: [{ title: "Answers", rows: [{ label: "x", value: "<script>alert(1)</script>" }] }],
        manage: { url: 'https://x.test/"><script>', verb: "change or cancel" },
      }),
    ).html;
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("<b>Pat</b>");
    expect(h).toContain("&lt;script&gt;");
  });
});
