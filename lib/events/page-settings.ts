// The sign-up page's wording and layout for one event: its own settings
// (stored on the look) with the page's usual words filling the gaps.
import { TYPE_LABEL } from "./format";
import type { EventTheme, HeroStyle } from "./theme";
import type { EventType } from "./types";

export const DEFAULT_HEADINGS = {
  about: "About this event",
  info: "What you need to know",
  register: "Register",
};
export const DEFAULT_BUTTON_LABEL = "Register now";

export interface PageSettings {
  kicker: string;
  buttonLabel: string;
  heroStyle: HeroStyle;
  showSpots: boolean;
  headings: typeof DEFAULT_HEADINGS;
  thankYou: string | null;
}

export function pageSettings(event: { type: EventType; theme: EventTheme | null }): PageSettings {
  const t = event.theme;
  return {
    kicker: t?.kicker ?? TYPE_LABEL[event.type],
    buttonLabel: t?.buttonLabel ?? DEFAULT_BUTTON_LABEL,
    heroStyle: t?.heroStyle ?? "photo",
    showSpots: !t?.hideSpots,
    headings: { ...DEFAULT_HEADINGS, ...t?.headings },
    thankYou: t?.thankYou ?? null,
  };
}
