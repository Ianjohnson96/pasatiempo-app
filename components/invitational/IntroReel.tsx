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

// The reel uses light copies of the photographs (1280px WebP, in img/reel):
// each page is on screen for a fraction of a second, and the whole set is
// loaded before the reel starts.
const IMG = "/invitational/img/reel/";
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
  /** A slow camera move (the dissolve cut): scale and offset in %, from → to. */
  move?: [fromScale: number, fromX: number, fromY: number, toScale: number, toX: number, toY: number];
  /** Three photographs side by side in place of one (the panels cut). */
  trio?: { src: string; focus?: string }[];
  /** The colour develops out of a black-and-white print (the light-leak cut). */
  develop?: boolean;
  /** A tall photograph: shown whole, on a soft blurred copy of itself. */
  fit?: boolean;
  /** On a tall (phone) screen only: show the photograph whole, as `fit` does,
   *  where a full-screen crop would cut its subjects out. */
  phoneFit?: boolean;
  /** On a tall (phone) screen only: a different crop, and the point the zoom eases toward. */
  phoneFocus?: string;
  /** How long the slow zoom runs, if not the usual (the scored dissolve). */
  zoomMs?: number;
  /** On a tall (phone) screen only: zoom the photograph out and place it — its
   *  height as a share of the screen (h), its aspect ratio (ar), the point in it
   *  (fx, fy, as fractions) and where on the screen that point sits (tx, ty) —
   *  on a soft blurred copy of itself. For composing to the thirds. */
  phoneWide?: { h: number; ar: number; fx: number; fy: number; tx: number; ty: number };
}

const FRAMES: Frame[] = [
  // ---- 1929: the archive, slowing on the faces, then speeding up ---------
  { src: A("1929-tee-shot-bay.webp"), hold: 320, era: "archive", focus: "center 70%" },
  { src: IMG + "mackenzie.webp", hold: 290, era: "archive", focus: "53% 16%" },
  { src: A("1929-opening-foursome.webp"), hold: 260, era: "archive", focus: "center 10%" },
  { src: IMG + "hollins.webp", hold: 240, era: "archive", focus: "50% 30%" },
  { src: A("1929-gallery-oak.webp"), hold: 220, era: "archive", focus: "center 60%" },
  { src: A("mackenzie-house-1933.webp"), hold: 200, era: "archive", focus: "center 70%" },
  { src: IMG + "hollins-swing.webp", hold: 180, era: "archive", focus: "60% 15%" },
  { src: A("1929-golfer-oak.webp"), hold: 165, era: "archive", focus: "center 70%" },
  { src: A("1929-bunkered-green.webp"), hold: 150, era: "archive", focus: "center 60%" },
  { src: A("mackenzie-house-1933b.webp"), hold: 140, era: "archive", focus: "center 40%" },
  { src: A("1929-opening-foursome.webp"), hold: 130, era: "archive", focus: "72% 10%" },
  { src: IMG + "mackenzie.webp", hold: 120, era: "archive", focus: "53% 14%" },
  // ---- 2027: a flash, and the pages race on in colour --------------------
  { src: T("clock-1929.webp"), hold: 110, era: "today", focus: "18% center" },
  { src: IMG + "course-green.webp", hold: 100, era: "today" },
  { src: T("bridge.webp"), hold: 95, era: "today", focus: "center 60%" },
  { src: T("aerial-dawn.webp"), hold: 90, era: "today" },
  { src: T("flag-green.webp"), hold: 85, era: "today", focus: "70% 60%" },
  { src: T("chairs-bay.webp"), hold: 80, era: "today", focus: "center 45%" },
  { src: IMG + "course-wide.webp", hold: 75, era: "today" },
  { src: IMG + "clubhouse.webp", hold: 70, era: "today" },
  { src: IMG + "hole-4-approach-poster.webp", hold: 65, era: "today" },
  { src: IMG + "aerial.webp", hold: 65, era: "today" },
  { src: IMG + "bunkers-green.webp", hold: 60, era: "today" },
  { src: IMG + "hole-11-approach-poster.webp", hold: 60, era: "today" },
  { src: IMG + "clubhouse-green.webp", hold: 60, era: "today" },
  { src: IMG + "course-bunkers.webp", hold: 60, era: "today" },
  { src: IMG + "schedule.webp", hold: 60, era: "today" },
  { src: IMG + "hero.webp", hold: 60, era: "today" },
];

// ---- Calmer cuts, for comparison -------------------------------------------
// Open the page with ?intro=dissolve, ?intro=wipe or ?intro=letters to play
// one of these in place of the flip-book (it plays even if the intro has
// already been seen this session). Each uses a handful of photographs, held
// long enough to look at, and a title that arrives without flicker.

/** Six photographs, each dissolving slowly into the next. */
const DISSOLVE: Frame[] = [
  // 1929 — a slow rise over the crowd at the tee, the bay beyond.
  { src: A("1929-tee-shot-bay.webp"), hold: 760, era: "archive", focus: "center 70%", move: [1.12, 0, 3, 1.04, 0, -1] },
  // Push in on the foursome.
  { src: A("1929-opening-foursome.webp"), hold: 700, era: "archive", focus: "center 10%", move: [1.02, 0, 0, 1.12, 0, 1] },
  { src: IMG + "mackenzie.webp", hold: 700, era: "archive", focus: "53% 16%", move: [1.14, 0, 0, 1.04, 0, 0] },
  // Drift across the gallery under the oak.
  { src: A("1929-gallery-oak.webp"), hold: 700, era: "archive", focus: "center 60%", move: [1.1, 2.5, 0, 1.1, -2, 0] },
  { src: IMG + "hollins.webp", hold: 700, era: "archive", focus: "50% 30%", move: [1.04, 0, 0, 1.14, 0, 0] },
  { src: A("1929-bunkered-green.webp"), hold: 760, era: "archive", focus: "center 60%", move: [1.04, 0, 0, 1.12, 0, 0] },
  // 2027 — the same kind of green, in colour, and the light comes up.
  { src: IMG + "course-green.webp", hold: 760, era: "today", focus: "center 60%", move: [1.12, 0, 0, 1.04, 0, 0] },
  // Walk forward across the bridge.
  { src: T("bridge.webp"), hold: 700, era: "today", focus: "center 60%", move: [1.02, 0, 0, 1.14, 0, 1] },
  { src: T("flag-green.webp"), hold: 700, era: "today", focus: "70% 60%", move: [1.1, -2, 0, 1.1, 2, 0] },
  // ...and pull back over the course at dawn, where the title rises.
  { src: T("aerial-dawn.webp"), hold: 800, era: "today", focus: "center 50%", move: [1.14, 0, 1, 1.05, 0, 0] },
];
/** Then and now: three 1929 photographs, each wiped away by its view today. */
const WIPE: Frame[] = [
  { src: A("1929-tee-shot-bay.webp"), hold: 800, era: "archive", focus: "center 70%" },
  { src: T("chairs-bay.webp"), hold: 800, era: "today", focus: "center 45%" },
  { src: A("1929-bunkered-green.webp"), hold: 800, era: "archive", focus: "center 60%" },
  { src: IMG + "course-green.webp", hold: 800, era: "today", focus: "center 60%" },
  { src: A("1929-gallery-oak.webp"), hold: 800, era: "archive", focus: "center 60%" },
  { src: T("aerial-dawn.webp"), hold: 800, era: "today" },
];
/** PASATIEMPO from the first frame, the photographs seen only through its letters. */
const LETTERS: Frame[] = [
  { src: A("1929-tee-shot-bay.webp"), hold: 900, era: "archive", focus: "center 70%" },
  { src: A("1929-opening-foursome.webp"), hold: 900, era: "archive", focus: "center 10%" },
  { src: A("1929-bunkered-green.webp"), hold: 900, era: "archive", focus: "center 60%" },
  { src: IMG + "course-green.webp", hold: 900, era: "today", focus: "center 60%" },
  { src: T("aerial-dawn.webp"), hold: 900, era: "today" },
];

