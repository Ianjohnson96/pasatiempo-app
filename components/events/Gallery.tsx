"use client";

import { useEffect, useState } from "react";
import type { GalleryMode } from "@/lib/events/types";

export default function Gallery({
  photos,
  mode,
}: {
  photos: string[];
  mode: GalleryMode;
}) {
  const [i, setI] = useState(0);

  // auto-advance the slideshow
  useEffect(() => {
    if (mode !== "slideshow" || photos.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % photos.length), 5000);
    return () => clearInterval(t);
  }, [mode, photos.length]);

  if (photos.length === 0) return null;

  if (mode === "grid") {
    return (
      <div className="gallery gallery-grid">
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={p} alt="" />
        ))}
      </div>
    );
  }

  const idx = ((i % photos.length) + photos.length) % photos.length;
  return (
    <div className="slideshow">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="slide" src={photos[idx]} alt="" />
      {photos.length > 1 && (
        <>
          <button
            type="button"
            className="nav prev"
            aria-label="Previous"
            onClick={() => setI(idx - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="nav next"
            aria-label="Next"
            onClick={() => setI(idx + 1)}
          >
            ›
          </button>
          <div className="dots">
            {photos.map((p, n) => (
              <button
                key={p}
                type="button"
                className={`dot ${n === idx ? "on" : ""}`}
                aria-label={`Photo ${n + 1}`}
                onClick={() => setI(n)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
