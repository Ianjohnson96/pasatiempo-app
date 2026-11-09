"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EVENT } from "./content";

// The opening title sequence for the Invitational page — a studio-style
// flip-book, about six and a half seconds:
//
//   1929 — the club's archive flips past like pages turning, black-and-white
//   on film: the opening-day crowd, the foursome on the first tee, the
//   Doctor and Marion Hollins, the galleries round MacKenzie's greens. Slow
//   enough at first to catch the faces, then faster and faster.
//   2027 — a flash, and the pages turn to colour: the clock, the bridge,
//   the greens, the bay, racing.
//   PASATIEMPO — the photos keep flipping, through the letters and behind
//   them, until the letters settle solid with the crest above, and it all
//   lifts away into the page.
//
// No captions; the years are the only words until the title.
//
// Plays once per browser session, on the home tab, never for visitors who ask
// for reduced motion. Skippable at any point (button, Esc, Enter, Space, or a
// click). The page's own hero animation waits underneath and starts as the
// reel lifts. A replay button lives in the footer.
//
// Photographs: the 1929 course and opening-day photographs (archive-1929-*)
// and the present-day clock, bridge, dawn aerial, flag and chairs (today-*)
// are the club's own, as are the two drone films the hole-* stills come from.
// "House of Dr. Alister MacKenzie, Pasatiempo Estates"
// (archive-mackenzie-house-1933*) is by Sturtevant for The Architect and
// Engineer, April 1933 (San Francisco Public Library scan via the Internet
// Archive; Wikimedia Commons files 14598027017 and 14784188652, "No known
// copyright restrictions"). MacKenzie's portrait is from the Library of
// Congress; Hollins's from the MHI site.

const IMG = "/invitational/img/";
const LOGO = "/logo-full.png";
const A = (f: string) => IMG + "archive-" + f;
const T = (f: string) => IMG + "today-" + f;

type Era = "archive" | "today";
interface Frame {
  src: string;
  /** How long the page holds, in ms. */
  hold: number;
  era: Era;
  /** object-position for the crop — on the faces for the portraits. */
  focus?: string;
}

const FRAMES: Frame[] = [
  // ---- 1929: the archive, slowing on the faces, then speeding up ---------
  { src: A("1929-tee-shot-bay.jpg"), hold: 320, era: "archive", focus: "center 70%" },
  { src: IMG + "mackenzie.jpg", hold: 290, era: "archive", focus: "53% 16%" },
  { src: A("1929-opening-foursome.jpg"), hold: 260, era: "archive", focus: "center 10%" },
  { src: IMG + "hollins.avif", hold: 240, era: "archive", focus: "50% 30%" },
  { src: A("1929-gallery-oak.jpg"), hold: 220, era: "archive", focus: "center 60%" },
  { src: A("mackenzie-house-1933.jpg"), hold: 200, era: "archive", focus: "center 70%" },
  { src: IMG + "hollins-swing.avif", hold: 180, era: "archive", focus: "60% 15%" },
  { src: A("1929-golfer-oak.jpg"), hold: 165, era: "archive", focus: "center 70%" },
  { src: A("1929-bunkered-green.jpg"), hold: 150, era: "archive", focus: "center 60%" },
  { src: A("mackenzie-house-1933b.jpg"), hold: 140, era: "archive", focus: "center 40%" },
  { src: A("1929-opening-foursome.jpg"), hold: 130, era: "archive", focus: "72% 10%" },
  { src: IMG + "mackenzie.jpg", hold: 120, era: "archive", focus: "53% 14%" },
  // ---- 2027: a flash, and the pages race on in colour --------------------
  { src: T("clock-1929.jpg"), hold: 110, era: "today", focus: "18% center" },
  { src: IMG + "course-green.jpg", hold: 100, era: "today" },
  { src: T("bridge.jpg"), hold: 95, era: "today", focus: "center 60%" },
  { src: T("aerial-dawn.jpg"), hold: 90, era: "today" },
  { src: T("flag-green.jpg"), hold: 85, era: "today", focus: "70% 60%" },
  { src: T("chairs-bay.jpg"), hold: 80, era: "today", focus: "center 45%" },
  { src: IMG + "course-wide.jpg", hold: 75, era: "today" },
  { src: IMG + "clubhouse.avif", hold: 70, era: "today" },
  { src: IMG + "hole-4-approach-poster.jpg", hold: 65, era: "today" },
  { src: IMG + "aerial.avif", hold: 65, era: "today" },
  { src: IMG + "bunkers-green.avif", hold: 60, era: "today" },
  { src: IMG + "hole-11-approach-poster.jpg", hold: 60, era: "today" },
  { src: IMG + "clubhouse-green.jpg", hold: 60, era: "today" },
  { src: IMG + "course-bunkers.jpg", hold: 60, era: "today" },
  { src: IMG + "schedule.avif", hold: 60, era: "today" },
  { src: IMG + "hero.avif", hold: 60, era: "today" },
];

