"use client";

import { useEffect, useState } from "react";
import type { Cta } from "@/lib/events/public-page";
import { CtaButton } from "./PublicHero";

// On phones, the main button follows the reader once the hero's button has
// scrolled away, and steps aside while the sign-up form, the "Already signed
// up?" panel or the footer (with its contact link) is on screen.
// Shown only below 720px (CSS).
const ASIDE = ["#register", "#manage", ".pub-foot"];

export default function StickyRegister({
  cta,
  spots,
}: {
  cta: Cta;
  spots: string | null;
}) {
  const [heroGone, setHeroGone] = useState(false);
  const [asideShown, setAsideShown] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const heroIo = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting));
    if (hero) heroIo.observe(hero);

    const seen = new Set<Element>();
    const asideIo = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) seen.add(e.target);
        else seen.delete(e.target);
      }
      setAsideShown(seen.size > 0);
    });
    for (const sel of ASIDE) {
      const el = document.querySelector(sel);
      if (el) asideIo.observe(el);
    }
    return () => {
      heroIo.disconnect();
      asideIo.disconnect();
    };
  }, []);

  if (cta.kind === "none") return null;
  const show = heroGone && !asideShown;

  return (
    <div className={`sticky-cta${show ? " show" : ""}`} aria-hidden={!show} inert={!show}>
      {spots && <span className="sticky-spots">{spots}</span>}
      <CtaButton cta={cta} className="btn" />
    </div>
  );
}
