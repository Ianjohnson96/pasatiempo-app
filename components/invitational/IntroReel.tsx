"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EVENT } from "./content";

// The opening title sequence for the Invitational page, in three acts:
//
//   1. THE CREST — the club's palm-and-figure logo on a cream medallion, a
//      gold ring drawing round it.
//   2. 1929, ON FILM — letterboxed black-and-white with grain, flicker and
//      gate weave: the opening-day crowd looking out to the bay, the
//      foursome on the first tee, the galleries round MacKenzie's greens,
//      the Doctor and Marion Hollins themselves. Slow at first, each photo
//      with its own camera move, then cutting faster and faster.
//   3. TODAY — the 1929 bunkered green dissolves into the same kind of green
//      today, in colour; the letterbox opens, the cuts race, and the year
//      runs from 1929 to the Invitational's own before landing on
//      PASATIEMPO, the crest above it, and lifting away into the page.
//
// No captions: the faces, the course and the years carry it.
//
// Plays once per browser session, on the home tab, never for visitors who ask
// for reduced motion. Skippable at any point (button, Esc, Enter, Space, or a
// click). The page's own hero animation waits underneath and starts as the
// reel lifts. A replay button lives in the footer.
//
// Photographs: the 1929 course and opening-day photographs are the club's
// own archive (archive-1929-*). "House of Dr. Alister MacKenzie, Pasatiempo
// Estates" (archive-mackenzie-house-1933*) is by Sturtevant for The Architect
// and Engineer, April 1933 (San Francisco Public Library scan via the
// Internet Archive; Wikimedia Commons files 14598027017 and 14784188652, "No
// known copyright restrictions"). MacKenzie's portrait is from the Library of
// Congress; Hollins's from the MHI site.

const IMG = "/invitational/img/";
const LOGO = "/logo-full.png";

type Era = "archive" | "today";

/** A camera move over a full-bleed photo: scale and offset (in %), from → to. */
interface Move {
  from: [scale: number, x: number, y: number];
  to: [scale: number, x: number, y: number];
  /** transform-origin, e.g. "40% 20%" to push in on a face. */
  origin?: string;
}
const DRIFT: Move = { from: [1.14, 1.5, 0], to: [1.02, -1, 0] };

interface Frame {
  src: string;
  /** How long the frame holds, in ms. */
  hold: number;
  era: Era;
  /** object-position for the crop. */
  focus?: string;
  move?: Move;
  /** Portrait card with a push-in toward the face (transform-origin). */
  face?: string;
  /** How far the portrait push-in goes (default 1.45). */
  zoom?: number;
  /** Dissolve in over the previous frame instead of cutting (then → now). */
  match?: boolean;
}

const A = (f: string) => IMG + "archive-" + f;