const TITLE_MS = 3200; // PASATIEMPO on screen

// ---- Ten-second cuts -------------------------------------------------------
// Quicker than the dissolve (about ten seconds, title and fade included), each
// with one idea of its own. They share the dissolve's widescreen look and its
// title over the course, timed a little tighter.

/** 1 · The dissolve, quicker: each cut a little shorter than the last. */
const TIGHT: Frame[] = [
  { src: A("1929-tee-shot-bay.webp"), hold: 680, era: "archive", focus: "center 70%", move: [1.12, 0, 3, 1.04, 0, -1] },
  { src: A("1929-opening-foursome.webp"), hold: 600, era: "archive", focus: "center 10%", move: [1.02, 0, 0, 1.12, 0, 1] },
  { src: IMG + "mackenzie.webp", hold: 560, era: "archive", focus: "53% 16%", move: [1.14, 0, 0, 1.04, 0, 0] },
  { src: A("1929-gallery-oak.webp"), hold: 520, era: "archive", focus: "center 60%", move: [1.1, 2.5, 0, 1.1, -2, 0] },
  { src: IMG + "hollins.webp", hold: 500, era: "archive", focus: "50% 30%", move: [1.04, 0, 0, 1.14, 0, 0] },
  { src: A("1929-bunkered-green.webp"), hold: 480, era: "archive", focus: "center 60%", move: [1.04, 0, 0, 1.12, 0, 0] },
  { src: IMG + "course-green.webp", hold: 560, era: "today", focus: "center 60%", move: [1.12, 0, 0, 1.04, 0, 0] },
  { src: T("bridge.webp"), hold: 460, era: "today", focus: "center 60%", move: [1.02, 0, 0, 1.14, 0, 1] },
  { src: T("flag-green.webp"), hold: 440, era: "today", focus: "70% 60%", move: [1.1, -2, 0, 1.1, 2, 0] },
  { src: T("aerial-dawn.webp"), hold: 640, era: "today", focus: "center 50%", move: [1.14, 0, 1, 1.05, 0, 0] },
];
/** 2 · Rack focus: each photograph pulls sharp out of a blur as the last one softens away. */
const FOCUS: Frame[] = [
  { src: A("1929-tee-shot-bay.webp"), hold: 780, era: "archive", focus: "center 70%", move: [1.08, 1.5, 0, 1.04, -1.5, 0] },
  { src: IMG + "mackenzie.webp", hold: 700, era: "archive", focus: "53% 16%", move: [1.1, 0, 0, 1.03, 0, 0] },
  { src: A("1929-opening-foursome.webp"), hold: 700, era: "archive", focus: "center 10%", move: [1.08, -1.5, 0, 1.04, 1.5, 0] },
  { src: IMG + "hollins.webp", hold: 700, era: "archive", focus: "50% 30%", move: [1.03, 0, 0, 1.1, 0, 0] },
  { src: IMG + "course-green.webp", hold: 760, era: "today", focus: "center 60%", move: [1.1, 0, 0, 1.03, 0, 0] },
  { src: T("bridge.webp"), hold: 680, era: "today", focus: "center 60%", move: [1.03, 0, 0, 1.1, 0, 1] },
  { src: T("aerial-dawn.webp"), hold: 760, era: "today", focus: "center 50%", move: [1.12, 0, 1, 1.04, 0, 0] },
];
/** 3 · Through the crest: a gold ring draws on black and 1929 is seen through it, then the ring opens out into 2027. */
const IRIS: Frame[] = [
  { src: A("1929-tee-shot-bay.webp"), hold: 760, era: "archive", focus: "center 70%", move: [1.16, 0, 0, 1.06, 0, 0] },
  { src: A("1929-opening-foursome.webp"), hold: 660, era: "archive", focus: "center 10%", move: [1.04, 0, 0, 1.14, 0, 0] },
  { src: IMG + "mackenzie.webp", hold: 660, era: "archive", focus: "53% 16%", move: [1.16, 0, 0, 1.06, 0, 0] },
  { src: IMG + "hollins.webp", hold: 660, era: "archive", focus: "50% 30%", move: [1.04, 0, 0, 1.14, 0, 0] },
  { src: A("1929-bunkered-green.webp"), hold: 620, era: "archive", focus: "center 60%", move: [1.06, 0, 0, 1.14, 0, 0] },
  { src: IMG + "course-green.webp", hold: 900, era: "today", focus: "center 60%", move: [1.16, 0, 0, 1.04, 0, 0] },
  { src: T("bridge.webp"), hold: 560, era: "today", focus: "center 60%", move: [1.02, 0, 0, 1.12, 0, 1] },
  { src: T("aerial-dawn.webp"), hold: 700, era: "today", focus: "center 50%", move: [1.14, 0, 1, 1.05, 0, 0] },
];
/** 4 · Light leaks: warm film burns wash across each cut, and 2027 develops out of a black-and-white print. */
const LEAK: Frame[] = [
  { src: A("1929-tee-shot-bay.webp"), hold: 700, era: "archive", focus: "center 70%", move: [1.12, 0, 3, 1.04, 0, -1] },
  { src: A("1929-opening-foursome.webp"), hold: 620, era: "archive", focus: "center 10%", move: [1.02, 0, 0, 1.12, 0, 1] },
  { src: IMG + "mackenzie.webp", hold: 620, era: "archive", focus: "53% 16%", move: [1.14, 0, 0, 1.04, 0, 0] },
  { src: A("1929-gallery-oak.webp"), hold: 580, era: "archive", focus: "center 60%", move: [1.1, 2.5, 0, 1.1, -2, 0] },
  { src: IMG + "hollins.webp", hold: 580, era: "archive", focus: "50% 30%", move: [1.04, 0, 0, 1.14, 0, 0] },
  { src: IMG + "course-green.webp", hold: 1100, era: "today", focus: "center 60%", move: [1.12, 0, 0, 1.03, 0, 0], develop: true },
  { src: T("bridge.webp"), hold: 520, era: "today", focus: "center 60%", move: [1.02, 0, 0, 1.14, 0, 1] },
  { src: T("aerial-dawn.webp"), hold: 680, era: "today", focus: "center 50%", move: [1.14, 0, 1, 1.05, 0, 0] },
];
/** 5 · Panels: three photographs at a time rise in like a gallery wall; the last opens out from the centre panel. */
const PANELS: Frame[] = [
  {
    src: A("1929-tee-shot-bay.webp"), hold: 1500, era: "archive",
    trio: [
      { src: A("1929-tee-shot-bay.webp"), focus: "center 70%" },
      { src: IMG + "mackenzie.webp", focus: "53% 16%" },
      { src: IMG + "hollins.webp", focus: "50% 30%" },
    ],
  },
  {
    src: A("1929-opening-foursome.webp"), hold: 1400, era: "archive",
    trio: [
      { src: A("1929-opening-foursome.webp"), focus: "35% 10%" },
      { src: A("1929-gallery-oak.webp"), focus: "center 60%" },
      { src: A("1929-bunkered-green.webp"), focus: "center 60%" },
    ],
  },
  {
    src: T("bridge.webp"), hold: 1400, era: "today",
    trio: [
      { src: T("bridge.webp"), focus: "center 60%" },
      { src: T("flag-green.webp"), focus: "70% 60%" },
      { src: T("chairs-bay.webp"), focus: "center 45%" },
    ],
  },
  { src: T("aerial-dawn.webp"), hold: 900, era: "today", focus: "center 50%", move: [1.14, 0, 1, 1.05, 0, 0] },
];

