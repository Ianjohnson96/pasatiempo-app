"use client";

import { useRef, useState } from "react";
import { uploadLogo } from "@/lib/events/actions";
import {
  DEFAULT_CONTACT,
  LOGOS,
  PRESETS,
  type EventTheme,
  type LogoId,
  type PresetId,
  logosFor,
  resolveHero,
  resolveLogo,
  themeVars,
} from "@/lib/events/theme";

const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

// The editor's "Look" section: the page's colours, hero photo, logo and the
// contact members are pointed to. Everything here shows in the live preview.
export default function LookSection({
  eventId,
  photos,
  theme,
  onTheme,
  contactName,
  contactEmail,
  onContact,
}: {
  eventId: string | undefined;
  photos: string[];
  theme: EventTheme | null;
  onTheme: (t: EventTheme) => void;
  contactName: string;
  contactEmail: string;
  onContact: (name: string, email: string) => void;
}) {
  const t: EventTheme = theme ?? { preset: "clubhouse" };
  const look = themeVars(t);
  const hero = resolveHero(t, photos);
  const set = (patch: Partial<EventTheme>) => onTheme({ ...t, ...patch });

  return (
    <>
      <div className="field">
        <span className="lbl" id="look-preset-lbl">
          Look
        </span>
        <div
          className="look-tiles"
          role="radiogroup"
          aria-labelledby="look-preset-lbl"
        >
          {PRESET_IDS.map((id) => {
            const v = PRESETS[id].vars;
            const on = t.preset === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                className={`look-tile${on ? " on" : ""}`}
                onClick={() => {
                  // a library logo the new look can't show falls back to its default
                  const keep =
                    t.logo &&
                    "library" in t.logo &&
                    !logosFor(id).includes(t.logo.library)
                      ? undefined
                      : t.logo;
                  onTheme({ ...t, preset: id, logo: keep });
                }}
              >
                <span
                  className="look-swatch"
                  aria-hidden
                  style={{ background: v["--bg"] }}
                >
                  <i style={{ background: v["--hero-bg"] }} />
                  <i style={{ background: v["--btn"] }} />
                  <i style={{ background: v["--brass"] }} />
                </span>
                <span className="look-name">{PRESETS[id].label}</span>
                <span className="look-blurb">{PRESETS[id].blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <label htmlFor="look-accent">Button colour</label>
        <div className="look-accent">
          <input
            id="look-accent"
            type="color"
            value={look.accentUsed}
            onChange={(e) => set({ accent: e.target.value })}
          />
          <span className="look-hex">{look.accentUsed}</span>
          {t.accent && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => set({ accent: undefined })}
            >
              Use the look&apos;s own colour
            </button>
          )}
        </div>
        {look.adjusted && (
          <p className="hint" role="status">
            Adjusted slightly so button text stays readable.
          </p>
        )}
      </div>

      <div className="field">
        <span className="lbl">Hero photo</span>
        {photos.length === 0 ? (
          <p className="hint">Add photos on the event&apos;s Manage page.</p>
        ) : (
          <>
            <div className="look-thumbs">
              {photos.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`look-thumb${hero?.src === p ? " on" : ""}`}
                  aria-pressed={hero?.src === p}
                  aria-label="Use this photo for the hero"
                  onClick={() => set({ heroPhoto: p, heroFocus: undefined })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" />
                </button>
              ))}
            </div>
            {hero && (
              <FocusPicker
                src={hero.src}
                focus={hero.focus}
                onFocus={(f) => set({ heroPhoto: hero.src, heroFocus: f })}
              />
            )}
          </>
        )}
      </div>

      <LogoPicker eventId={eventId} theme={t} onTheme={onTheme} />

      <div className="row">
        <div className="field">
          <label htmlFor="look-contact-name">Contact name</label>
          <input
            id="look-contact-name"
            value={contactName}
            placeholder={DEFAULT_CONTACT.name}
            onChange={(e) => onContact(e.target.value, contactEmail)}
          />
        </div>
        <div className="field">
          <label htmlFor="look-contact-email">Contact email</label>
          <input
            id="look-contact-email"
            type="email"
            value={contactEmail}
            placeholder={DEFAULT_CONTACT.email}
            onChange={(e) => onContact(contactName, e.target.value)}
          />
        </div>
      </div>
      <p className="hint">
        Members are pointed to this person when the event is full or they have a
        question. Leave blank for {DEFAULT_CONTACT.name}.
      </p>
    </>
  );
}

