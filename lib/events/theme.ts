// Per-event looks for the public sign-up page. A look is stored on the event
// as `theme` (jsonb, null = Clubhouse) and turned into CSS-variable overrides
// that sit on the page's `.pub` wrapper (and the editor's preview).
//
// The Clubhouse values are exactly the tokens in app/event-planner.css, so an
// event with no look renders as it always has.

import { contrast, parseHex, shiftLightness } from "./color";

export type PresetId = "clubhouse" | "invitational" | "coastal" | "evening";
export type LogoId = "club-full" | "logo-1929" | "mark" | "events-tile" | "wordmark";

export interface EventTheme {
  preset: PresetId;
  accent?: string; // "#rrggbb"; absent = the preset's own button colour
  heroPhoto?: string; // one of event.photos; absent or gone = photos[0]
  heroFocus?: { x: number; y: number }; // 0–100 %
  logo?: { library: LogoId } | { url: string }; // absent = the preset's default
}

export interface Preset {
  label: string;
  blurb: string;
  dark: boolean;
  defaultLogo: LogoId;
  vars: Record<string, string>;
}

// Today's hero scrim (event-planner.css, .pub-hero.has-img::after).
const CLUB_SCRIM =
  "linear-gradient(180deg, rgba(12, 26, 19, 0.3) 0%, rgba(12, 26, 19, 0.34) 40%, rgba(12, 26, 19, 0.9) 100%)";

const scrim = (rgb: string) =>
  `linear-gradient(180deg, rgba(${rgb}, 0.25) 0%, rgba(${rgb}, 0.35) 40%, rgba(${rgb}, 0.9) 100%)`;