const FRAMES: Frame[] = [
  // ---- Act two: 1929, on film. Slow, each photo with its own move. --------
  // Opening day: the crowd round the tee, the bay beyond. A slow rise.
  {
    src: A("1929-tee-shot-bay.jpg"), hold: 1500, era: "archive", focus: "center 70%",
    move: { from: [1.18, 0, 4], to: [1.04, 0, -2] },
  },
  // The foursome on the first tee: push in across the four of them.
  {
    src: A("1929-opening-foursome.jpg"), hold: 1700, era: "archive", focus: "center 8%",
    move: { from: [1.02, 0, 0], to: [1.2, 0, 0], origin: "45% 14%" },
  },
  { src: IMG + "mackenzie.jpg", hold: 1150, era: "archive", face: "53% 17%", zoom: 2.1 },
  // The gallery round the green, under the oak: a slow pan left.
  {
    src: A("1929-gallery-oak.jpg"), hold: 1050, era: "archive", focus: "center 60%",
    move: { from: [1.16, 3, 0], to: [1.16, -3, 0] },
  },
  { src: IMG + "hollins.avif", hold: 1150, era: "archive", face: "50% 34%" },
  // A lone golfer under the oak: push in on him.
  {
    src: A("1929-golfer-oak.jpg"), hold: 850, era: "archive", focus: "center 70%",
    move: { from: [1.04, 0, 0], to: [1.22, 0, 0], origin: "42% 75%" },
  },
  // ...then the archive starts to race.
  { src: A("mackenzie-house-1933.jpg"), hold: 380, era: "archive", focus: "center 70%" },
  { src: IMG + "hollins-swing.avif", hold: 320, era: "archive", focus: "60% 18%" },
  {
    src: A("1929-opening-foursome.jpg"), hold: 260, era: "archive", focus: "70% 10%",
    move: { from: [1.4, 0, 0], to: [1.5, 0, 0], origin: "68% 16%" },
  },
  {
    src: A("1929-tee-shot-bay.jpg"), hold: 220, era: "archive", focus: "center 85%",
    move: { from: [1.4, 0, 0], to: [1.5, 0, 0], origin: "50% 80%" },
  },
  { src: A("mackenzie-house-1933b.jpg"), hold: 190, era: "archive", focus: "center 40%" },
  {
    src: A("1929-gallery-oak.jpg"), hold: 170, era: "archive", focus: "center 65%",
    move: { from: [1.45, 0, 0], to: [1.55, 0, 0], origin: "35% 62%" },
  },
  // The 1929 bunkered green holds a beat...
  {
    src: A("1929-bunkered-green.jpg"), hold: 1100, era: "archive", focus: "center 60%",
    move: { from: [1.06, 0, 0], to: [1.16, 0, 0], origin: "55% 60%" },
  },
  // ---- Act three: ...and dissolves into a bunkered green today. ----------
  {
    src: IMG + "course-green.jpg", hold: 750, era: "today", match: true, focus: "center 60%",
    move: { from: [1.16, 0, 0], to: [1.08, 0, 0], origin: "55% 60%" },
  },
  { src: IMG + "aerial.avif", hold: 330, era: "today" },
  { src: IMG + "course-wide.jpg", hold: 270, era: "today" },
  { src: IMG + "sixteenth.jpg", hold: 220, era: "today" },
  { src: IMG + "clubhouse.avif", hold: 185, era: "today" },
  { src: IMG + "formats.avif", hold: 160, era: "today" },
  { src: IMG + "bunkers-green.avif", hold: 140, era: "today" },
  { src: IMG + "course-bunkers.jpg", hold: 120, era: "today" },
  { src: IMG + "schedule.avif", hold: 105, era: "today" },
  { src: IMG + "clubhouse-green.jpg", hold: 95, era: "today" },
  { src: IMG + "hero.avif", hold: 90, era: "today" },
  { src: IMG + "aerial.avif", hold: 90, era: "today" },
];

/** Photos that run through the letters of PASATIEMPO — then and now. */
const FILL = [
  A("1929-tee-shot-bay.jpg"),
  IMG + "course-wide.jpg",
  A("1929-opening-foursome.jpg"),
  IMG + "course-green.jpg",
  A("1929-bunkered-green.jpg"),
  IMG + "sixteenth.jpg",
  A("1929-gallery-oak.jpg"),
  IMG + "hero.avif",
];

const CREST_MS = 1400; // act one
const TITLE_MS = 2500; // PASATIEMPO on screen
const SOLID_AT = 1150; // ...letters stop flickering and settle
const EXIT_MS = 1100; // the reel lifts away
const FOUNDED = 1929;

const FIRST_TODAY = FRAMES.findIndex((f) => f.era === "today");
const TODAY_MS = FRAMES.slice(FIRST_TODAY).reduce((s, f) => s + f.hold, 0);

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
  const each = srcs.map(
    (src) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = src;
      }),
  );
  return Promise.race([Promise.all(each), new Promise((r) => setTimeout(r, maxMs))]);
}

