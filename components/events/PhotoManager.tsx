"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  movePhoto,
  removePhoto,
  setGalleryMode,
  uploadPhoto,
} from "@/lib/events/actions";
import type { GalleryMode } from "@/lib/events/types";

export default function PhotoManager({
  eventId,
  photos: initial,
  mode: initialMode,
}: {
  eventId: string;
  photos: string[];
  mode: GalleryMode;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [mode, setMode] = useState<GalleryMode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Read an image's pixel dimensions in the browser before uploading.
  function imageSize(file: File): Promise<{ w: number; h: number }> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ w: 0, h: 0 });
      };
      img.src = url;
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    setWarn("");
    setBusy(true);
    const small: number[] = [];
    for (const file of Array.from(files)) {
      const { w } = await imageSize(file);
      if (w > 0 && w < 1000) small.push(w);
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadPhoto(eventId, fd);
      if (res.ok && res.photos) setPhotos(res.photos);
      else setError(res.error ?? "Upload failed.");
    }
    if (small.length) {
      setWarn(
        `${small.length} image${small.length > 1 ? "s are" : " is"} low-resolution (${small.join(", ")}px wide) and may look blurry when enlarged. For a crisp hero and gallery, use images at least ~1200px wide.`,
      );
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function remove(p: string) {
    setBusy(true);
    setPhotos(await removePhoto(eventId, p));
    setBusy(false);
    router.refresh();
  }

  async function move(p: string, dir: -1 | 1) {
    setBusy(true);
    setPhotos(await movePhoto(eventId, p, dir));
    setBusy(false);
    router.refresh();
  }

  async function changeMode(m: GalleryMode) {
    setMode(m);
    await setGalleryMode(eventId, m);
    router.refresh();
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>
          Photos
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        {photos.length > 0 && (
          <div className="seg">
            <label className={`segbtn ${mode === "slideshow" ? "on" : ""}`}>
              <input
                type="radio"
                checked={mode === "slideshow"}
                onChange={() => changeMode("slideshow")}
              />
              Slideshow
            </label>
            <label className={`segbtn ${mode === "grid" ? "on" : ""}`}>
              <input
                type="radio"
                checked={mode === "grid"}
                onChange={() => changeMode("grid")}
              />
              Grid
            </label>
          </div>
        )}
      </div>

      <p className="hint">
        Add photos to show on the public page — a venue shot, past events, a
        menu. Drag the order with the arrows; the first photo leads the
        slideshow.
      </p>

      {error && <div className="notice err">{error}</div>}
      {warn && <div className="notice warn">{warn}</div>}

      {photos.length > 0 && (
        <div className="photo-grid" style={{ marginBottom: 14 }}>
          {photos.map((p, i) => (
            <div className="photo-thumb" key={p}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" />
              <div className="ph-actions">
                {i > 0 && (
                  <button title="Move left" onClick={() => move(p, -1)}>
                    ‹
                  </button>
                )}
                {i < photos.length - 1 && (
                  <button title="Move right" onClick={() => move(p, 1)}>
                    ›
                  </button>
                )}
                <button title="Remove" onClick={() => remove(p)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        type="button"
        className="btn secondary"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Uploading…" : "+ Add photos"}
      </button>
    </div>
  );
}
