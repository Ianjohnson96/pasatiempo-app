import { describe, expect, test } from "vitest";
import { contrast } from "./color";
import {
  DEFAULT_CONTACT,
  PRESETS,
  type PresetId,
  eventContact,
  parseTheme,
  resolveHero,
  resolveLogo,
  themeVars,
  unusedLogoPaths,
} from "./theme";

describe("theme model", () => {
  test("null and clubhouse are identical, and match today's tokens", () => {
    expect(themeVars(null)).toEqual(themeVars({ preset: "clubhouse" }));
    const v = themeVars(null).vars;
    expect(v["--bg"]).toBe("#f5f1e6");
    expect(v["--club"]).toBe("#173a2a");
    expect(v["--brass"]).toBe("#a2814a");
    expect(v["--btn"]).toBe("#173a2a");
    expect(v["--prose-ink"]).toBe("#2b322d");
    expect(v["--on-btn"]).toBe("#f5f1e6");
    expect(themeVars(null).adjusted).toBe(false);
    expect(resolveLogo(null)).toBe("/logo-full.png");
  });

  test("parseTheme is defensive", () => {
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme("nonsense")).toBeNull();
    expect(parseTheme({ preset: "disco" })?.preset).toBe("clubhouse");
    expect(parseTheme({ preset: "coastal", accent: "nope" })?.accent).toBeUndefined();
    expect(parseTheme({ preset: "coastal", accent: "#ABC" })?.accent).toBe("#aabbcc");
    expect(
      parseTheme({ preset: "evening", heroFocus: { x: 140, y: -5 } })?.heroFocus,
    ).toEqual({ x: 100, y: 0 });
    expect(parseTheme({ preset: "evening", logo: { library: "nope" } })?.logo).toBeUndefined();
    expect(parseTheme({ preset: "evening", logo: { library: "mark" } })?.logo).toEqual({
      library: "mark",
    });
  });

  test("every preset passes AA for its text pairs", () => {
    const pairs: [string, string][] = [
      ["--ink", "--bg"],
      ["--ink", "--card"],
      ["--muted", "--bg"],
      ["--muted", "--card"],
      ["--brass-ink", "--bg"],
      ["--on-btn", "--btn"],
      ["--on-hero-btn", "--hero-btn"],
      ["--danger", "--card"],
      ["--warn", "--card"],
      ["--on-btn", "--btn-hover"],
      ["--hero-ink", "--hero-bg"],
      ["--prose-ink", "--bg"],
      ["--notice-warn-ink", "--notice-warn-bg"],
      ["--danger", "--notice-err-bg"],
    ];
    for (const id of Object.keys(PRESETS) as PresetId[]) {
      const v = themeVars({ preset: id }).vars;
      for (const [fg, bg] of pairs)
        expect(contrast(v[fg], v[bg]), `${id} ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v["--btn"], v["--bg"]), `${id} btn/bg`).toBeGreaterThanOrEqual(3);
    }
  });

  test("picks readable button text for a custom accent", () => {
    expect(themeVars({ preset: "clubhouse", accent: "#b41c14" }).vars["--on-btn"]).toBe("#ffffff");
    expect(themeVars({ preset: "clubhouse", accent: "#f2d14b" }).vars["--on-btn"]).toBe("#111111");
    const y = themeVars({ preset: "clubhouse", accent: "#f2d14b" }).vars;
    expect(contrast(y["--on-btn"], y["--btn-hover"])).toBeGreaterThanOrEqual(contrast(y["--on-btn"], y["--btn"]));
  });

  test("a custom accent colours buttons, rules and small accent text", () => {
    const v = themeVars({ preset: "clubhouse", accent: "#b41c14" }).vars;
    expect(v["--btn"]).toBe("#b41c14");
    expect(v["--brass"]).toBe("#b41c14");
    expect(v["--accent"]).toBe("#b41c14");
    expect(contrast(v["--brass-ink"], v["--bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["--on-btn"], v["--btn-hover"])).toBeGreaterThanOrEqual(4.5);
  });

  test("every preset defines the same set of variables", () => {
    const keys = Object.keys(PRESETS.clubhouse.vars).sort();
    for (const id of Object.keys(PRESETS) as PresetId[])
      expect(Object.keys(PRESETS[id].vars).sort(), id).toEqual(keys);
  });

  test("nudges a mid-grey accent until text passes", () => {
    const r = themeVars({ preset: "clubhouse", accent: "#777777" });
    expect(r.adjusted).toBe(true);
    expect(r.accentUsed).not.toBe("#777777");
    expect(contrast(r.vars["--on-btn"], r.accentUsed)).toBeGreaterThanOrEqual(4.5);
    // #777777 fails with both #111 (4.2:1) and white (4.48:1)
    const e = themeVars({ preset: "evening", accent: "#777777" });
    expect(e.adjusted).toBe(true);
    expect(contrast(e.vars["--on-btn"], e.accentUsed)).toBeGreaterThanOrEqual(4.5);
  });

  test("resolveHero falls back when heroPhoto is gone", () => {
    expect(resolveHero({ preset: "clubhouse", heroPhoto: "/x.jpg" }, ["/a.jpg"])).toEqual({
      src: "/a.jpg",
      // today's page centres the hero at 50% 40%
      focus: { x: 50, y: 40 },
    });
    expect(
      resolveHero({ preset: "clubhouse", heroPhoto: "/b.jpg", heroFocus: { x: 20, y: 70 } }, [
        "/a.jpg",
        "/b.jpg",
      ]),
    ).toEqual({ src: "/b.jpg", focus: { x: 20, y: 70 } });
    expect(resolveHero(null, [])).toBeNull();
  });

  test("a dark look swaps a logo to its dark version", () => {
    expect(resolveLogo({ preset: "evening" })).toBe("/brand/pasatiempo-logo-1929-reverse.png");
    expect(resolveLogo({ preset: "evening", logo: { library: "logo-1929" } })).toBe(
      "/brand/pasatiempo-logo-1929-reverse.png",
    );
    expect(resolveLogo({ preset: "invitational", logo: { library: "logo-1929" } })).toBe(
      "/brand/pasatiempo-logo-1929.png",
    );
    expect(resolveLogo({ preset: "coastal", logo: { url: "https://x/logo-1.png" } })).toBe(
      "https://x/logo-1.png",
    );
    // the cream wordmark has no light version: a light look falls back to its default
    expect(resolveLogo({ preset: "coastal", logo: { library: "wordmark" } })).toBe("/logo-full.png");
  });

  test("eventContact defaults to Ian", () => {
    expect(eventContact({ contactName: null, contactEmail: null })).toEqual(DEFAULT_CONTACT);
    expect(eventContact({ contactName: "Pat", contactEmail: "pat@x.com" })).toEqual({
      name: "Pat",
      email: "pat@x.com",
    });
    expect(eventContact({ contactName: null, contactEmail: "pat@x.com" })).toEqual({
      name: "pat@x.com",
      email: "pat@x.com",
    });
  });
});

describe("unusedLogoPaths", () => {
  const files = ["a.jpg", "logo-1.png", "logo-2.svg"];
  test("keeps the logo the look uses", () => {
    expect(
      unusedLogoPaths(files, "https://x.supabase.co/storage/v1/object/public/event-photos/E/logo-2.svg"),
    ).toEqual(["logo-1.png"]);
  });
  test("with no uploaded logo in use, every logo file goes", () => {
    expect(unusedLogoPaths(files, null)).toEqual(["logo-1.png", "logo-2.svg"]);
  });
  test("never touches photos", () => {
    expect(unusedLogoPaths(["a.jpg", "b.png"], null)).toEqual([]);
  });
});
