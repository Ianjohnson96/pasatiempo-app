import { describe, expect, it } from "vitest";
import { hostnameOf, isLoopback, resolveOrigin } from "./origin";

describe("hostnameOf", () => {
  it("drops the port", () => {
    expect(hostnameOf("localhost:3000")).toBe("localhost");
    expect(hostnameOf("pasatiempo-app.vercel.app")).toBe(
      "pasatiempo-app.vercel.app",
    );
  });

  it("unwraps bracketed IPv6 without mistaking a group for a port", () => {
    expect(hostnameOf("[::1]:3000")).toBe("::1");
    expect(hostnameOf("[::1]")).toBe("::1");
  });

  it("is case-insensitive and trims", () => {
    expect(hostnameOf("  Caddie.Pasatiempo.COM  ")).toBe(
      "caddie.pasatiempo.com",
    );
  });
});

describe("isLoopback", () => {
  it("recognises the machine-local names", () => {
    for (const h of [
      "localhost",
      "localhost:3000",
      "127.0.0.1:3300",
      "127.1.2.3",
      "[::1]:3000",
      "0.0.0.0:8080",
      "app.localhost:3000",
    ]) {
      expect(isLoopback(h), h).toBe(true);
    }
  });

  it("does not fire on real hosts", () => {
    for (const h of [
      "pasatiempo-app.vercel.app",
      "caddie.pasatiempo.com",
      "127x.example.com",
      "notlocalhost.com",
    ]) {
      expect(isLoopback(h), h).toBe(false);
    }
  });
});

describe("resolveOrigin", () => {
  // The bug this module exists for: NEXT_PUBLIC_SITE_URL was left at its
  // development value in production, so every invite pointed at a machine no
  // caddie could reach.
  it("ignores a localhost setting when the request came from outside", () => {
    expect(
      resolveOrigin({
        configured: "http://localhost:3000",
        host: "pasatiempo-app.vercel.app",
        proto: "https",
      }),
    ).toBe("https://pasatiempo-app.vercel.app");
  });

  it("still honours localhost in local development", () => {
    expect(
      resolveOrigin({
        configured: "http://localhost:3000",
        host: "localhost:3000",
        proto: null,
      }),
    ).toBe("http://localhost:3000");
  });

  it("uses a real configured origin over the request host", () => {
    expect(
      resolveOrigin({
        configured: "https://caddie.pasatiempo.com",
        host: "pasatiempo-app.vercel.app",
        proto: "https",
      }),
    ).toBe("https://caddie.pasatiempo.com");
  });

  it("strips trailing slashes so links do not double up", () => {
    expect(
      resolveOrigin({
        configured: "https://caddie.pasatiempo.com///",
        host: "x.vercel.app",
        proto: "https",
      }),
    ).toBe("https://caddie.pasatiempo.com");
  });

  it("falls back to the request when the setting is unset or blank", () => {
    for (const configured of [undefined, null, "", "   "]) {
      expect(
        resolveOrigin({ configured, host: "x.vercel.app", proto: "https" }),
      ).toBe("https://x.vercel.app");
    }
  });

  it("falls back when the setting is not a usable URL", () => {
    for (const configured of [
      "not a url",
      "pasatiempo.com",
      "mailto:pro@pasatiempo.com",
      "file:///etc/hosts",
    ]) {
      expect(
        resolveOrigin({ configured, host: "x.vercel.app", proto: "https" }),
        configured,
      ).toBe("https://x.vercel.app");
    }
  });

  it("assumes https for a real host and http for a local one", () => {
    expect(resolveOrigin({ host: "x.vercel.app", proto: null })).toBe(
      "https://x.vercel.app",
    );
    expect(resolveOrigin({ host: "localhost:3300", proto: null })).toBe(
      "http://localhost:3300",
    );
  });

  it("survives a request with no host at all", () => {
    expect(resolveOrigin({})).toBe("http://localhost:3000");
  });
});