// ---- The film reel ----------------------------------------------------------
// The photographs as frames on one strip of 35mm film. At each cut the camera
// eases back off the frame (the gap, the sprocket holes and the next frame come
// into view), the strip slides left to the next frame, and the camera eases
// back in. 1929 runs into 2027 on the same strip; the last frame is pushed
// into and the title rises over it.

/** Film frames: the first holds after the opening push, the rest include their slide in. */
const REEL: Frame[] = [
  { src: A("1929-tee-shot-bay.webp"), hold: 1250, era: "archive", focus: "center 70%" },
  { src: IMG + "mackenzie.webp", hold: 950, era: "archive", focus: "53% 16%" },
  { src: IMG + "hollins.webp", hold: 950, era: "archive", focus: "50% 30%" },
  { src: A("1929-bunkered-green.webp"), hold: 950, era: "archive", focus: "center 60%" },
  { src: IMG + "course-green.webp", hold: 950, era: "today", focus: "center 60%" },
  { src: T("aerial-dawn.webp"), hold: 1350, era: "today", focus: "center 50%" },
];
/** The whip: the same, but the strip races off to 2027, past frames blurred by speed. */
const WHIP: Frame[] = REEL.map((f, k) => (k === 4 ? { ...f, hold: 1200 } : f));
/** Frames the whip races past between 1929 and 2027 (never stopped on). */
const WHIP_PAST: Frame[] = [
  { src: A("1929-golfer-oak.webp"), hold: 0, era: "archive", focus: "center 70%" },
  { src: T("chairs-bay.webp"), hold: 0, era: "today", focus: "center 45%" },
];

// ---- The film pan -----------------------------------------------------------
// The whole screen is a strip of old film — sprocket holes top and bottom (down
// the sides on a phone, where the film runs vertically, as it does through a
// projector) — and the camera pans along it: the archive first, gathering
// speed, then the course today in colour. The strip keeps drifting, dimmed,
// under the title. No zoom.

/** Each hold is how long the pan takes to bring that frame to centre. */
const PAN: Frame[] = [
  { src: A("1929-tee-shot-bay.webp"), hold: 900, era: "archive", focus: "center 70%" },
  { src: A("1929-opening-foursome.webp"), hold: 640, era: "archive", focus: "center 20%" },
  { src: IMG + "mackenzie.webp", hold: 600, era: "archive", focus: "53% 22%" },
  { src: A("1929-gallery-oak.webp"), hold: 560, era: "archive", focus: "center 60%" },
  { src: IMG + "hollins.webp", hold: 540, era: "archive", focus: "50% 30%" },
  { src: A("1929-golfer-oak.webp"), hold: 500, era: "archive", focus: "center 70%" },
  { src: A("mackenzie-house-1933.webp"), hold: 470, era: "archive", focus: "center 70%" },
  { src: IMG + "hollins-swing.webp", hold: 450, era: "archive", focus: "60% 20%" },
  { src: A("1929-bunkered-green.webp"), hold: 440, era: "archive", focus: "center 60%" },
  { src: IMG + "course-green.webp", hold: 460, era: "today", focus: "center 60%" },
  { src: T("bridge.webp"), hold: 430, era: "today", focus: "center 60%" },
  { src: T("flag-green.webp"), hold: 420, era: "today", focus: "70% 60%" },
  { src: T("clock-1929.webp"), hold: 420, era: "today", focus: "18% center" },
  { src: T("chairs-bay.webp"), hold: 440, era: "today", focus: "center 45%" },
  { src: T("aerial-dawn.webp"), hold: 560, era: "today", focus: "center 50%" },
];
/** After the last frame: more of the strip, for the drift under the title. */
const PAN_TAIL: Frame[] = [
  { src: IMG + "hole-4-approach-poster.webp", hold: 0, era: "today" },
  { src: IMG + "clubhouse-green.webp", hold: 0, era: "today" },
  { src: IMG + "hero.webp", hold: 0, era: "today" },
];