export const PRESETS: Record<PresetId, Preset> = {
  clubhouse: {
    label: "Clubhouse",
    blurb: "Ivory, club green and brass — the planner's own look.",
    dark: false,
    defaultLogo: "club-full",
    vars: {
      "--ivory": "#f5f1e6",
      "--paper": "#fbf8f1",
      "--club": "#173a2a",
      "--club-2": "#21503a",
      "--brass": "#a2814a",
      "--brass-soft": "#d4c29a",
      "--brass-ink": "#7d6332",
      "--hairline": "#ddd4c0",
      "--rule-strong": "#c9bea6",
      "--slate": "#4f6470",
      "--green": "#173a2a",
      "--green-dark": "#10291e",
      "--green-light": "#cfdccf",
      "--green-tint": "#e9efe8",
      "--accent": "#a2814a",
      "--ink": "#1b201d",
      "--muted": "#5b635d",
      "--line": "#ddd4c0",
      "--bg": "#f5f1e6",
      "--card": "#fbf8f1",
      "--cream": "#f5f1e6",
      "--gold": "#a2814a",
      "--gold-soft": "#d4c29a",
      "--danger": "#9a2b20",
      "--warn": "#8a5a12",
      "--btn": "#173a2a",
      "--on-btn": "#f5f1e6",
      "--hero-btn": "#f5f1e6",
      "--on-hero-btn": "#173a2a",
      "--notice-warn-bg": "#faf3e2",
      "--notice-warn-line": "#e6d4ad",
      "--notice-warn-ink": "#5e3f0f",
      "--notice-err-bg": "#f8ece8",
      "--notice-err-line": "#e7c7bf",
      "--focus": "#a2814a",
      "--prose-ink": "#2b322d",
      "--hero-bg": "#173a2a",
      "--hero-ink": "#f5f1e6",
      "--hero-kicker": "#d4c29a",
      "--btn-hover": "#21503a",
      "--hero-btn-hover": "#ffffff",
      "--scrim": CLUB_SCRIM,
    },
  },
  invitational: {
    label: "Invitational",
    blurb: "Palm green, sombrero red and sand, from the club's 1929 logo.",
    dark: false,
    defaultLogo: "logo-1929",
    vars: {
      "--ivory": "#f5f0e2",
      "--paper": "#fbf8ef",
      "--club": "#546434",
      "--club-2": "#45532a",
      "--brass": "#c49c6c",
      "--brass-soft": "#e2cfb2",
      "--brass-ink": "#7a5a2e",
      "--hairline": "#e0d6bf",
      "--rule-strong": "#cbbd9c",
      "--slate": "#4f5a44",
      "--green": "#546434",
      "--green-dark": "#3d4a25",
      "--green-light": "#d7dcc6",
      "--green-tint": "#ecefe2",
      "--accent": "#c49c6c",
      "--ink": "#1f2419",
      "--muted": "#575c4c",
      "--line": "#e0d6bf",
      "--bg": "#f5f0e2",
      "--card": "#fbf8ef",
      "--cream": "#f5f0e2",
      "--gold": "#c49c6c",
      "--gold-soft": "#e2cfb2",
      "--danger": "#9a2b20",
      "--warn": "#8a5a12",
      "--btn": "#b41c14",
      "--on-btn": "#ffffff",
      "--hero-btn": "#f5f0e2",
      "--on-hero-btn": "#b41c14",
      "--notice-warn-bg": "#faf1df",
      "--notice-warn-line": "#e6d4ad",
      "--notice-warn-ink": "#5e3f0f",
      "--notice-err-bg": "#f8ebe6",
      "--notice-err-line": "#e7c7bf",
      "--focus": "#b41c14",
      "--prose-ink": "#2d3226",
      "--hero-bg": "#3d4a25",
      "--hero-ink": "#f5f0e2",
      "--hero-kicker": "#e2cfb2",
      "--btn-hover": "#9a1811",
      "--hero-btn-hover": "#ffffff",
      "--scrim": scrim("31, 36, 25"),
    },
  },
  coastal: {
    label: "Coastal",
    blurb: "Monterey Bay blues with a sand rule — clinics and casual days.",
    dark: false,
    defaultLogo: "club-full",
    vars: {
      "--ivory": "#f9fbfb",
      "--paper": "#f9fbfb",
      "--club": "#1f3b57",
      "--club-2": "#2b4f73",
      "--brass": "#c9b48a",
      "--brass-soft": "#e3d7bd",
      "--brass-ink": "#36637f",
      "--hairline": "#d5dfe2",
      "--rule-strong": "#b9c8cd",
      "--slate": "#4f6470",
      "--green": "#1f3b57",
      "--green-dark": "#162b40",
      "--green-light": "#cfdde6",
      "--green-tint": "#e6eef2",
      "--accent": "#c9b48a",
      "--ink": "#14232e",
      "--muted": "#4f5f69",
      "--line": "#d5dfe2",
      "--bg": "#eef2f2",
      "--card": "#f9fbfb",
      "--cream": "#eef2f2",
      "--gold": "#c9b48a",
      "--gold-soft": "#e3d7bd",
      "--danger": "#9a2b20",
      "--warn": "#7f520f",
      "--btn": "#2f6584",
      "--on-btn": "#ffffff",
      "--hero-btn": "#f9fbfb",
      "--on-hero-btn": "#1f3b57",
      "--notice-warn-bg": "#f8f2e4",
      "--notice-warn-line": "#e3d4b2",
      "--notice-warn-ink": "#5e3f0f",
      "--notice-err-bg": "#f8ece8",
      "--notice-err-line": "#e7c7bf",
      "--focus": "#2f6584",
      "--prose-ink": "#22323d",
      "--hero-bg": "#1f3b57",
      "--hero-ink": "#f9fbfb",
      "--hero-kicker": "#e3d7bd",
      "--btn-hover": "#27566f",
      "--hero-btn-hover": "#ffffff",
      "--scrim": scrim("16, 32, 46"),
    },
  },
  evening: {
    label: "Evening",
    blurb: "Charcoal and brass — dinners and member nights.",
    dark: true,
    defaultLogo: "logo-1929",
    vars: {
      // on a dark look "ivory" is the colour that sits on top of the primary
      "--ivory": "#14191a",
      "--paper": "#1d2426",
      "--club": "#d4c29a",
      "--club-2": "#e2d4b3",
      "--brass": "#c9a86a",
      "--brass-soft": "#6b5a3a",
      "--brass-ink": "#d4b77e",
      "--hairline": "#34403f",
      "--rule-strong": "#4a5654",
      "--slate": "#9fb0b8",
      "--green": "#d4c29a",
      "--green-dark": "#e2d4b3",
      "--green-light": "#3a4644",
      "--green-tint": "#232c2e",
      "--accent": "#c9a86a",
      "--ink": "#ece6d6",
      "--muted": "#b3ad9f",
      "--line": "#34403f",
      "--bg": "#14191a",
      "--card": "#1d2426",
      "--cream": "#14191a",
      "--gold": "#c9a86a",
      "--gold-soft": "#6b5a3a",
      "--danger": "#f08a7e",
      "--warn": "#e0b25c",
      "--btn": "#c9a86a",
      "--on-btn": "#14191a",
      "--hero-btn": "#c9a86a",
      "--on-hero-btn": "#14191a",
      "--notice-warn-bg": "#2c2617",
      "--notice-warn-line": "#5a4a2a",
      "--notice-warn-ink": "#ecd9a8",
      "--notice-err-bg": "#2e1c1a",
      "--notice-err-line": "#6a3a33",
      "--focus": "#e2c98f",
      "--prose-ink": "#e4ddcc",
      "--hero-bg": "#1d2426",
      "--hero-ink": "#ece6d6",
      "--hero-kicker": "#d4c29a",
      "--btn-hover": "#d9bd85",
      "--hero-btn-hover": "#d9bd85",
      "--scrim": scrim("20, 25, 26"),
    },
  },
};

