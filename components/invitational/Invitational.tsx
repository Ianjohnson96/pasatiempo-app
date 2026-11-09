"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  COMMITTEE,
  CONTACTS,
  EVENT,
  FIELD,
  FLIGHTS,
  FORMAT,
  INFO,
  PRIZES,
  SCHEDULE,
  TABS,
  WAGERING,
  isPosted,
  isTab,
  type Copy,
  type TabKey,
  type TabMeta,
} from "./content";
import { Icon } from "./icons";
import IntroReel, { INTRO_GATE, allowReplay } from "./IntroReel";

// Men's Club Invitational — the public event page. Same family as El Sombrero
// (serif, cream and gold, tabbed), with its own navy identity. All the words
// come from content.ts; this file is layout and motion only.
//
// Motion, all switched off under prefers-reduced-motion:
//   - hero: slow Ken Burns on the photo, the title rising in letter by letter
//   - nav: a gold underline that slides to the selected tab
//   - tabs: each view rises in, its photo settles from a slight zoom
//   - scroll: sections reveal as they arrive, photos drift (parallax), the
//     course numbers count up

const IMG = "/invitational/img/";
const VID = "/invitational/video/";
const tabMeta = (k: TabKey) => TABS.find((t) => t.key === k)!;
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function Invitational() {
  const [tab, setTab] = useState<TabKey>("home");
  const [scrolled, setScrolled] = useState(false);
  // The opening reel: "on" while it plays (the hero waits), "revealing" as it
  // lifts (the hero starts), "done" once it's gone. IntroReel itself decides
  // on mount whether this visit gets it at all.
  const [intro, setIntro] = useState<"on" | "revealing" | "done">("on");
  const rootRef = useRef<HTMLDivElement>(null);

  // Follow the address bar: #schedule opens the Schedule tab, Back works.
  useEffect(() => {
    const read = () => {
      const h = location.hash.slice(1);
      setTab(isTab(h) ? h : "home");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const go = useCallback((next: TabKey) => {
    if (location.hash !== "#" + next) history.pushState(null, "", "#" + next);
    setTab(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const m = tabMeta(tab);
    document.title =
      (tab === "home" ? `${EVENT.name} ${EVENT.year}` : `${m.label} — ${EVENT.name}`) +
      " · Pasatiempo";
  }, [tab]);

  // Header tightens once the page scrolls.
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Turn motion on only once JS is running, so nothing is ever hidden for a
  // visitor whose script didn't load.
  useEffect(() => {
    if (!prefersReducedMotion()) rootRef.current?.classList.add("mci-motion");
  }, []);

  // Reveal-on-scroll and parallax, re-armed for each tab's fresh view.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
    let frame = 0;
    const paint = () => {
      frame = 0;
      const vh = window.innerHeight;
      for (const el of layers) {
        const box = el.parentElement!.getBoundingClientRect();
        if (box.bottom < -100 || box.top > vh + 100) continue;
        const speed = Number(el.dataset.parallax) || 0.12;
        // Never drift further than the photo's overscan (inset in the CSS),
        // or the band's edge shows through.
        const room = box.height * 0.16;
        const offset = Math.max(-room, Math.min(room, (box.top + box.height / 2 - vh / 2) * -speed));
        el.style.setProperty("--py", offset.toFixed(1) + "px");
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [tab]);

  return (
    <div className={"mci" + (intro === "on" ? " mci-intro-on" : "")} ref={rootRef}>
      {/* Before first paint: skip the reel for returning visitors, deep links
          and reduced motion, so it never flashes up. */}
      <script dangerouslySetInnerHTML={{ __html: INTRO_GATE }} />
      {intro !== "done" && (
        <IntroReel
          onReveal={() => setIntro((s) => (s === "on" ? "revealing" : s))}
          onDone={() => setIntro("done")}
        />
      )}
      <Header tab={tab} go={go} scrolled={scrolled} />
      <main>
        {/* Keyed so each tab mounts fresh and plays its entrance. */}
        <div
          key={tab}
          className="mci-view"
          role="tabpanel"
          id={"panel-" + tab}
          aria-labelledby={"tab-" + tab}
        >
          {tab === "home" ? <Home go={go} /> : <TabView meta={tabMeta(tab)} />}
        </div>
      </main>
      <Footer
        onReplay={() => {
          allowReplay();
          go("home");
          setIntro("on");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header + sliding tab indicator
// ---------------------------------------------------------------------------

function Header({
  tab,
  go,
  scrolled,
}: {
  tab: TabKey;
  go: (t: TabKey) => void;
  scrolled: boolean;
}) {
  const navRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  const place = useCallback(() => {
    const nav = navRef.current;
    const bar = barRef.current;
    const btn = nav?.querySelector<HTMLElement>(`[data-key="${tab}"]`);
    if (!nav || !bar || !btn) return;
    bar.style.setProperty("--x", btn.offsetLeft + "px");
    bar.style.setProperty("--w", btn.offsetWidth + "px");
    bar.dataset.ready = "1";
    // On a phone the tab row scrolls; keep the chosen tab in view.
    const left = btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [tab]);

  useLayoutEffect(() => {
    place();
  }, [place, scrolled]);

  useEffect(() => {
    window.addEventListener("resize", place);
    // Webfont swap changes the button widths.
    document.fonts?.ready.then(place).catch(() => {});
    return () => window.removeEventListener("resize", place);
  }, [place]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.key === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    go(next.key);
    navRef.current?.querySelector<HTMLElement>(`[data-key="${next.key}"]`)?.focus();
  };

  return (
    <header className={"mci-header" + (scrolled ? " is-scrolled" : "")}>
      <div className="mci-brandbar">
        <button
          className="mci-brand"
          onClick={() => go("home")}
          aria-label={`${EVENT.name} — Home`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" width={40} height={40} />
          <span>
            <span className="mci-bt1">The Invitational</span>
            <span className="mci-bt2">Pasatiempo Men&rsquo;s Club &middot; {EVENT.year}</span>
          </span>
        </button>
        <div
          className="mci-tabs"
          role="tablist"
          aria-label="Sections"
          ref={navRef}
          onKeyDown={onKey}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              data-key={t.key}
              id={"tab-" + t.key}
              role="tab"
              aria-selected={t.key === tab}
              aria-controls={"panel-" + t.key}
              tabIndex={t.key === tab ? 0 : -1}
              onClick={() => go(t.key)}
            >
              {t.label}
            </button>
          ))}
          <span className="mci-tabbar" ref={barRef} aria-hidden />
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function Home({ go }: { go: (t: TabKey) => void }) {
  const word = "Invitational";
  const hero = useFilmReel(HERO_FILMS.length);
  return (
    <>
      <section className="mci-hero">
        <div className="mci-hero-bg" data-parallax="0.18">
          {/* The course films, one after another, crossfading. */}
          {HERO_FILMS.map((f, k) => (
            <video
              key={f.src}
              ref={hero.setRef(k)}
              className={"mci-hero-film" + (k === hero.index ? " is-on" : "")}
              src={f.src}
              poster={f.poster}
              muted
              playsInline
              loop={HERO_FILMS.length === 1}
              preload={k === 0 ? "auto" : "none"}
              disablePictureInPicture
              aria-hidden
              onEnded={hero.next}
            />
          ))}
        </div>
        <div className="mci-hero-veil" />
        <div className="mci-hero-sheen" aria-hidden />
        <div className="mci-hero-inner">
          <div className="mci-eyebrow mci-rise" style={stagger(0)}>
            Pasatiempo Men&rsquo;s Club &middot; {EVENT.year}
          </div>
          <div className="mci-hero-pre mci-rise" style={stagger(1)}>
            The Men&rsquo;s Club
          </div>
          <h1 aria-label={word}>
            {word.split("").map((ch, i) => (
              <span key={i} className="mci-letter" style={stagger(i)} aria-hidden>
                {ch}
              </span>
            ))}
          </h1>
          <div className="mci-hero-rule" aria-hidden />
          {EVENT.tagline && (
            <div className="mci-tagline mci-rise" style={stagger(5)}>
              {EVENT.tagline}
            </div>
          )}
          <div className="mci-dates mci-rise" style={stagger(6)}>
            <span>{EVENT.datesLabel ?? "Dates to be announced"}</span>
          </div>
        </div>
        <button
          className="mci-scrollcue"
          aria-label="Scroll down"
          onClick={() =>
            document.getElementById("mci-intro")?.scrollIntoView({
              behavior: prefersReducedMotion() ? "auto" : "smooth",
            })
          }
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M12 4v14M6 12l6 6 6-6" />
          </svg>
        </button>
        <FilmToggle paused={hero.paused} toggle={hero.toggle} label="the course films" />
      </section>

      <section className="mci-block" id="mci-intro">
        <div className="mci-wrap mci-narrow mci-center">
          <div className="mci-orn" data-reveal>
            <span className="mci-eyebrow">The Men&rsquo;s Club Invitational</span>
          </div>
          <p className="mci-lead" data-reveal style={stagger(1)}>
            {`The Invitational returns to Alister MacKenzie’s Pasatiempo. The schedule, flights and format for ${EVENT.year} are being set now — everything will be posted here as it’s confirmed.`}
          </p>
        </div>
      </section>

      <section className="mci-block mci-tight">
        <div className="mci-wrap">
          <div className="mci-facts" data-reveal>
            <Fact k="Dates" v={EVENT.datesLabel} />
            <Fact k="Format" v={EVENT.format} />
            <Fact k="The Field" v={FIELD.length ? `${FIELD.length} teams` : null} />
            <Fact k="Entry Deadline" v={EVENT.entryDeadline} />
          </div>
        </div>
      </section>

      <section className="mci-block mci-tight">
        <div className="mci-wrap">
          <Countdown />
        </div>
      </section>

      <PhotoBand
        photo={IMG + "clubhouse.avif"}
        focus="center 55%"
        quote="Pasatiempo — Spanish for “pastime.” Marion Hollins named it, MacKenzie built it, and the Men’s Club still plays it for keeps."
        attribution={`${EVENT.name} · Pasatiempo Golf Club`}
      />

      <section className="mci-block">
        <div className="mci-wrap">
          <div className="mci-center">
            <div className="mci-orn" data-reveal>
              <span className="mci-eyebrow">Since 1929</span>
            </div>
            <h3 data-reveal style={stagger(1)}>
              MacKenzie&rsquo;s Masterpiece
            </h3>
            <p className="mci-lead mci-center" data-reveal style={stagger(2)}>
              Bold greens, sprawling sand and a closing stretch that asks for
              every bit of nerve &mdash; the course the Doctor made his home.
            </p>
          </div>
          <div className="mci-gallery">
            <Photo src={IMG + "course-green.jpg"} alt="Restored MacKenzie bunkers around a Pasatiempo green" cap="MacKenzie's bunkering, restored to its original scale" i={0} />
            <Photo src={IMG + "today-chairs-bay.jpg"} alt="Two chairs looking out over the course to Monterey Bay" cap="Looking out over the course to the bay" i={1} tall />
            <Photo src={IMG + "course-bunkers.jpg"} alt="Cascading MacKenzie bunkers at Pasatiempo" cap="Cascading sand — a MacKenzie signature" i={2} />
          </div>
          <div className="mci-numbers" data-reveal>
            <Num n={1929} from={1900} label="Opened" sub="September 8th" />
            <Num n={18} from={0} label="MacKenzie Holes" sub="His California home course" />
            <Num n={6} from={0} suffix="th" label="The Doctor's Fairway" sub="Where he lived until 1934" />
            <Num n={16} from={0} suffix="th" label="The Famous One" sub="Among the world's great par-4s" />
          </div>
        </div>
      </section>

      <ArchiveStrip />

      <PhotoBand
        photo={IMG + "today-aerial-dawn.jpg"}
        focus="center 45%"
        tall
        quote="The chief object of every golf course architect worth his salt is to imitate the beauties of nature so closely as to make his work indistinguishable from nature itself."
        attribution="Dr. Alister MacKenzie · Golf Architecture, 1920"
      />

      <section className="mci-block">
        <div className="mci-wrap mci-center">
          <div className="mci-eyebrow" data-reveal>
            Find Your Way Around
          </div>
          <h3 data-reveal style={stagger(1)}>
            The Invitational, Section by Section
          </h3>
          <div className="mci-cards">
            {TABS.filter((t) => t.key !== "home").map((t, i) => (
              <button
                key={t.key}
                className="mci-card"
                onClick={() => go(t.key)}
                data-reveal
                style={stagger(i)}
              >
                <span className="mci-card-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.photo} alt="" loading="lazy" style={{ objectPosition: t.focus }} />
                </span>
                <span className="mci-card-body">
                  <span className="mci-card-top">
                    <span className="mci-card-icon">
                      <Icon name={t.key} />
                    </span>
                    <StatusChip posted={isPosted(t.key)} />
                  </span>
                  <span className="mci-card-title">{t.label}</span>
                  <span className="mci-card-blurb">{t.blurb}</span>
                  <span className="mci-card-go" aria-hidden>
                    Open
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function Fact({ k, v }: { k: string; v: string | null }) {
  return (
    <div>
      <div className="mci-fk">{k}</div>
      <div className={"mci-fv" + (v ? "" : " is-tba")}>{v ?? "TBA"}</div>
    </div>
  );
}

function StatusChip({ posted }: { posted: boolean }) {
  return posted ? (
    <span className="mci-chip is-posted">Posted</span>
  ) : (
    <span className="mci-chip">
      <span className="mci-pulse" aria-hidden />
      Coming soon
    </span>
  );
}

/** The club's early photographs, on a strip of film you can scroll through. */
const ARCHIVE = [
  { src: "archive-1929-tee-shot-bay.jpg", alt: "A crowd lines a tee at Pasatiempo, Monterey Bay beyond", cap: "A crowd lines the tee, the bay beyond", focus: "center 70%" },
  { src: "archive-1929-opening-foursome.jpg", alt: "Two men and two women stand on a tee before a large gallery", cap: "Players and gallery on the first tee", focus: "center 20%" },
  { src: "archive-1929-gallery-oak.jpg", alt: "A gallery circles a green, framed by an oak", cap: "The gallery circles a green, framed by the oaks", focus: "center 60%" },
  { src: "archive-1929-bunkered-green.jpg", alt: "Spectators walk past deep, sprawling bunkers to a green", cap: "MacKenzie's bunkering, new-cut", focus: "center 60%" },
  { src: "archive-1929-golfer-oak.jpg", alt: "A lone golfer plays beneath the oaks", cap: "A lone golfer beneath the oaks", focus: "center 70%" },
  { src: "archive-mackenzie-house-1933.jpg", alt: "Dr. Alister MacKenzie's house beside the course, 1933", cap: "Dr. MacKenzie's house on the course, 1933", focus: "center 70%" },
];

function ArchiveStrip() {
  const strip = useRef<HTMLDivElement>(null);
  const step = (dir: 1 | -1) => {
    const el = strip.current;
    if (!el) return;
    const frame = el.querySelector<HTMLElement>(".mci-film-frame");
    el.scrollBy({
      left: dir * ((frame?.offsetWidth ?? 400) + 18),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };
  return (
    <section className="mci-archive">
      <div className="mci-wrap mci-center">
        <div className="mci-orn mci-orn-dark" data-reveal>
          <span className="mci-eyebrow">From the Club Archive</span>
        </div>
        <h3 data-reveal style={stagger(1)}>
          The Early Years
        </h3>
        <p className="mci-lead mci-center" data-reveal style={stagger(2)}>
          Galleries round MacKenzie&rsquo;s new greens, the Doctor&rsquo;s own house on the
          course &mdash; Pasatiempo as it first was.
        </p>
      </div>
      <div className="mci-film" data-reveal style={stagger(3)}>
        <div className="mci-film-track" ref={strip} tabIndex={0} aria-label="Archive photographs — scroll sideways">
          {ARCHIVE.map((a) => (
            <figure className="mci-film-frame" key={a.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG + a.src} alt={a.alt} loading="lazy" style={{ objectPosition: a.focus }} />
              <figcaption>{a.cap}</figcaption>
            </figure>
          ))}
        </div>
        <button type="button" className="mci-film-btn is-prev" onClick={() => step(-1)} aria-label="Previous photograph">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <button type="button" className="mci-film-btn is-next" onClick={() => step(1)} aria-label="Next photograph">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}

function Photo({
  src,
  alt,
  cap,
  i,
  tall,
}: {
  src: string;
  alt: string;
  cap: string;
  i: number;
  tall?: boolean;
}) {
  return (
    <figure className={"mci-photo" + (tall ? " is-tall" : "")} data-reveal style={stagger(i)}>
      <div className="mci-photo-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" />
      </div>
      <figcaption>{cap}</figcaption>
    </figure>
  );
}

function PhotoBand({
  photo,
  video,
  focus,
  quote,
  attribution,
  tall,
}: {
  photo: string;
  /** A looping course film instead of the still (the still becomes its poster). */
  video?: string;
  focus: string;
  quote: string;
  attribution: string;
  tall?: boolean;
}) {
  const { ref: filmRef, paused, toggle } = useFilm();
  return (
    <div className={"mci-quote" + (tall ? " is-tall" : "")}>
      <div className="mci-quote-bg" data-parallax="0.16">
        {video ? (
          <LoopVideo videoRef={filmRef} src={video} poster={photo} focus={focus} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" style={{ objectPosition: focus }} />
        )}
      </div>
      <div className="mci-quote-veil" />
      <div className="mci-quote-inner">
        <div className="mci-q" data-reveal>
          &ldquo;{quote}&rdquo;
        </div>
        <div className="mci-qa" data-reveal style={stagger(2)}>
          {attribution}
        </div>
      </div>
      {video && <FilmToggle paused={paused} toggle={toggle} label="the course film" />}
    </div>
  );
}

/**
 * A silent, looping course film. It plays only while it's on screen (and
 * doesn't download until it's near, unless `eager`), keeps its still for
 * visitors who ask for reduced motion, and comes with a pause button —
 * moving background video needs one. The state lives in a hook so the film
 * can sit in a parallax layer while its button stays put in the section.
 */
/** The home page's hero films, played in order and looped. */
const HERO_FILMS = [
  // Up the 8th under the cypresses to the green.
  { src: VID + "hole-8-approach.mp4", poster: IMG + "hole-8-approach-poster.jpg" },
  // Over the bunkers to the 4th green, the clubhouse beyond.
  { src: VID + "hole-4-approach.mp4", poster: IMG + "hole-4-approach-poster.jpg" },
  // Down the barranca, over the bridge, to the 11th.
  { src: VID + "hole-11-approach.mp4", poster: IMG + "hole-11-approach-poster.jpg" },
];

/**
 * A run of course films: each plays once and crossfades into the next, and
 * the run loops. Only the first loads up front; each next film starts
 * loading while the one before it plays. Plays only while on screen, keeps
 * the first still for visitors who ask for reduced motion, and pauses on
 * request.
 */
function useFilmReel(count: number) {
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);
  const visible = useRef(false);
  const still = useRef(false);
  const indexRef = useRef(0);

  const setRef = useCallback(
    (k: number) => (el: HTMLVideoElement | null) => {
      vids.current[k] = el;
    },
    [],
  );

  const playCurrent = useCallback((k: number) => {
    const v = vids.current[k];
    if (!v || still.current || userPaused.current || !visible.current) return;
    v.muted = true;
    v.play().catch(() => {});
    // Warm up the next film while this one plays.
    const nxt = vids.current[(k + 1) % vids.current.length];
    if (nxt && nxt !== v && nxt.preload === "none") nxt.preload = "auto";
  }, []);

  // Watch the first film's box: the whole run plays only while it's on screen.
  useEffect(() => {
    still.current = prefersReducedMotion();
    const first = vids.current[0];
    if (!first || still.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        const cur = vids.current[indexRef.current];
        if (e.isIntersecting) playCurrent(indexRef.current);
        else cur?.pause();
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(first);
    return () => io.disconnect();
  }, [playCurrent]);

  // A new film comes up: rewind and play it; the others rest at their start.
  useEffect(() => {
    indexRef.current = index;
    vids.current.forEach((v, k) => {
      if (!v || k === index) return;
      // Let the outgoing film hold its last frame while it fades, then rewind.
      setTimeout(() => {
        if (indexRef.current !== k) {
          v.pause();
          v.currentTime = 0;
        }
      }, 1300);
    });
    playCurrent(index);
  }, [index, playCurrent]);

  const next = useCallback(() => {
    if (count > 1) setIndex((k) => (k + 1) % count);
  }, [count]);

  const toggle = () => {
    const v = vids.current[indexRef.current];
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      playCurrent(indexRef.current);
      setPaused(false);
    } else {
      userPaused.current = true;
      v.pause();
      setPaused(true);
    }
  };

  return { index, paused, setRef, next, toggle };
}

function useFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || prefersReducedMotion()) return;
    v.muted = true;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !userPaused.current) {
          if (v.preload === "none") v.preload = "auto";
          v.play().catch(() => {});
        } else if (!e.isIntersecting) {
          v.pause();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
      setPaused(false);
    } else {
      userPaused.current = true;
      v.pause();
      setPaused(true);
    }
  };
  return { ref, paused, toggle };
}

function LoopVideo({
  videoRef,
  src,
  poster,
  focus = "center",
  eager,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  poster: string;
  focus?: string;
  eager?: boolean;
}) {
  return (
    <video
      ref={videoRef}
      className="mci-loop"
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload={eager ? "auto" : "none"}
      disablePictureInPicture
      aria-hidden
      style={{ objectPosition: focus }}
    />
  );
}

function FilmToggle({ paused, toggle, label }: { paused: boolean; toggle: () => void; label: string }) {
  return (
    <button
      type="button"
      className="mci-loop-toggle"
      onClick={toggle}
      aria-label={(paused ? "Play " : "Pause ") + label}
    >
      {paused ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7 4v16l13-8z" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
        </svg>
      )}
    </button>
  );
}

/** Counts up to n the first time it scrolls into view. */
function Num({
  n,
  from,
  suffix = "",
  label,
  sub,
}: {
  n: number;
  from: number;
  suffix?: string;
  label: string;
  sub: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(n);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1400;
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(Math.round(from + (n - from) * eased));
          if (t < 1) raf = requestAnimationFrame(step);
        };
        setShown(from);
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [n, from]);

  return (
    <div ref={ref}>
      <div className="mci-num">
        {shown}
        {suffix && <sup>{suffix}</sup>}
      </div>
      <div className="mci-num-l">{label}</div>
      <div className="mci-num-s">{sub}</div>
    </div>
  );
}

/** Ticks down to EVENT.startDate; a save-the-date card until it's set. */
function Countdown() {
  const target = EVENT.startDate ? new Date(EVENT.startDate + "T07:00:00").getTime() : null;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [target]);

  if (!target) {
    return (
      <div className="mci-savedate" data-reveal>
        <div className="mci-savedate-icon">
          <Icon name="schedule" size={28} />
        </div>
        <div>
          <div className="mci-eyebrow">Save the Date</div>
          <div className="mci-savedate-title">The {EVENT.year} dates are coming soon</div>
          <p>
            The committee is setting the dates now. They&rsquo;ll appear here
            &mdash; with a countdown to the first tee &mdash; the moment they&rsquo;re announced.
          </p>
        </div>
      </div>
    );
  }

  const left = Math.max(0, target - (now ?? target));
  const parts = [
    { v: Math.floor(left / 86_400_000), l: "Days" },
    { v: Math.floor(left / 3_600_000) % 24, l: "Hours" },
    { v: Math.floor(left / 60_000) % 60, l: "Minutes" },
    { v: Math.floor(left / 1000) % 60, l: "Seconds" },
  ];
  return (
    <div className="mci-countdown" data-reveal>
      <div className="mci-eyebrow">Until the First Tee</div>
      <div className="mci-count">
        {parts.map((p) => (
          <div key={p.l}>
            <span className="mci-count-v">{now === null ? "–" : String(p.v).padStart(2, "0")}</span>
            <span className="mci-count-l">{p.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The other tabs
// ---------------------------------------------------------------------------

function TabView({ meta }: { meta: TabMeta }) {
  return (
    <>
      <div className="mci-band">
        <div className="mci-band-bg" data-parallax="0.1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.photo} alt="" style={{ objectPosition: meta.focus }} />
        </div>
        <div className="mci-band-veil" />
        <div className="mci-band-inner">
          <div className="mci-eyebrow mci-rise" style={stagger(0)}>
            {meta.eyebrow}
          </div>
          <h2 className="mci-rise" style={stagger(1)}>
            {meta.title}
          </h2>
          <div className="mci-band-rule" aria-hidden />
        </div>
      </div>
      <section className="mci-block">
        <div className="mci-wrap">
          <TabBody meta={meta} />
        </div>
      </section>
    </>
  );
}

function TabBody({ meta }: { meta: TabMeta }) {
  switch (meta.key) {
    case "schedule":
      return SCHEDULE.length ? <Schedule /> : <ComingSoon meta={meta} ghost="schedule" />;
    case "flights":
      return FLIGHTS.length ? <Flights /> : <ComingSoon meta={meta} ghost="table" />;
    case "format":
      return FORMAT.length ? <CopyBlocks blocks={FORMAT} /> : <ComingSoon meta={meta} />;
    case "field":
      return FIELD.length ? <Field /> : <ComingSoon meta={meta} ghost="cards" />;
    case "wagering":
      return WAGERING.length ? <CopyBlocks blocks={WAGERING} /> : <ComingSoon meta={meta} />;
    case "prizes":
      return PRIZES.length ? <Prizes /> : <ComingSoon meta={meta} />;
    case "info":
      return <Info />;
    default:
      return null;
  }
}

/** What an empty tab shows: what's coming, over a faint outline of its shape. */
function ComingSoon({ meta, ghost }: { meta: TabMeta; ghost?: "schedule" | "table" | "cards" }) {
  return (
    <div className="mci-soon-wrap">
      {ghost && <Ghost kind={ghost} />}
      <div className="mci-soon" data-reveal>
        <span className="mci-chip">
          <span className="mci-pulse" aria-hidden />
          Coming soon
        </span>
        <div className="mci-soon-icon">
          <Icon name={meta.key} size={30} />
        </div>
        <div className="mci-soon-title">Not posted yet</div>
        <p>{`${meta.blurb} It’ll all be here as soon as the committee confirms it.`}</p>
        {meta.coming.length > 0 && (
          <ul className="mci-soon-list">
            {meta.coming.map((c, i) => (
              <li key={c} data-reveal style={stagger(i + 2)}>
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Ghost({ kind }: { kind: "schedule" | "table" | "cards" }) {
  const rows = (n: number, cls: string) =>
    Array.from({ length: n }, (_, i) => <span key={i} className={cls} style={stagger(i)} />);
  return (
    <div className={"mci-ghost is-" + kind} aria-hidden>
      {kind === "schedule" &&
        [0, 1].map((d) => (
          <div key={d} className="mci-ghost-day">
            <span className="mci-ghost-h" />
            <div>{rows(4, "mci-ghost-row")}</div>
          </div>
        ))}
      {kind === "table" && <div>{rows(7, "mci-ghost-row")}</div>}
      {kind === "cards" && <div className="mci-ghost-grid">{rows(6, "mci-ghost-card")}</div>}
    </div>
  );
}

function Schedule() {
  return (
    <div className="mci-panel">
      {SCHEDULE.map((d, di) => (
        <div className="mci-day" key={d.day + d.date} data-reveal style={stagger(di)}>
          <div className="mci-day-h">
            <div className="mci-dn">{d.day}</div>
            <div className="mci-dd">{d.date}</div>
            {d.tag && <div className="mci-dtag">{d.tag}</div>}
          </div>
          <div>
            {d.items.map((e) => (
              <div className="mci-evt" key={e.time + e.title}>
                <div className="mci-evt-t">{e.time}</div>
                <div>
                  <strong>{e.title}</strong>
                  {e.note && <div className="mci-sub">{e.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Flights() {
  return (
    <div className="mci-stack">
      {FLIGHTS.map((f, fi) => (
        <div className="mci-panel" key={f.name} data-reveal style={stagger(fi)}>
          <h3>{f.name}</h3>
          <div className="mci-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th className="num">Hcp</th>
                </tr>
              </thead>
              <tbody>
                {f.teams.map((t) => (
                  <tr key={t.players.join("/")}>
                    <td>
                      {t.players.join(" / ")}
                      {t.note && <div className="mci-sub">{t.note}</div>}
                    </td>
                    <td className="num">{t.hcp ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {f.pairings && f.pairings.length > 0 && (
            <>
              <h4>Pairings</h4>
              <div className="mci-tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Start</th>
                      <th>Teams</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.pairings.map((p) => (
                      <tr key={p.time + (p.hole ?? "") + p.teams.join()}>
                        <td className="mci-evt-t">{p.time}</td>
                        <td>{p.hole ?? ""}</td>
                        <td>{p.teams.join(" vs. ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Field() {
  return (
    <>
      <p className="mci-lead">{FIELD.length} teams entered.</p>
      <div className="mci-field">
        {FIELD.map((t, i) => (
          <div className="mci-team" key={t.players.join("/")} data-reveal style={stagger(i % 9)}>
            <div className="mci-team-n">{String(i + 1).padStart(2, "0")}</div>
            <div>
              {t.players.map((p) => (
                <div key={p} className="mci-team-p">
                  {p}
                </div>
              ))}
              {(t.hcp || t.note) && (
                <div className="mci-sub">{[t.hcp && `Hcp ${t.hcp}`, t.note].filter(Boolean).join(" · ")}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function CopyBlocks({ blocks }: { blocks: Copy[] }) {
  return (
    <div className="mci-stack">
      {blocks.map((b, i) => (
        <div className="mci-panel" key={b.heading} data-reveal style={stagger(i)}>
          <h3>{b.heading}</h3>
          {b.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Prizes() {
  return (
    <div className="mci-grid2">
      {PRIZES.map((g, i) => (
        <div className="mci-panel" key={g.heading} data-reveal style={stagger(i)}>
          <h3>{g.heading}</h3>
          {g.prizes.map((p) => (
            <div className="mci-prize" key={p.name}>
              <span className={"mci-prize-nm" + (p.big ? " is-big" : "")}>{p.name}</span>
              <span className="mci-prize-aw">{p.award}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Info() {
  return (
    <>
      <div className="mci-info">
        {INFO.map((it, i) => (
          <div className={"mci-info-card" + (it.body.length ? "" : " is-empty")} key={it.heading} data-reveal style={stagger(i)}>
            <div className="mci-info-icon">
              <Icon name={it.icon} size={24} />
            </div>
            <h4>{it.heading}</h4>
            {it.body.length ? (
              it.body.map((p) => <p key={p}>{p}</p>)
            ) : (
              <p className="mci-tba-line">Details coming soon</p>
            )}
          </div>
        ))}
      </div>
      <div className="mci-panel mci-center mci-contact" data-reveal>
        <div className="mci-eyebrow">Questions?</div>
        <h3>Call the Golf Shop</h3>
        <div className="mci-contacts">
          {CONTACTS.map((c) => (
            <Contact key={c.name} {...c} />
          ))}
        </div>
      </div>
    </>
  );
}

function Contact({ name, role, phone }: { name: string; role: string; phone: string }) {
  return (
    <div>
      <div className="mci-cn">{name}</div>
      <div className="mci-cr">{role}</div>
      <a href={"tel:" + phone.replace(/[^\d+]/g, "")}>{phone}</a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({ onReplay }: { onReplay: () => void }): ReactNode {
  return (
    <footer className="mci-footer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mci-crest" src="/logo-full.png" alt="Pasatiempo Golf Club" loading="lazy" />
      <div className="mci-eyebrow">Questions? Contact Us</div>
      <div className="mci-contacts">
        {CONTACTS.map((c) => (
          <Contact key={c.name} {...c} />
        ))}
      </div>
      <div className="mci-orn mci-orn-dark">
        <span className="mci-eyebrow">Tournament Committee</span>
      </div>
      {COMMITTEE.length ? (
        <div className="mci-committee">
          {COMMITTEE.map((m) => (
            <div key={m.name}>
              <div className="mci-cn">{m.name}</div>
              <div className="mci-cr">{m.role}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mci-foot-tba">To be announced</p>
      )}
      <p className="mci-legacy">
        {`The ${EVENT.name} — Pasatiempo Golf Club · Santa Cruz, California`}
      </p>
      <button type="button" className="mci-replay" onClick={onReplay}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
        Play the intro
      </button>
    </footer>
  );
}