// ---- The film, scored (the default) ------------------------------------------
// The film pan, slower and never pausing, timed to the music: "A Perfect Day"
// (Danny Cope), 0:39–0:54 then 1:11–1:22, crossfaded and faded out
// (audio/intro-a-perfect-day.mp3, 25 s). The archive runs through the first
// passage; the film turns to colour on the swell that opens the second
// (about 15.5 s in), and the title rises on the next (about 20.5 s), drifting
// to a stop as the music fades.
const MUSIC = "/invitational/audio/intro-a-perfect-day.mp3";
const FILM_STEP = 1550; // every frame takes the same time: one steady speed
const film = (f: Omit<Frame, "hold">): Frame => ({ ...f, hold: FILM_STEP });
const FILM: Frame[] = [
  film({ src: A("1929-tee-shot-bay.webp"), era: "archive", focus: "center 70%" }),
  film({ src: A("1929-opening-foursome.webp"), era: "archive", focus: "center 20%" }),
  film({ src: IMG + "mackenzie.webp", era: "archive", focus: "53% 22%" }),
  film({ src: A("1929-gallery-oak.webp"), era: "archive", focus: "center 60%" }),
  film({ src: IMG + "hollins.webp", era: "archive", focus: "50% 30%" }),
  film({ src: A("1929-golfer-oak.webp"), era: "archive", focus: "center 70%" }),
  film({ src: A("mackenzie-house-1933.webp"), era: "archive", focus: "center 70%" }),
  film({ src: IMG + "hollins-swing.webp", era: "archive", focus: "60% 20%" }),
  film({ src: A("mackenzie-house-1933b.webp"), era: "archive", focus: "center 45%" }),
  film({ src: A("1929-bunkered-green.webp"), era: "archive", focus: "center 60%" }),
  film({ src: IMG + "course-green.webp", era: "today", focus: "center 60%" }),
  film({ src: T("bridge.webp"), era: "today", focus: "center 60%" }),
  film({ src: T("flag-green.webp"), era: "today", focus: "70% 60%" }),
];
/** The strip under the title: it comes to rest on the dawn aerial. */
const FILM_TAIL: Frame[] = [
  { src: T("aerial-dawn.webp"), hold: 0, era: "today", focus: "center 50%" },
  { src: T("chairs-bay.webp"), hold: 0, era: "today", focus: "center 45%" },
  { src: T("clock-1929.webp"), hold: 0, era: "today", focus: "18% center" },
  { src: IMG + "hole-4-approach-poster.webp", hold: 0, era: "today" },
];

// ---- The scored dissolve (the default) ---------------------------------------
// Nine full-screen photographs, each easing slowly in (about 6%) and dissolving
// into the next, cut to the music: "A Perfect Day" (Danny Cope), 0:39–0:54.2
// then 1:10.3–1:22.6 — a join placed so the song's five-second phrase carries
// straight through it (audio/intro-a-perfect-day.mp3, 27 s).
//
// The song swells every 5 s (at about 2.2, 7.0, 12.0, 17.0 and 21.9 s). The
// photographs change on each swell and halfway between, each dissolve starting
// just ahead of its beat so the new photograph has arrived as the music lands.
// 1929 runs through the first passage; colour arrives on the 17 s swell; the
// club's 1929 logo and the PASATIEMPO wordmark rise on the next.
const SCORE_CUES = [300, 1650, 4000, 6400, 8900, 11400, 13900, 16400, 18900, 21400];
const SCORE_TITLE_AT = 21900;
const SCORE_EXIT_AT = 25300;
/** Every photograph eases in, about 6%, toward its subject (the focus point). */
const ZOOM: Frame["move"] = [1, 0, 0, 1.06, 0, 0];
const SCORE: Frame[] = (
  [
    // The tee shot and the foursome are wide groups: on a phone they show whole.
    { src: A("1929-tee-shot-bay.webp"), era: "archive", focus: "center 70%", phoneFit: true },
    { src: A("1929-opening-foursome.webp"), era: "archive", focus: "center 15%", phoneFit: true },
    { src: IMG + "mackenzie.webp", era: "archive", focus: "53% 18%" },
    { src: IMG + "hollins.webp", era: "archive", focus: "50% 30%", phoneFocus: "50% 0%" },
    { src: A("1929-gallery-oak.webp"), era: "archive", focus: "center 60%" },
    { src: A("1929-bunkered-green.webp"), era: "archive", focus: "center 60%" },
    // Colour, on the music's turn: the green below the clubhouse (a panorama —
    // zoomed out on a phone so the green and the house both show).
    {
      src: IMG + "clubhouse-green.webp", era: "today", focus: "55% 60%",
      phoneWide: { h: 0.46, ar: 1280 / 440, fx: 0.55, fy: 0.6, tx: 0.5, ty: 0.5 },
    },
    // The clubhouse: the camera eases back rather than in.
    {
      src: IMG + "clubhouse.webp", era: "today", focus: "60% 40%", move: [1.1, 0, 0, 1.01, 0, 0],
      phoneWide: { h: 0.62, ar: 1280 / 786, fx: 0.6, fy: 0.36, tx: 0.5, ty: 0.38 },
    },
    { src: T("bridge.webp"), era: "today", focus: "center 62%" },
    // The last photograph, under the title: the club's clock, est. 1929, at dusk.
    // On a phone it is zoomed out with the clock face on the upper-left third,
    // clear of the title below it.
    {
      src: T("clock-1929.webp"), era: "today", focus: "18% center",
      phoneWide: { h: 0.7, ar: 1.5, fx: 0.235, fy: 0.31, tx: 1 / 3, ty: 0.3 },
    },
  ] as Omit<Frame, "hold">[]
).map((f, k, all) => ({
  ...f,
  // The last photograph stays on through the title, so its zoom runs on
  // (a little further, at the same pace) rather than restarting.
  move: k === all.length - 1 ? ([1, 0, 0, 1.1, 0, 0] as Frame["move"]) : (f.move ?? ZOOM),
  zoomMs: k === all.length - 1 ? 7200 : undefined,
  hold: (k + 1 < SCORE_CUES.length ? SCORE_CUES[k + 1] : SCORE_TITLE_AT) - SCORE_CUES[k],
}));
/** The closing title: the club's 1929 logo (the version for dark backgrounds,
 *  public/brand), and its name in the logo's own script. */
const MARK = "/brand/pasatiempo-logo-1929-reverse.png";
const WORDMARK = "/invitational/img/wordmark-pasatiempo.svg";

interface ReelLook {
  /** How far the camera pulls back between frames (1 = not at all). */
  out: number;
  /** Race to 2027 past blurred frames, instead of one ordinary slide. */
  whip?: boolean;
}