export const LOGOS: Record<LogoId, { label: string; light: string; dark: string }> = {
  "club-full": { label: "Club logo", light: "/logo-full.png", dark: "/logo-full.png" },
  "logo-1929": {
    label: "1929 logo",
    light: "/brand/pasatiempo-logo-1929.png",
    dark: "/brand/pasatiempo-logo-1929-reverse.png",
  },
  mark: { label: "Small mark", light: "/logo-mark.png", dark: "/logo-mark.png" },
  "events-tile": { label: "Events tile", light: "/logo-events.png", dark: "/logo-events.png" },
  // cream brush script: only readable on a dark look
  wordmark: { label: "Pasatiempo script", light: "", dark: "/invitational/img/wordmark-pasatiempo.svg" },
};

const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
const LOGO_IDS = Object.keys(LOGOS) as LogoId[];
const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Read a stored theme defensively; anything unusable is dropped. */
export function parseTheme(raw: unknown): EventTheme | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const preset = PRESET_IDS.includes(r.preset as PresetId)
    ? (r.preset as PresetId)
    : "clubhouse";
  const t: EventTheme = { preset };
  if (typeof r.accent === "string") {
    const hex = parseHex(r.accent);
    if (hex) t.accent = hex;
  }
  if (typeof r.heroPhoto === "string" && r.heroPhoto) t.heroPhoto = r.heroPhoto;
  const f = r.heroFocus as Record<string, unknown> | undefined;
  if (f && typeof f.x === "number" && typeof f.y === "number" && isFinite(f.x) && isFinite(f.y))
    t.heroFocus = { x: clamp(f.x), y: clamp(f.y) };
  const l = r.logo as Record<string, unknown> | undefined;
  if (l && typeof l === "object") {
    if (LOGO_IDS.includes(l.library as LogoId)) t.logo = { library: l.library as LogoId };
    else if (typeof l.url === "string" && /^(https:\/\/|\/)/.test(l.url)) t.logo = { url: l.url };
  }
  return t;
}

const DARK_TEXT = "#111111";
const LIGHT_TEXT = "#ffffff";

/** The readable text colour on `bg`, or null if neither reaches 4.5:1. */
function textOn(bg: string): string | null {
  const d = contrast(DARK_TEXT, bg);
  const l = contrast(LIGHT_TEXT, bg);
  const best = d >= l ? DARK_TEXT : LIGHT_TEXT;
  return Math.max(d, l) >= 4.5 ? best : null;
}

/** Shift `hex` toward the page's ink until it reaches 4.5:1 on `bg`. */
function inkFor(hex: string, bg: string, dark: boolean): string {
  let c = hex;
  for (let i = 0; i < 50 && contrast(c, bg) < 4.5; i++)
    c = shiftLightness(c, dark ? 2 : -2);
  return c;
}

/** A hover a few points away from the button's text colour, still readable. */
function hoverFor(accent: string, on: string): string {
  const lighten = on === DARK_TEXT || contrast(on, "#000000") < contrast(on, "#ffffff");
  for (const step of [6, 4, 2]) {
    const c = shiftLightness(accent, lighten ? step : -step);
    if (contrast(on, c) >= 4.5) return c;
  }
  return accent;
}

