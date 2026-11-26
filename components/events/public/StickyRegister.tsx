"use client";

import { useEffect, useState } from "react";
import type { Cta } from "@/lib/events/public-page";
import { CtaButton } from "./PublicHero";

// On phones, the main button follows the reader once the hero's button has
// scrolled away, and steps aside while the sign-up form itself is on screen.
// Shown only below 720px (CSS).
export default function StickyRegister({
  cta,
  spots,
}: {
  cta: Cta;
  spots: string | null;
}) {
  const [heroGone, setHeroGone] = useState(false);
  const [formShown, setFormShown] = useState(false);

  useEffect(() => {
    const watch = (id: string, set: (seen: boolean) => void) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const io = new IntersectionObserver(([e]) => set(e.isIntersecting));
      io.observe(el);
      return io;
    };
    const a = watch("hero-cta", (seen) => setHeroGone(!seen));
    const b = watch("register", setFormShown);
    return () => {
      a?.disconnect();
      b?.disconnect();
    };
  }, []);

  if (cta.kind === "none") return null;
  const show = heroGone && !formShown;

  return (
    <div className={`sticky-cta${show ? " show" : ""}`} aria-hidden={!show} inert={!show}>
      {spots && <span className="sticky-spots">{spots}</span>}
      <CtaButton cta={cta} className="btn" />
    </div>
  );
}