function FocusPicker({
  src,
  focus,
  onFocus,
}: {
  src: string;
  focus: { x: number; y: number };
  onFocus: (f: { x: number; y: number }) => void;
}) {
  const pos = `${focus.x}% ${focus.y}%`;
  const pick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // keyboard "clicks" have no position; arrow keys handle those
    if (e.detail === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    onFocus({
      x: Math.round(((e.clientX - r.left) / r.width) * 100),
      y: Math.round(((e.clientY - r.top) / r.height) * 100),
    });
  };
  const nudge = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-5, 0],
      ArrowRight: [5, 0],
      ArrowUp: [0, -5],
      ArrowDown: [0, 5],
    };
    const d = steps[e.key];
    if (!d) return;
    e.preventDefault();
    const c = (n: number) => Math.min(100, Math.max(0, n));
    onFocus({ x: c(focus.x + d[0]), y: c(focus.y + d[1]) });
  };
  return (
    <div className="look-focus">
      <button
        type="button"
        className="look-focus-pick"
        onClick={pick}
        onKeyDown={nudge}
        aria-label={`Focal point ${focus.x}% across, ${focus.y}% down. Click the photo, or use the arrow keys, to move it.`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" />
        <span
          className="look-cross"
          style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
          aria-hidden
        />
      </button>
      <div className="look-crops" aria-hidden>
        <figure>
          <div className="crop phone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" style={{ objectPosition: pos }} />
          </div>
          <figcaption>Phone</figcaption>
        </figure>
        <figure>
          <div className="crop desktop">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" style={{ objectPosition: pos }} />
          </div>
          <figcaption>Desktop</figcaption>
        </figure>
      </div>
      <p className="hint">
        Tap the photo where the faces are; both crops keep that spot in view.
      </p>
    </div>
  );
}

function LogoPicker({
  eventId,
  theme,
  onTheme,
}: {
  eventId: string | undefined;
  theme: EventTheme;
  onTheme: (t: EventTheme) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const dark = PRESETS[theme.preset].dark;
  const current = resolveLogo(theme);
  const uploaded = theme.logo && "url" in theme.logo ? theme.logo.url : null;
  const disabled = !eventId || busy;

  async function onFile(file: File | undefined) {
    if (!file || !eventId) return;
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadLogo(eventId, fd);
    setBusy(false);
    if (input.current) input.current.value = "";
    if (res.ok) onTheme({ ...theme, logo: { url: res.url } });
    else setError(res.error);
  }

  const tile = (
    key: string,
    src: string,
    label: string,
    choose: () => void,
  ) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={current === src}
      className={`look-logo${current === src ? " on" : ""}`}
      style={{ background: PRESETS[theme.preset].vars["--card"] }}
      onClick={choose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
      <span style={{ color: PRESETS[theme.preset].vars["--muted"] }}>
        {label}
      </span>
    </button>
  );

  return (
    <div className="field">
      <span className="lbl" id="look-logo-lbl">
        Logo
      </span>
      <div
        className="look-logos"
        role="radiogroup"
        aria-labelledby="look-logo-lbl"
      >
        {logosFor(theme.preset).map((id: LogoId) =>
          tile(
            id,
            dark ? LOGOS[id].dark : LOGOS[id].light,
            LOGOS[id].label,
            () => onTheme({ ...theme, logo: { library: id } }),
          ),
        )}
        {uploaded &&
          tile("upload", uploaded, "Uploaded", () =>
            onTheme({ ...theme, logo: { url: uploaded } }),
          )}
      </div>
      <div className="look-upload">
        <input
          ref={input}
          type="file"
          accept="image/png,image/svg+xml,image/jpeg"
          id="look-logo-file"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <label
          htmlFor="look-logo-file"
          className={`btn secondary small${disabled ? " is-disabled" : ""}`}
          aria-disabled={disabled}
        >
          {busy ? "Uploading…" : "Upload a logo"}
        </label>
        {!eventId && <span className="hint">Save the event first</span>}
      </div>
      {error && (
        <p className="field-err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
