"use client";

import { useEffect, useRef } from "react";
import { BODY } from "./content";

// El Sombrero — a real app page. The (trusted, static) page markup lives in
// content.ts and renders here; the tab behavior that was a plain <script> is
// reimplemented in React below, scoped to this component.
const TABS = [
  "home",
  "schedule",
  "flights",
  "format",
  "altshot",
  "horserace",
  "wagering",
  "prizes",
];
const NAMES: Record<string, string> = {
  home: "El Sombrero 2026",
  schedule: "Schedule",
  flights: "Flights",
  format: "Format",
  altshot: "Alternate Shot",
  horserace: "The Horserace",
  wagering: "Wagering",
  prizes: "Prizes & Payouts",
};

export default function ElSombrero() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const views: Record<string, HTMLElement | null> = {};
    TABS.forEach((t) => (views[t] = root.querySelector<HTMLElement>("#" + t)));
    const buttons = Array.from(
      root.querySelectorAll<HTMLElement>("nav.tabs button[role=tab]"),
    );

    const show = (tabRaw: string, push = true) => {
      const tab = TABS.includes(tabRaw) ? tabRaw : "home";
      TABS.forEach((t) => views[t]?.classList.toggle("active", t === tab));
      buttons.forEach((b) =>
        b.setAttribute("aria-current", b.dataset.tab === tab ? "true" : "false"),
      );
      if (push && location.hash !== "#" + tab) {
        history.pushState({ tab }, "", "#" + tab);
      }
      window.scrollTo({ top: 0, behavior: "auto" });
      document.title =
        (tab === "home" ? NAMES.home : NAMES[tab] + " — El Sombrero") +
        " · Pasatiempo";
    };

    const clickables = Array.from(
      root.querySelectorAll<HTMLElement>("[data-tab]"),
    );
    const cleanup: Array<() => void> = [];
    clickables.forEach((el) => {
      const handler = (e: Event) => {
        e.preventDefault();
        show(el.dataset.tab || "home");
      };
      el.addEventListener("click", handler);
      cleanup.push(() => el.removeEventListener("click", handler));
    });

    const onPop = () => show((location.hash || "#home").slice(1), false);
    window.addEventListener("popstate", onPop);
    show((location.hash || "#home").slice(1), false);

    return () => {
      cleanup.forEach((fn) => fn());
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return <div ref={rootRef} dangerouslySetInnerHTML={{ __html: BODY }} />;
}
