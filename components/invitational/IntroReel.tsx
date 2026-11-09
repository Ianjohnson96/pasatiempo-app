"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { EVENT } from "./content";

// The opening title sequence for the Invitational page: a flip-book reel of
// Pasatiempo's archive — MacKenzie, Hollins, the course — that slows on the
// faces, speeds up into a blur of cuts, and lands on PASATIEMPO with the
// photos running through the letters before it settles and lifts away.
//
// Plays once per browser session, on the home tab, and never for visitors who
// ask for reduced motion. Skippable at any point (button, Esc, Enter, Space,
// or a click). The page's own hero animation waits underneath and starts as
// the reel lifts. A replay button lives in the footer.

const IMG = "/invitational/img/";

interface Caption {
  eyebrow: string;
  name: string;
  line: string;
}
interface Frame {
  src: string;
  /** How long the frame holds, in ms. */
  hold: number;
  /** object-position for the crop. */
  focus?: string;
  /** Archive photograph: black-and-white treatment. */
  mono?: boolean;
  /** Portrait card with a push-in toward the face (transform-origin). */
  face?: string;
  /** How far the push-in goes (default 1.45). */
  zoom?: number;
  cap?: Caption;
}

const FRAMES: Frame[] = [
  {
    src: IMG + "course-wide.jpg",
    hold: 1300,
    cap: { eyebrow: "Santa Cruz, California", name: "Pasatiempo", line: "Opened September 8, 1929" },
  },
  {
    src: IMG + "mackenzie.jpg",
    hold: 1500,
    mono: true,
    face: "53% 17%",
    zoom: 2.1,
    cap: { eyebrow: "The Architect", name: "Dr. Alister MacKenzie", line: "Cypress Point · Augusta National · Pasatiempo" },
  },
  { src: IMG + "course-bunkers.jpg", hold: 420 },
  {
    src: IMG + "hollins.avif",
    hold: 1500,
    mono: true,
    face: "50% 34%",
    cap: { eyebrow: "The Founder", name: "Marion Hollins", line: "1921 U.S. Women's Amateur Champion" },
  },
  { src: IMG + "hollins-swing.avif", hold: 520, mono: true, focus: "60% 18%" },
  // ...then the cuts come faster and faster.
  { src: IMG + "aerial.avif", hold: 300 },
  { src: IMG + "sixteenth.jpg", hold: 260 },
  { src: IMG + "mackenzie.jpg", hold: 220, mono: true, focus: "54% 14%" },
  { src: IMG + "clubhouse.avif", hold: 190 },
  { src: IMG + "course-green.jpg", hold: 170 },
  { src: IMG + "hollins.avif", hold: 150, mono: true, focus: "50% 30%" },
  { src: IMG + "formats.avif", hold: 135 },
  { src: IMG + "bunkers-green.avif", hold: 120 },
  { src: IMG + "hollins-swing.avif", hold: 110, mono: true, focus: "60% 15%" },
  { src: IMG + "schedule.avif", hold: 100 },
  { src: IMG + "mackenzie.jpg", hold: 95, mono: true, focus: "54% 14%" },
  { src: IMG + "hero.avif", hold: 90 },
  { src: IMG + "clubhouse-green.jpg", hold: 90 },
  { src: IMG + "aerial.avif", hold: 90 },
];

/** Photos that run through the letters of PASATIEMPO. */
const FILL = [
  "course-wide.jpg",
  "hollins-swing.avif",
  "course-green.jpg",
  "mackenzie.jpg",
  "sixteenth.jpg",
  "hollins.avif",
  "bunkers-green.avif",
  "hero.avif",
].map((f) => IMG + f);

const TITLE_MS = 2300; // PASATIEMPO on screen
const SOLID_AT = 1150; // ...letters stop flickering and settle
const EXIT_MS = 1100; // the reel lifts away

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

type Phase = "load" | "reel" | "title" | "exit";

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
    preload([...new Set([...FRAMES.map((f) => f.src), ...FILL])], 3500).then(() => {
      if (alive) setPhase("reel");
    });
    return () => {
      alive = false;
      html.style.overflow = prev;
    };
  }, []);

  // The clock: each frame's hold, then the title, then the exit.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (phase === "reel") {
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
  const total = FRAMES.reduce((s, f) => s + f.hold, 0);
  const progress =
    phase === "load"
      ? 0
      : phase === "reel"
        ? (FRAMES.slice(0, i).reduce((s, f) => s + f.hold, 0) / total) * 0.8
        : 1;

  return (
    <div
      className={"mci-intro is-" + phase + (solid ? " is-solid" : "")}
      onClick={skip}
      role="presentation"
    >
      {phase === "load" && (
        <div className="mci-intro-loading" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" width={56} height={56} />
        </div>
      )}

      {phase !== "load" && (
        <div className="mci-reel" aria-hidden>
          {/* The outgoing frame stays underneath so a cut never shows black. */}
          {/* Same key it had while current, so React keeps the element and its drift
              carries on rather than restarting under the cut. */}
          {prevFrame && phase === "reel" && <FrameView key={"f" + (i - 1)} f={prevFrame} under />}
          <FrameView key={"f" + i} f={frame} />
          <div className="mci-reel-flash" key={"x" + i} />
        </div>
      )}

      {(phase === "title" || phase === "exit") && (
        <div className="mci-reel-title">
          <div className="mci-reel-eyebrow">Pasatiempo Golf Club &middot; Est. 1929</div>
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

      <div className="mci-reel-grain" aria-hidden />
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

function FrameView({ f, under }: { f: Frame; under?: boolean }) {
  const style = {
    "--hold": f.hold + "ms",
    "--focus": f.focus ?? "center",
    "--face": f.face ?? "center",
    "--zoom": f.zoom ?? 1.45,
  } as CSSProperties;
  return (
    <div
      className={
        "mci-reel-frame" +
        (f.mono ? " is-mono" : "") +
        (f.face ? " is-face" : "") +
        (f.cap ? " has-cap" : "") +
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
      {f.cap && !under && (
        <div className="mci-reel-cap">
          <div className="mci-reel-cap-eyebrow">{f.cap.eyebrow}</div>
          <div className="mci-reel-cap-name">{f.cap.name}</div>
          <div className="mci-reel-cap-line">{f.cap.line}</div>
        </div>
      )}
    </div>
  );
}