type Variant =
  | "flip" | "dissolve" | "wipe" | "letters" | "tight" | "focus" | "iris" | "leak" | "panels"
  | "reel" | "reel-wide" | "whip" | "whip-wide" | "pan" | "pan-step" | "film" | "score";
interface Cut {
  frames: Frame[];
  /** How long PASATIEMPO holds, in ms. */
  titleMs: number;
  /** The beat of black before the first photograph. */
  leadMs?: number;
  /** The widescreen look and the title over the course (the dissolve family). */
  cine?: boolean;
  /** The ten-second timing: a quicker title and a quicker lift. */
  fast?: boolean;
  /** Play the photographs as frames on a film strip. */
  reel?: ReelLook;
  /** The whole screen is the film, panned along (step: settle on each frame;
   *  glide: one steady speed, never pausing, easing to rest under the title). */
  pan?: { step?: boolean; glide?: boolean; tail?: Frame[] };
  /** A soundtrack, started with the first frame. */
  music?: string;
  /** Cut to the music: when each frame starts, the title rises and the reel
   *  lifts, in ms from the first beat of black — kept to the music's own clock. */
  cues?: { frames: number[]; title: number; exit: number };
}
const VARIANTS: Record<Variant, Cut> = {
  flip: { frames: FRAMES, titleMs: TITLE_MS },
  dissolve: { frames: DISSOLVE, titleMs: 4300, cine: true },
  wipe: { frames: WIPE, titleMs: TITLE_MS },
  letters: { frames: LETTERS, titleMs: TITLE_MS },
  tight: { frames: TIGHT, titleMs: 2900, cine: true, fast: true },
  focus: { frames: FOCUS, titleMs: 2900, cine: true, fast: true },
  iris: { frames: IRIS, titleMs: 2800, leadMs: 1000, cine: true, fast: true },
  leak: { frames: LEAK, titleMs: 2900, cine: true, fast: true },
  panels: { frames: PANELS, titleMs: 2900, cine: true, fast: true },
  reel: { frames: REEL, titleMs: 2600, cine: true, fast: true, reel: { out: 0.85 } },
  "reel-wide": { frames: REEL, titleMs: 2600, cine: true, fast: true, reel: { out: 0.65 } },
  whip: { frames: WHIP, titleMs: 2600, cine: true, fast: true, reel: { out: 0.85, whip: true } },
  "whip-wide": { frames: WHIP, titleMs: 2600, cine: true, fast: true, reel: { out: 0.65, whip: true } },
  pan: { frames: PAN, titleMs: 2600, cine: true, fast: true, pan: {} },
  "pan-step": { frames: PAN, titleMs: 2600, cine: true, fast: true, pan: { step: true } },
  film: {
    frames: FILM,
    titleMs: 3050,
    leadMs: 300,
    cine: true,
    fast: true,
    pan: { glide: true, tail: FILM_TAIL },
    music: MUSIC,
  },
  score: {
    frames: SCORE,
    titleMs: SCORE_EXIT_AT - SCORE_TITLE_AT,
    leadMs: SCORE_CUES[0],
    cine: true,
    fast: true,
    music: MUSIC,
    cues: { frames: SCORE_CUES, title: SCORE_TITLE_AT, exit: SCORE_EXIT_AT },
  },
};
/** The intro visitors get. The others play with ?intro=<name>. */
const DEFAULT_VARIANT: Variant = "score";
function readVariant(): Variant {
  try {
    const v = new URLSearchParams(location.search).get("intro");
    return v && v in VARIANTS ? (v as Variant) : DEFAULT_VARIANT;
  } catch {
    return DEFAULT_VARIANT;
  }
}

/** Photos that run through the letters of PASATIEMPO — then and now. */
const FILL = [
  A("1929-tee-shot-bay.webp"),
  T("aerial-dawn.webp"),
  A("1929-opening-foursome.webp"),
  IMG + "course-green.webp",
  A("1929-bunkered-green.webp"),
  T("bridge.webp"),
  A("1929-gallery-oak.webp"),
  IMG + "hole-4-approach-poster.webp",
  IMG + "mackenzie.webp",
  T("flag-green.webp"),
];
/** ...and the pages that keep turning behind the title until it settles. */
const BEHIND = FRAMES.map((f) => f.src);
const SETTLE_ON = T("chairs-bay.webp");

