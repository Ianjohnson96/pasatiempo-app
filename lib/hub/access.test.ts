import { describe, expect, it } from "vitest";
import { hasApp, isAppAdmin, roleIn, type Person } from "./access";
import { isRole, siteForPath, topRole } from "./apps";
import { safeNext } from "./next";

const person = (grants: Person["grants"], isSuper = false): Person => ({ email: "a@pasatiempo.com", name: "A", isSuper, grants });

describe("roles", () => {
  it("gives a super admin the top role in every app", () => {
    const s = person({}, true);
    expect(roleIn(s, "events")).toBe("admin");
    expect(roleIn(s, "caddie")).toBe("admin");
    expect(roleIn(s, "merch")).toBe("owner");
    expect(isAppAdmin(s, "merch")).toBe(true);
  });

  it("keeps each app separate", () => {
    const p = person({ merch: "staff" });
    expect(hasApp(p, "merch")).toBe(true);
    expect(hasApp(p, "events")).toBe(false);
    expect(hasApp(p, "caddie")).toBe(false);
    expect(isAppAdmin(p, "merch")).toBe(false);
  });

  it("honours an allowed-roles list", () => {
    const p = person({ events: "manager" });
    expect(hasApp(p, "events")).toBe(true);
    expect(hasApp(p, "events", ["admin"])).toBe(false);
    expect(hasApp(person({ events: "admin" }), "events", ["admin"])).toBe(true);
  });

  it("ignores a role that doesn't belong to the app", () => {
    expect(roleIn(person({ caddie: "owner" }), "caddie")).toBeNull();
    expect(isRole("merch", "manager")).toBe(false);
    expect(topRole("events")).toBe("admin");
  });

  it("treats nobody as having nothing", () => {
    expect(roleIn(null, "events")).toBeNull();
    expect(hasApp(null, "merch")).toBe(false);
  });
});

describe("public-site switches", () => {
  it("maps paths to their site", () => {
    expect(siteForPath("/mhi")).toBe("mhi");
    expect(siteForPath("/events/e/member-guest")).toBe("events");
    expect(siteForPath("/sombrero")).toBe("sombrero");
    expect(siteForPath("/eventsx")).toBeNull();
    expect(siteForPath("/merch")).toBeNull();
    expect(siteForPath("/caddie")).toBeNull();
  });
});

describe("safeNext", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/admin/events")).toBe("/admin/events");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext("/\\evil")).toBeNull();
    expect(safeNext("/login")).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