/** The CSS variables for a look, with any custom accent applied safely. */
export function themeVars(theme: EventTheme | null): {
  vars: Record<string, string>;
  accentUsed: string;
  adjusted: boolean;
} {
  const preset = PRESETS[theme?.preset ?? "clubhouse"];
  const vars = { ...preset.vars };
  const input = theme?.accent ? parseHex(theme.accent) : null;
  if (!input) return { vars, accentUsed: vars["--btn"], adjusted: false };

  // The button must read (text 4.5:1) and show (fill 3:1 against the page and
  // the form card); nudge the colour away from the page until both hold.
  const shows = (c: string) =>
    contrast(c, vars["--bg"]) >= 3 && contrast(c, vars["--card"]) >= 3;
  let accent = input;
  let on = textOn(accent);
  for (let i = 0; i < 50 && !(on && shows(accent)); i++) {
    accent = shiftLightness(accent, preset.dark ? 2 : -2);
    on = textOn(accent);
  }
  const onBtn = on ?? (preset.dark ? DARK_TEXT : LIGHT_TEXT);
  Object.assign(vars, {
    "--btn": accent,
    "--on-btn": onBtn,
    "--btn-hover": hoverFor(accent, onBtn),
    "--accent": accent,
    "--brass": accent,
    "--gold": accent,
    "--focus": accent,
    "--brass-ink": inkFor(accent, vars["--bg"], preset.dark),
  });
  return { vars, accentUsed: accent, adjusted: accent !== input };
}

// Where the hero has always been centred (event-planner.css: 50% 40%).
export const DEFAULT_FOCUS = { x: 50, y: 40 };

/** The hero photo to show and where to centre it. */
export function resolveHero(
  theme: EventTheme | null,
  photos: string[],
): { src: string; focus: { x: number; y: number } } | null {
  if (photos.length === 0) return null;
  const chosen = theme?.heroPhoto && photos.includes(theme.heroPhoto);
  return {
    src: chosen ? theme!.heroPhoto! : photos[0],
    focus: chosen && theme?.heroFocus ? theme.heroFocus : DEFAULT_FOCUS,
  };
}

/** The header logo's URL for a look. */
export function resolveLogo(theme: EventTheme | null): string {
  const preset = PRESETS[theme?.preset ?? "clubhouse"];
  if (theme?.logo && "url" in theme.logo) return theme.logo.url;
  const pick = (id: LogoId) => (preset.dark ? LOGOS[id].dark : LOGOS[id].light);
  if (theme?.logo && "library" in theme.logo) {
    const src = pick(theme.logo.library);
    if (src) return src;
  }
  return pick(preset.defaultLogo);
}

/** Logos that make sense on a look (the cream script only on dark ones). */
export function logosFor(preset: PresetId): LogoId[] {
  const dark = PRESETS[preset].dark;
  return LOGO_IDS.filter((id) => (dark ? LOGOS[id].dark : LOGOS[id].light));
}

export const DEFAULT_CONTACT = { name: "Ian Johnson", email: "Ijohnson@pasatiempo.com" };

/** Who members should contact about an event. */
export function eventContact(e: {
  contactName: string | null;
  contactEmail: string | null;
}): { name: string; email: string } {
  const email = e.contactEmail?.trim();
  if (!email) return DEFAULT_CONTACT;
  return { name: e.contactName?.trim() || email, email };
}

/** Logo files in an event's storage folder that the look no longer uses. */
export function unusedLogoPaths(files: string[], keepUrl: string | null): string[] {
  const keep = keepUrl ? keepUrl.split("/").pop() : null;
  return files.filter((f) => /^logo-/.test(f) && f !== keep);
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Whether an uploaded logo is acceptable. SVG is refused: opened straight
 *  from the public bucket it could run script. */
export function logoUploadCheck(
  type: string,
  size: number,
): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = LOGO_TYPES[type];
  if (!ext || size <= 0 || size > LOGO_MAX_BYTES)
    return { ok: false, error: "Logos must be PNG or JPG under 2 MB." };
  return { ok: true, ext };
}