const LEAD_MS = 250; // a beat of black before the first page
const SOLID_AT = 1100; // ...letters stop flickering and settle
// The handoff into the page, in two stages: the title fades out first, then
// the dark lifts slowly off the page (the CSS times both). The page's own
// title starts rising once the first stage is done, so the two never overlap.
const EXIT_MS = 1900; // the whole lift
const REVEAL_AT = 700; // ...when the page underneath starts its entrance
// A skip shouldn't make anyone wait: it lifts in a blink.
const QUICK_EXIT_MS = 500;
// The ten-second cuts lift a little sooner.
const FAST_EXIT_MS = 1500;
const FAST_REVEAL_AT = 500;
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
export const INTRO_GATE = `(function(){var skip=true;try{var h=location.hash.slice(1);skip=(h&&h!=="home")||!!sessionStorage.getItem("${SEEN_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches;if(/[?&]intro=/.test(location.search))skip=false;}catch(e){}if(skip){window.__mciIntro="skip";var s=document.createElement("style");s.id="${SKIP_STYLE}";s.textContent=".mci-intro{display:none!important}";document.head.appendChild(s);}})();`;

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
    if (/[?&]intro=/.test(location.search)) return false;
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
  const [quick, setQuick] = useState(false);
  const [variant, setVariant] = useState<Variant>(DEFAULT_VARIANT);
  const [sound, setSound] = useState<"idle" | "on" | "muted" | "blocked">("idle");
  const music = useRef<HTMLAudioElement | null>(null);
  const musicStart = useRef(0);
  const cut = VARIANTS[variant];
  const frames = cut.frames;
  const calm = variant !== "flip";
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
    const v = readVariant();
    const srcs =
      v === "flip"
        ? [...BEHIND, ...FILL]
        : [
            ...VARIANTS[v].frames.flatMap((f) => (f.trio ? f.trio.map((p) => p.src) : [f.src])),
            ...(VARIANTS[v].reel?.whip ? WHIP_PAST.map((f) => f.src) : []),
            ...(VARIANTS[v].pan ? (VARIANTS[v].pan.tail ?? PAN_TAIL).map((f) => f.src) : []),
            SETTLE_ON,
            ...(v === "score" ? [MARK, WORDMARK] : []),
          ];
    // The soundtrack loads alongside the photographs (it never holds them up long).
    const src = VARIANTS[v].music;
    const audio = src ? new Audio(src) : null;
    const audioReady = audio
      ? new Promise<void>((resolve) => {
          audio.preload = "auto";
          audio.addEventListener("canplaythrough", () => resolve(), { once: true });
          audio.addEventListener("error", () => resolve(), { once: true });
          audio.load();
        })
      : Promise.resolve();
    music.current = audio;
    Promise.all([
      preload([LOGO, ...new Set(srcs)], 3000),
      Promise.race([audioReady, new Promise((r) => setTimeout(r, 3000))]),
    ]).then(() => {
      if (!alive) return;
      setVariant(v);
      setPhase("lead");
    });
    return () => {
      alive = false;
      html.style.overflow = prev;
      audio?.pause();
    };
  }, []);

  // The soundtrack starts with the first frame. A browser that won't play
  // sound before the visitor has touched the page gets a button instead,
  // which joins the music at the right moment.
  useEffect(() => {
    if (phase !== "lead") return;
    musicStart.current = performance.now();
    const a = music.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().then(
      () => setSound("on"),
      () => setSound("blocked"),
    );
  }, [phase]);

  // A skip fades the music out quickly (it fades itself at the natural end).
  useEffect(() => {
    if (phase !== "exit" || !quick) return;
    const a = music.current;
    if (!a || a.paused) return;
    const from = a.volume;
    const t0 = performance.now();
    const id = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 450);
      a.volume = from * (1 - k);
      if (k >= 1) {
        clearInterval(id);
        a.pause();
      }
    }, 30);
    return () => clearInterval(id);
  }, [phase, quick]);

  const toggleSound = () => {
    const a = music.current;
    if (!a) return;
    if (sound === "blocked") {
      a.currentTime = Math.max(0, (performance.now() - musicStart.current) / 1000);
      a.muted = false;
      a.play().then(() => setSound("on"), () => setSound("blocked"));
    } else {
      a.muted = sound === "on";
      setSound(sound === "on" ? "muted" : "on");
    }
  };

  // The clock: a beat of black, each page's hold, the title, the exit.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    let r: ReturnType<typeof setTimeout> | undefined;
    // Cut to music: wait for the cue on the music's own clock, so the pictures
    // never drift off the beat. (Before the music starts, or without it, the
    // page's clock stands in.)
    const cues = cut.cues;
    const until = (at: number) => {
      const a = music.current;
      const now = a && !a.paused ? a.currentTime * 1000 : performance.now() - musicStart.current;
      return Math.max(0, at - now);
    };
    if (phase === "lead") {
      t = setTimeout(() => setPhase("reel"), cues ? until(cues.frames[0]) : (cut.leadMs ?? LEAD_MS));
    } else if (phase === "reel") {
      const next = cues ? until(i < frames.length - 1 ? cues.frames[i + 1] : cues.title) : frames[i].hold;
      t = setTimeout(() => {
        if (i < frames.length - 1) setI(i + 1);
        else setPhase("title");
      }, next);
    } else if (phase === "title") {
      t = setTimeout(() => setPhase("exit"), cues ? until(cues.exit) : cut.titleMs);
    } else if (phase === "exit") {
      markSeen();
      if (quick) {
        done.current.onReveal();
        t = setTimeout(() => done.current.onDone(), QUICK_EXIT_MS);
      } else {
        r = setTimeout(() => done.current.onReveal(), cut.fast ? FAST_REVEAL_AT : REVEAL_AT);
        t = setTimeout(() => done.current.onDone(), cut.fast ? FAST_EXIT_MS : EXIT_MS);
      }
    }
    return () => {
      clearTimeout(t);
      clearTimeout(r);
    };
  }, [phase, i, quick, frames, cut]);

  // Under the title, the pages keep turning — through the letters and behind
  // them — then stop and the letters settle solid.
  useEffect(() => {
    if (phase !== "title") return;
    // The calm cuts don't flicker: the last photograph holds in the letters.
    const flick = calm ? undefined : setInterval(() => setFill((n) => n + 1), 75);
    const settle = setTimeout(() => {
      clearInterval(flick);
      setSolid(true);
    }, SOLID_AT);
    return () => {
      clearInterval(flick);
      clearTimeout(settle);
    };
  }, [phase, calm]);

  // Skip from the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setQuick(true);
        setPhase("exit");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const skip = () => {
    setQuick(true);
    setPhase("exit");
  };
  const inReel = phase === "reel";
  const inTitle = phase === "title" || phase === "exit";
  const frame = frames[i];
  const prevFrame = i > 0 ? frames[i - 1] : null;
  const cine = !!cut.cine;
  /** This cut is the turn from 1929 to colour. */
  const turning = i > 0 && frame.era === "today" && prevFrame?.era === "archive";
  const last = frames[frames.length - 1];
  const era: Era | "none" = inReel ? frame.era : "none";
  // Behind the title: the pages keep turning, then rest on the bay.
  const behind: Frame = calm
    ? last
    : solid
    ? { src: SETTLE_ON, hold: 900, era: "today", focus: "center 45%" }
    : { src: BEHIND[(FIRST_TODAY + fill) % BEHIND.length], hold: 75, era: "today" };
  const behindPrev: Frame | null =
    !calm && !solid && fill > 0
      ? { src: BEHIND[(FIRST_TODAY + fill - 1) % BEHIND.length], hold: 75, era: "today" }
      : null;

  const total = frames.reduce((s, f) => s + f.hold, 0);
  const progress =
    phase === "load" || phase === "lead"
      ? 0
      : inReel
        ? (frames.slice(0, i).reduce((s, f) => s + f.hold, 0) / total) * 0.75
        : 1;

  return (
    <div
      className={
        "mci-intro is-" + phase + " era-" + era + " var-" + variant +
        (calm ? " is-calm" : "") + (cut.cine ? " is-cine" : "") + (cut.fast ? " is-fast" : "") +
        (cut.reel ? " is-film" : "") + (cut.pan ? " is-pan" : "") +
        (solid ? " is-solid" : "") + (quick ? " is-quick" : "")
      }
      onClick={skip}
      role="presentation"
    >
      {phase === "load" && (
        <div className="mci-intro-loading" aria-hidden>
          <span className="mci-intro-dot" />
        </div>
      )}

      {/* Through the crest: a gold ring draws on black, 1929 shows through it,
          and it opens out past the edges of the screen for 2027. */}
      {variant === "iris" && (phase === "lead" || inReel) && (
        <div className="mci-iris" aria-hidden>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="49.4" />
          </svg>
        </div>
      )}

      {/* The flip-book. The page underneath keeps its key, so React keeps the
          element and nothing restarts under the turn. */}
      {/* The film pan runs on under the title, so it stays mounted through both. */}
      {(inReel || inTitle) && cut.pan && (
        <div className="mci-reel" aria-hidden>
          <FilmPan
            frames={frames}
            step={!!cut.pan.step}
            glide={!!cut.pan.glide}
            tail={cut.pan.tail ?? PAN_TAIL}
            tailMs={cut.titleMs + FAST_EXIT_MS}
          />
        </div>
      )}
      {inReel && cut.reel && (
        <div className="mci-reel" aria-hidden>
          <FilmReel frames={frames} i={i} look={cut.reel} />
          {turning && <div className="mci-reel-bloom" />}
        </div>
      )}
      {(inReel || (inTitle && !!cut.cues)) && !cut.reel && !cut.pan && (
        <div className="mci-reel" aria-hidden>
          {prevFrame && <Page key={"p" + (i - 1)} f={prevFrame} under />}
          <Page key={"p" + i} f={frame} />
          {!calm && i === FIRST_TODAY && <div className="mci-reel-burst" />}
          {/* The dissolve family: a warm bloom of light as 1929 turns to colour
              (an anamorphic flare in the rack-focus cut). */}
          {cine && turning && variant !== "leak" && <div className="mci-reel-bloom" />}
          {variant === "focus" && turning && <div className="mci-flare" />}
          {/* Light leaks: a warm burn washes across every cut, biggest at the turn to colour. */}
          {variant === "leak" && i > 0 && (
            <div
              className={"mci-leak" + (i % 2 ? " is-alt" : "") + (turning ? " is-big" : "")}
              key={"l" + i}
            />
          )}
          {/* Then-and-now: a gold line leads each wipe across. */}
          {variant === "wipe" && i > 0 && <div className="mci-wipe-line" key={"w" + i} />}
        </div>
      )}
      {/* Letters: the photographs show only through PASATIEMPO. The black
          sheet multiplies everything but its white letters to black; it is
          laid out exactly like the title, so the title takes over in place. */}
      {variant === "letters" && (inReel || inTitle) && (
        <div className="mci-knock" aria-hidden>
          <div className="mci-knock-space" style={{ height: 116 }} />
          <div className="mci-reel-word-wrap">
            <div className="mci-reel-word">Pasatiempo</div>
          </div>
          <div className="mci-knock-space" style={{ height: 15 }} />
          <div className="mci-reel-sub">&nbsp;</div>
        </div>
      )}
      {inTitle && !cut.pan && !cut.cues && (
        <div className="mci-reel is-behind" aria-hidden>
          {behindPrev && <Page key={"b" + (fill - 1)} f={behindPrev} under />}
          <Page key={calm ? "b-calm" : solid ? "b-settle" : "b" + fill} f={behind} under={calm} />
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

      {inTitle && variant === "score" && (
        <div className="mci-reel-title mci-st">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mci-st-mark" src={MARK} alt={`Pasatiempo Golf Club, ${FOUNDED}`} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mci-st-word" src={WORDMARK} alt="Pasatiempo" />
          <div className="mci-st-rule" aria-hidden />
          <div className="mci-st-sub">{`The ${EVENT.name} · ${EVENT.year}`}</div>
        </div>
      )}
      {inTitle && variant !== "score" && (
        <div className="mci-reel-title">
          <div className="mci-reel-title-crest">
            <Medal size={110} />
          </div>
          <div className="mci-reel-word-wrap">
            <div
              className="mci-reel-word is-photo"
              aria-hidden
              style={{ backgroundImage: `url(${calm ? last.src : FILL[fill % FILL.length]})` }}
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

      {/* Widescreen bars over the photographs; they open for the title. */}
      <div className="mci-bars is-top" aria-hidden />
      <div className="mci-bars is-bottom" aria-hidden />
      <div className="mci-reel-grain" aria-hidden />
      <div className="mci-reel-vignette" aria-hidden />
      <div className="mci-reel-bar" aria-hidden>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      {cut.music && sound !== "idle" && phase !== "exit" && (
        <button
          type="button"
          className={"mci-reel-skip mci-reel-sound is-" + sound}
          aria-pressed={sound === "on"}
          onClick={(e) => {
            e.stopPropagation();
            toggleSound();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden width="14" height="14">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {sound === "on" ? (
              <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
          {sound === "blocked" ? "Play with sound" : sound === "on" ? "Sound on" : "Sound off"}
        </button>
      )}
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
  const m = f.move ?? [1.09, 0, 0, 1.01, 0, 0];
  return (
    <div
      className={
        "mci-page era-" + f.era + (under ? " is-under" : "") + (f.trio ? " is-trio" : "") +
        (f.develop ? " is-develop" : "")
      }
      style={
        {
          "--hold": f.hold + "ms",
          "--focus": f.focus ?? "center",
          "--focus-m": f.phoneFocus ?? f.focus ?? "center",
          ...(f.zoomMs ? { "--zoom": f.zoomMs + "ms" } : {}),
          ...(f.phoneWide
            ? {
                "--pw-h": f.phoneWide.h,
                "--pw-ar": f.phoneWide.ar,
                "--pw-fx": f.phoneWide.fx,
                "--pw-fy": f.phoneWide.fy,
                "--pw-tx": f.phoneWide.tx,
                "--pw-ty": f.phoneWide.ty,
              }
            : {}),
          "--fs": m[0],
          "--fx": m[1] + "%",
          "--fy": m[2] + "%",
          "--ts": m[3],
          "--tx": m[4] + "%",
          "--ty": m[5] + "%",
        } as CSSProperties
      }
    >
      {(f.fit || f.phoneFit || f.phoneWide) && (
        <div
          className={"mci-page-fill" + (f.fit ? "" : " is-phone")}
          style={{ backgroundImage: `url(${f.src})` }}
        />
      )}
      {f.trio ? (
        f.trio.map((p) => (
          <div className="mci-panel" key={p.src} style={{ "--focus": p.focus ?? "center" } as CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt="" />
          </div>
        ))
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={f.src}
          alt=""
          className={f.fit ? "is-fit" : f.phoneFit ? "is-phone-fit" : f.phoneWide ? "is-phone-wide" : undefined}
        />
      )}
    </div>
  );
}

/**
 * The photographs as frames on a strip of 35mm film. Moving to frame i: the
 * camera eases back, the strip slides left, the camera eases back in. The
 * first frame is pushed into from the strip; the last is pushed into for the
 * title.
 */
function FilmReel({ frames, i, look }: { frames: Frame[]; i: number; look: ReelLook }) {
  const cam = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const prev = useRef(-1);
  // The strip: for the whip, the frames it races past sit between 1929 and 2027.
  const turn = frames.findIndex((f) => f.era === "today");
  const strip = look.whip ? [...frames.slice(0, turn), ...WHIP_PAST, ...frames.slice(turn)] : frames;
  const slot = (k: number) => (look.whip && k >= turn ? k + WHIP_PAST.length : k);

  useEffect(() => {
    const c = cam.current;
    const t = track.current;
    if (!c || !t) return;
    const from = prev.current;
    prev.current = i;
    const x = (k: number) => `translateX(calc(${-slot(k)} * var(--pitch)))`;
    const out = look.out;
    if (from < 0) {
      // Open: fade up on the strip, pulled back, and push into the first frame.
      t.style.transform = x(i);
      c.animate(
        [
          { transform: `scale(${out * 0.96})`, opacity: 0, easing: "ease-out" },
          { transform: `scale(${out * 0.97})`, opacity: 1, offset: 0.3, easing: "cubic-bezier(.5,0,.2,1)" },
          { transform: "scale(1)", opacity: 1 },
        ],
        { duration: 1100, fill: "forwards" },
      );
      return;
    }
    const whip = look.whip && i === turn;
    const dur = whip ? 1000 : 760;
    // Out, across, in — the three overlap so it never stops moving.
    c.animate(
      [
        { transform: "scale(1)", easing: "cubic-bezier(.45,0,.55,1)" },
        { transform: `scale(${out})`, offset: whip ? 0.25 : 0.32, easing: "linear" },
        { transform: `scale(${out})`, offset: whip ? 0.72 : 0.62, easing: "cubic-bezier(.45,0,.3,1)" },
        { transform: "scale(1)" },
      ],
      { duration: dur, fill: "forwards" },
    );
    t.animate(
      [
        { transform: x(from) },
        {
          transform: x(from),
          offset: whip ? 0.16 : 0.18,
          easing: whip ? "cubic-bezier(.75,0,.25,1)" : "cubic-bezier(.6,0,.35,1)",
        },
        { transform: x(i), offset: whip ? 0.82 : 0.86 },
        { transform: x(i) },
      ],
      { duration: dur, fill: "forwards" },
    );
    if (whip) {
      t.animate(
        [{ filter: "blur(0)" }, { filter: "blur(9px)", offset: 0.5 }, { filter: "blur(0)", offset: 0.8 }, { filter: "blur(0)" }],
        { duration: dur },
      );
    }
    // The last frame: push in, ready for the title.
    if (i === frames.length - 1) {
      c.animate([{ transform: "scale(1)" }, { transform: "scale(1.05)" }], {
        duration: 500,
        delay: dur,
        easing: "cubic-bezier(.4,0,.2,1)",
        fill: "forwards",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  return (
    <div className="mci-cam" ref={cam}>
      <div className="mci-strip" ref={track}>
        {strip.map((f, k) => (
          <div className={"mci-strip-frame era-" + f.era} key={k}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt="" style={{ objectPosition: f.focus ?? "center" }} />
            <span className="mci-strip-edge">{`PASATIEMPO  ${f.era === "today" ? EVENT.year : FOUNDED}  ▸ ${k + 1}A`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The whole screen as a strip of film, panned along: each frame reaches the
 * centre of the screen as its hold runs out. Horizontal on a wide screen;
 * vertical, as through a projector, on a tall one. One animation from first
 * frame to last, then a slow drift on under the title.
 */
function FilmPan({
  frames,
  step,
  glide,
  tail,
  tailMs,
}: {
  frames: Frame[];
  step: boolean;
  glide: boolean;
  tail: Frame[];
  tailMs: number;
}) {
  const track = useRef<HTMLDivElement>(null);
  const strip = [...frames, ...tail];
  const [vertical] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth * 1.1);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    // Where the track must sit to put frame k at the centre of the screen.
    const cells = Array.from(t.children) as HTMLElement[];
    const at = (k: number) => {
      const r = cells[k].getBoundingClientRect();
      return vertical ? innerHeight / 2 - (r.top + r.height / 2) : innerWidth / 2 - (r.left + r.width / 2);
    };
    const move = (px: number) => (vertical ? `translate3d(0,${px}px,0)` : `translate3d(${px}px,0,0)`);
    const pitch = at(0) - at(1);
    const run = frames.reduce((n, f) => n + f.hold, 0);
    const total = run + tailMs;
    // Start half a frame early, so the first one slides into the centre. (The
    // glide starts a whole frame early, already at its one steady speed.)
    const keys: Keyframe[] = [{ transform: move(at(0) + pitch * (glide ? 1 : 0.55)), offset: 0 }];
    let clock = 0;
    frames.forEach((f, k) => {
      clock += f.hold;
      keys.push({ transform: move(at(k)), offset: clock / total });
    });
    // Under the title: on along the strip, slowly. The glide carries its speed
    // into this and eases to rest exactly one frame on.
    keys.push({ transform: move(at(frames.length - 1) - pitch * (glide ? 1 : 0.9)), offset: 1 });
    const ease = step ? "cubic-bezier(.62,0,.38,1)" : "linear";
    // For the glide, the curve's opening slope matches the speed it arrives at.
    const lastHold = frames[frames.length - 1].hold;
    const rest = `cubic-bezier(.3,${Math.min(1, (0.3 * tailMs) / lastHold).toFixed(3)},.5,1)`;
    keys.forEach((k, n) => {
      if (n < keys.length - 2) k.easing = n === 0 && !glide ? "cubic-bezier(.3,0,.6,1)" : ease;
      else if (n === keys.length - 2) k.easing = glide ? rest : "cubic-bezier(.2,.4,.4,1)";
    });
    const anim = t.animate(keys, { duration: total, fill: "forwards" });
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={"mci-pan" + (vertical ? " is-v" : "")}>
      <div className="mci-pan-track" ref={track}>
        {strip.map((f, k) => (
          <div className={"mci-pan-frame era-" + f.era} key={k}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt="" style={{ objectPosition: f.focus ?? "center" }} />
            <span className="mci-pan-edge">{`PASATIEMPO  ${f.era === "today" ? EVENT.year : FOUNDED}  ▸ ${k + 1}A`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
