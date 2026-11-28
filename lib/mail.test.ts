import { afterEach, describe, expect, it, vi } from "vitest";
import { graphMessage, mailConfigured, mailRoute } from "./mail";

const mail = { to: "pat@example.com", subject: "You're registered", text: "Hi Pat", html: "<p>Hi Pat</p>" };

afterEach(() => vi.unstubAllEnvs());

describe("graphMessage", () => {
  it("sends the designed copy, saves it in Sent Items", () => {
    expect(graphMessage(mail)).toEqual({
      message: {
        subject: "You're registered",
        body: { contentType: "HTML", content: "<p>Hi Pat</p>" },
        toRecipients: [{ emailAddress: { address: "pat@example.com" } }],
      },
      saveToSentItems: true,
    });
  });
  it("keeps a display name on the recipient", () => {
    const m = graphMessage({ ...mail, to: '"Pat Smith" <pat@example.com>' });
    expect(m.message.toRecipients).toEqual([{ emailAddress: { name: "Pat Smith", address: "pat@example.com" } }]);
  });
  it("plain text when there's no HTML copy", () => {
    expect(graphMessage({ ...mail, html: "" }).message.body).toEqual({ contentType: "Text", content: "Hi Pat" });
  });
});

describe("mailRoute", () => {
  const graph = () => {
    vi.stubEnv("MS_TENANT_ID", "t");
    vi.stubEnv("MS_CLIENT_ID", "c");
    vi.stubEnv("MS_CLIENT_SECRET", "s");
  };
  it("nothing set up: no email", () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("MAIL_SENDER", "");
    expect(mailRoute()).toBeNull();
    expect(mailConfigured()).toBe(false);
  });
  it("Microsoft 365 when the app login and a sending mailbox are set", () => {
    graph();
    vi.stubEnv("MAIL_SENDER", "ijohnson@pasatiempo.com");
    expect(mailRoute()).toBe("graph");
    expect(mailConfigured()).toBe(true);
  });
  it("the app login alone (the lessons sync) doesn't send mail", () => {
    graph();
    vi.stubEnv("MAIL_SENDER", "");
    expect(mailRoute()).toBeNull();
  });
  it("an SMTP mailbox still works", () => {
    vi.stubEnv("MAIL_SENDER", "");
    vi.stubEnv("SMTP_HOST", "smtp.office365.com");
    vi.stubEnv("SMTP_USER", "u");
    vi.stubEnv("SMTP_PASS", "p");
    expect(mailRoute()).toBe("smtp");
  });
});
