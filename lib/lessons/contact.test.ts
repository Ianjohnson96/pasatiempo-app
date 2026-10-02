import { describe, expect, it } from "vitest";
import {
  firstName,
  mailHref,
  nextPackageText,
  smsHref,
  telHref,
} from "./contact";

describe("contact links", () => {
  it("dials digits only, keeping a leading +", () => {
    expect(telHref("(831) 555-0142")).toBe("tel:8315550142");
    expect(telHref("+1 831 555 0142")).toBe("tel:+18315550142");
  });
  it("has no link without a usable number", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref("ask at desk")).toBeNull();
    expect(smsHref("", "hi")).toBeNull();
  });
  it("prefills a text in a form both iPhone and Android read", () => {
    expect(smsHref("831-555-0142", "One left & next?")).toBe(
      "sms:8315550142?&body=One%20left%20%26%20next%3F",
    );
  });
  it("mails a real address only", () => {
    expect(mailHref("ray@example.com")).toBe("mailto:ray@example.com");
    expect(mailHref("none")).toBeNull();
  });
});

describe("nextPackageText", () => {
  it("uses the first name and the package size", () => {
    expect(nextPackageText("Ray gorski", 5)).toBe(
      "Hi Ray, you've got one lesson left in your package. Want me to set up the next 5?",
    );
  });
  it("capitalises a lower-case first name", () => {
    expect(firstName("patsy leung")).toBe("Patsy");
  });
});