/** Photos that run through the letters of PASATIEMPO — then and now. */
const FILL = [
  A("1929-tee-shot-bay.jpg"),
  T("aerial-dawn.jpg"),
  A("1929-opening-foursome.jpg"),
  IMG + "course-green.jpg",
  A("1929-bunkered-green.jpg"),
  T("bridge.jpg"),
  A("1929-gallery-oak.jpg"),
  IMG + "hole-4-approach-poster.jpg",
  IMG + "mackenzie.jpg",
  T("flag-green.jpg"),
];
/** ...and the pages that keep turning behind the title until it settles. */
const BEHIND = FRAMES.map((f) => f.src);
const SETTLE_ON = T("chairs-bay.jpg");

const LEAD_MS = 250; // a beat of black before the first page
const TITLE_MS = 2000; // PASATIEMPO on screen
const SOLID_AT = 1000; // ...letters stop flickering and settle
const EXIT_MS = 600; // the reel lifts away
const FOUNDED = 1929;

const FIRST_TODAY = FRAMES.findIndex((f) => f.era === "today");

const SEEN_KEY = "mci-intro-seen";
const SKIP_STYLE = "mci-intro-skip";

declare global {
  interface Window {
    /** Set by INTRO_GATE before paint; "play" when replayed from the footer. */
    __mciIntro?: "skip" | "play" | "done";
  }
}

/**
 * Runs before the page paints (inline in the server HTML), so a returning
 * visitor, a deep link or reduced motion never sees the reel flash up. It
 * hides the reel with an injected style rather than touching <html>, which
 * React owns and would report as a hydration mismatch.
 */
export const INTRO_GATE = `(function(){var skip=true;try{var h=location.hash.slice(1);skip=(h&&h!=="home")||!!sessionStorage.getItem("${SEEN_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){}if(skip){window.__mciIntro="skip";var s=document.createElement("style");s.id="${SKIP_STYLE}";s.textContent=".mci-intro{display:none!important}";document.head.appendChild(s);}})();`;

/** Replay from the footer: lift the before-paint skip. */
export function allowReplay() {
  window.__mciIntro = "play";
  document.getElementById(SKIP_STYLE)?.remove();
}

/** Should the reel be skipped on this load? (Client-side twin of INTRO_GATE.) */
export function introSkipped(): boolean {
  if (window.__mciIntro === "play") return false;
  if (window.__mciIntro === "skip") return true;
  try {
    const h = location.hash.slice(1);
    return (
      (!!h && h !== "home") ||
      !!sessionStorage.getItem(SEEN_KEY) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode: it just plays again next time */
  }
  window.__mciIntro = "done";
}

function preload(srcs: string[], maxMs: number) {
  const imgs = srcs.map(
    (src) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = src;
      }),
  );
  return Promise.race([Promise.all(imgs), new Promise((r) => setTimeout(r, maxMs))]);
}

type Phase = "load" | "lead" | "reel" | "title" | "exit";

