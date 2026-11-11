"use client";

import { useEffect, useRef, useState } from "react";
import { EDITOR_SECTIONS, type EditorSectionId } from "@/lib/events/editor";

// Navigation and scroll-spy for the editor's sections, not a wizard: every
// section stays on the page. A vertical list at >= 960px, a chip row below.
export default function EditorSteps() {
  const [active, setActive] = useState<EditorSectionId>("details");
  const listRef = useRef<HTMLOListElement>(null);
  // while a click-scroll is running, don't let the observer flicker the list
  const locked = useRef(false);
  const unlockTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const ids = EDITOR_SECTIONS.map((s) => s.id);
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    // The current section is the last one whose top has passed a line 20% down
    // the screen, or the last section once the page can't scroll any further.
    const pick = () => {
      if (locked.current) return;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActive(ids[ids.length - 1]);
        return;
      }
      const line = window.innerHeight * 0.2;
      let current: EditorSectionId = ids[0];
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line)
          current = el.id as EditorSectionId;
      }
      setActive(current);
    };

    // The observer fires as a section crosses that line; the scroll listener
    // (one check per frame) catches reaching the bottom of the page.
    const io = new IntersectionObserver(pick, {
      rootMargin: "-20% 0px -80% 0px",
    });
    els.forEach((el) => io.observe(el));
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        pick();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      window.clearTimeout(unlockTimer.current);
    };
  }, []);

  // keep the active chip in view in the phone chip row (without moving the page)
  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>(`[data-step="${active}"]`);
    if (!list || !chip || list.scrollWidth <= list.clientWidth) return;
    const left = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
    list.scrollTo({ left, behavior: "smooth" });
  }, [active]);

  function go(e: React.MouseEvent, id: EditorSectionId) {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    setActive(id);
    locked.current = true;
    window.clearTimeout(unlockTimer.current);
    unlockTimer.current = window.setTimeout(() => {
      locked.current = false;
    }, 800);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }

  return (
    <nav className="editor-steps" aria-label="Editor sections">
      <ol ref={listRef}>
        {EDITOR_SECTIONS.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              data-step={s.id}
              className={active === s.id ? "on" : undefined}
              aria-current={active === s.id ? "location" : undefined}
              onClick={(e) => go(e, s.id)}
            >
              <span className="editor-step-num">{i + 1}</span>
              <span className="editor-step-label">{s.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