type Phase = "load" | "crest" | "reel" | "title" | "exit";

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
  const [year, setYear] = useState(FOUNDED);
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
    preload([LOGO, ...new Set([...FRAMES.map((f) => f.src), ...FILL])], 4000).then(() => {
      if (alive) setPhase("crest");
    });
    return () => {
      alive = false;
      html.style.overflow = prev;
    };
  }, []);

  // The clock: the crest, each frame's hold, the title, the exit.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (phase === "crest") {
      t = setTimeout(() => setPhase("reel"), CREST_MS);
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

  // Act three: the year runs from 1929 to the Invitational's own, eased so
  // it races through the middle decades and slows onto the final number.
  useEffect(() => {
    if (phase !== "reel" || i !== FIRST_TODAY) return;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TODAY_MS);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setYear(Math.round(FOUNDED + (EVENT.year - FOUNDED) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, i]);

  // Photos flicker through the letters, then settle to solid.
  useEffect(() => {
    if (phase !== "title") return;
    const flick = setInterval(() => setFill((n) => (n + 1) % FILL.length), 110);
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
  const frame = FRAMES[i];
  const prevFrame = i > 0 ? FRAMES[i - 1] : null;
  const inReel = phase === "reel";
  const era: Era | "none" = inReel ? frame.era : phase === "crest" ? "archive" : "none";
  const total = CREST_MS + FRAMES.reduce((s, f) => s + f.hold, 0);
  const progress =
    phase === "load"
      ? 0
      : phase === "crest"
        ? 0.04
        : phase === "reel"
          ? ((CREST_MS + FRAMES.slice(0, i).reduce((s, f) => s + f.hold, 0)) / total) * 0.82
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

      {/* Act one: the crest. */}
      {phase === "crest" && (
        <div className="mci-crest-act" aria-hidden>
          <Medal size={210} />
        </div>
      )}

      {/* Acts two and three: the reel. */}
      {(inReel || phase === "title" || phase === "exit") && (
        <div className="mci-reel" aria-hidden>
          {/* Same key it had while current, so React keeps the element and its
              move carries on rather than restarting under the cut. */}
          {prevFrame && inReel && <FrameView key={"f" + (i - 1)} f={prevFrame} under />}
          <FrameView key={"f" + i} f={frame} />
          {!frame.match && <div className="mci-reel-flash" key={"x" + i} />}
          {/* The moment the film turns to colour. */}
          {inReel && i === FIRST_TODAY && <div className="mci-reel-burst" />}
        </div>
      )}

      {/* Letterbox over the archive; it opens when the colour comes in. */}
      <div className="mci-letterbox is-top" aria-hidden />
      <div className="mci-letterbox is-bottom" aria-hidden />

      {inReel && (
        <div className={"mci-reel-year" + (frame.era === "today" ? " is-running" : "")} aria-hidden>
          {year}
        </div>
      )}

      {(phase === "title" || phase === "exit") && (
        <div className="mci-reel-title">
          <div className="mci-reel-title-crest">
            <Medal size={118} />
          </div>
          <div className="mci-reel-word-wrap">
            <div
              className="mci-reel-word is-photo"
              aria-hidden
              style={{ backgroundImage: `url(${FILL[fill]})` }}
            >
              Pasatiempo
            </div>
            <div className="mci-reel-word is-solid" aria-hidden>
              Pasatiempo
            </div>
          </div>
          <div className="mci-reel-rule" aria-hidden />
          <div className="mci-reel-sub">{`The ${EVENT.name} · ${EVENT.year}`}</div>
        </div>
      )}

      {/* Film: grain and flicker over the archive, a vignette always. */}
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

function FrameView({ f, under }: { f: Frame; under?: boolean }) {
  const m = f.move ?? DRIFT;
  const style = {
    "--hold": f.hold + "ms",
    "--focus": f.focus ?? "center",
    "--face": f.face ?? "center",
    "--zoom": f.zoom ?? 1.45,
    "--fs": m.from[0],
    "--fx": m.from[1] + "%",
    "--fy": m.from[2] + "%",
    "--ts": m.to[0],
    "--tx": m.to[1] + "%",
    "--ty": m.to[2] + "%",
    "--origin": m.origin ?? "center",
  } as CSSProperties;
  return (
    <div
      className={
        "mci-reel-frame era-" +
        f.era +
        (f.face ? " is-face" : "") +
        (f.match ? " is-match" : "") +
        (under ? " is-under" : "")
      }
      style={style}
    >
      {f.face ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mci-reel-blur" src={f.src} alt="" />
          <div className="mci-reel-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt="" />
          </div>
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mci-reel-img" src={f.src} alt="" />
      )}
    </div>
  );
}