export default function IntroReel({
  onReveal,
  onDone,
}: {
  /** The reel has started lifting: start the page's own entrance. */
  onReveal: () => void;
  /** The reel is gone. */
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("load");
  const [i, setI] = useState(0);
  const [fill, setFill] = useState(0);
  const [solid, setSolid] = useState(false);
  const done = useRef({ onReveal, onDone });
  useEffect(() => {
    done.current = { onReveal, onDone };
  });

  // Decide, preload, and hold the page still while the reel runs.
  useEffect(() => {
    if (introSkipped()) {
      done.current.onReveal();
      done.current.onDone();
      return;
    }
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    let alive = true;
    preload([LOGO, ...new Set([...BEHIND, ...FILL])], 3000).then(() => {
      if (alive) setPhase("lead");
    });
    return () => {
      alive = false;
      html.style.overflow = prev;
    };
  }, []);

  // The clock: a beat of black, each page's hold, the title, the exit.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (phase === "lead") {
      t = setTimeout(() => setPhase("reel"), LEAD_MS);
    } else if (phase === "reel") {
      t = setTimeout(() => {
        if (i < FRAMES.length - 1) setI(i + 1);
        else setPhase("title");
      }, FRAMES[i].hold);
    } else if (phase === "title") {
      t = setTimeout(() => setPhase("exit"), TITLE_MS);
    } else if (phase === "exit") {
      markSeen();
      done.current.onReveal();
      t = setTimeout(() => done.current.onDone(), EXIT_MS);
    }
    return () => clearTimeout(t);
  }, [phase, i]);

  // Under the title, the pages keep turning — through the letters and behind
  // them — then stop and the letters settle solid.
  useEffect(() => {
    if (phase !== "title") return;
    const flick = setInterval(() => setFill((n) => n + 1), 75);
    const settle = setTimeout(() => {
      clearInterval(flick);
      setSolid(true);
    }, SOLID_AT);
    return () => {
      clearInterval(flick);
      clearTimeout(settle);
    };
  }, [phase]);

  // Skip from the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setPhase("exit");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const skip = () => setPhase("exit");
  const inReel = phase === "reel";
  const inTitle = phase === "title" || phase === "exit";
  const frame = FRAMES[i];
  const prevFrame = i > 0 ? FRAMES[i - 1] : null;
  const era: Era | "none" = inReel ? frame.era : "none";
  // Behind the title: the pages keep turning, then rest on the bay.
  const behind: Frame = solid
    ? { src: SETTLE_ON, hold: 900, era: "today", focus: "center 45%" }
    : { src: BEHIND[(FIRST_TODAY + fill) % BEHIND.length], hold: 75, era: "today" };
  const behindPrev: Frame | null =
    !solid && fill > 0
      ? { src: BEHIND[(FIRST_TODAY + fill - 1) % BEHIND.length], hold: 75, era: "today" }
      : null;

  const total = FRAMES.reduce((s, f) => s + f.hold, 0);
  const progress =
    phase === "load" || phase === "lead"
      ? 0
      : inReel
        ? (FRAMES.slice(0, i).reduce((s, f) => s + f.hold, 0) / total) * 0.75
        : 1;

  return (
    <div
      className={"mci-intro is-" + phase + " era-" + era + (solid ? " is-solid" : "")}
      onClick={skip}
      role="presentation"
    >
      {phase === "load" && (
        <div className="mci-intro-loading" aria-hidden>
          <span className="mci-intro-dot" />
        </div>
      )}

      {/* The flip-book. The page underneath keeps its key, so React keeps the
          element and nothing restarts under the turn. */}
      {inReel && (
        <div className="mci-reel" aria-hidden>
          {prevFrame && <Page key={"p" + (i - 1)} f={prevFrame} under />}
          <Page key={"p" + i} f={frame} />
          {i === FIRST_TODAY && <div className="mci-reel-burst" />}
        </div>
      )}
      {inTitle && (
        <div className="mci-reel is-behind" aria-hidden>
          {behindPrev && <Page key={"b" + (fill - 1)} f={behindPrev} under />}
          <Page key={solid ? "b-settle" : "b" + fill} f={behind} />
        </div>
      )}

      {/* The years: 1929 over the archive, a hard cut to 2027 with the colour. */}
      {inReel && (
        <div
          className={"mci-reel-year" + (frame.era === "today" ? " is-now" : "")}
          key={frame.era}
          aria-hidden
        >
          {frame.era === "today" ? EVENT.year : FOUNDED}
        </div>
      )}

      {inTitle && (
        <div className="mci-reel-title">
          <div className="mci-reel-title-crest">
            <Medal size={110} />
          </div>
          <div className="mci-reel-word-wrap">
            <div
              className="mci-reel-word is-photo"
              aria-hidden
              style={{ backgroundImage: `url(${FILL[fill % FILL.length]})` }}
            >
              Pasatiempo
            </div>
            <div className="mci-reel-word is-solid" aria-hidden>
              Pasatiempo
            </div>
            {/* A light sweeping across the letters as they settle. */}
            <div className="mci-reel-word mci-reel-sweep" aria-hidden>
              Pasatiempo
            </div>
          </div>
          <div className="mci-reel-rule" aria-hidden />
          <div className="mci-reel-sub">{`The ${EVENT.name} · ${EVENT.year}`}</div>
        </div>
      )}

      <div className="mci-reel-grain" aria-hidden />
      <div className="mci-reel-vignette" aria-hidden />
      <div className="mci-reel-bar" aria-hidden>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      <button
        type="button"
        className="mci-reel-skip"
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
      >
        Skip intro
      </button>
    </div>
  );
}

/** The club's logo on a cream medallion, a gold ring drawing round it. */
function Medal({ size }: { size: number }) {
  return (
    <div className="mci-medal" style={{ "--crest": size + "px" } as CSSProperties}>
      <svg className="mci-medal-ring" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="48" />
        <circle cx="50" cy="50" r="44.5" className="is-inner" />
      </svg>
      <div className="mci-medal-disc">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="Pasatiempo Golf Club" />
      </div>
    </div>
  );
}

/** One full-bleed page of the flip-book: it swings in on its left edge. */
function Page({ f, under }: { f: Frame; under?: boolean }) {
  return (
    <div
      className={"mci-page era-" + f.era + (under ? " is-under" : "")}
      style={{ "--hold": f.hold + "ms", "--focus": f.focus ?? "center" } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={f.src} alt="" />
    </div>
  );
}
