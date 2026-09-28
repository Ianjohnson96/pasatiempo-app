import { describe, expect, it } from "vitest";
import {
  composeText,
  parseReply,
  signatureMatches,
  toGsm,
  twilioSignature,
  twiml,
} from "./sms-words";

describe("parseReply", () => {
  it("reads yes and no in the ways people actually type them", () => {
    for (const s of ["Y", "y", "yes", "Yes!", " TAKE ", "ok", "1", "y see you there"]) {
      expect(parseReply(s)).toBe("accept");
    }
    for (const s of ["N", "no", "No thanks", "pass", "2"]) {
      expect(parseReply(s)).toBe("decline");
    }
  });

  it("treats the carrier keywords as the carrier does", () => {
    expect(parseReply("STOP")).toBe("stop");
    expect(parseReply("stop please")).toBe("stop");
    expect(parseReply("Unsubscribe")).toBe("stop");
    // CANCEL is a carrier opt-out word, not "cancel my loop".
    expect(parseReply("cancel")).toBe("stop");
    expect(parseReply("START")).toBe("start");
    expect(parseReply("help")).toBe("help");
  });

  it("does not guess at anything else", () => {
    expect(parseReply("")).toBe("unknown");
    expect(parseReply(null)).toBe("unknown");
    expect(parseReply("what time is the loop")).toBe("unknown");
    expect(parseReply("yesterday")).toBe("unknown");
  });
});

describe("toGsm", () => {
  it("swaps the characters that would triple the cost of a text", () => {
    expect(toGsm("Smith — Sat · 1:10 PM “VIP” it’s…")).toBe(
      'Smith - Sat | 1:10 PM "VIP" it\'s...',
    );
  });

  it("drops anything else outside plain text", () => {
    expect(toGsm("Loop ⛳ offered")).toBe("Loop  offered");
  });
});

describe("composeText", () => {
  it("names the sender, flattens lines and asks for an answer on an offer", () => {
    const t = composeText({
      title: "Loop offered to you",
      body: "Smith — Sat, Sep 27 1:10 PM\nDouble Bag",
      link: "https://example.test/caddie",
      reply: true,
    });
    expect(t).toBe(
      "Pasatiempo Caddies: Loop offered to you\nSmith - Sat, Sep 27 1:10 PM - Double Bag\nReply Y to take it or N to pass.\nhttps://example.test/caddie",
    );
  });

  it("leaves the reply line off a reminder", () => {
    expect(composeText({ title: "You're on tomorrow", body: "7:40 AM" })).not.toMatch(/Reply/);
  });
});

describe("Twilio signatures", () => {
  const url = "https://example.test/api/caddie/sms";
  const params = { From: "+18315550100", Body: "Y", MessageSid: "SM123", To: "+18315550199" };

  it("does not depend on the order the fields arrive in", () => {
    const reordered = { To: params.To, MessageSid: params.MessageSid, Body: "Y", From: params.From };
    expect(twilioSignature(url, reordered, "tok")).toBe(twilioSignature(url, params, "tok"));
  });

  it("accepts the right signature and refuses a tampered request", () => {
    const sig = twilioSignature(url, params, "tok");
    expect(signatureMatches(url, params, "tok", sig)).toBe(true);
    expect(signatureMatches(url, { ...params, Body: "N" }, "tok", sig)).toBe(false);
    expect(signatureMatches(url + "?x=1", params, "tok", sig)).toBe(false);
    expect(signatureMatches(url, params, "other", sig)).toBe(false);
    expect(signatureMatches(url, params, "tok", null)).toBe(false);
    expect(signatureMatches(url, params, "", sig)).toBe(false);
  });
});

describe("twiml", () => {
  it("answers with nothing, or with an escaped message", () => {
    expect(twiml()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    expect(twiml("A & B <ok>")).toContain("<Message>A &amp; B &lt;ok&gt;</Message>");
  });
});
