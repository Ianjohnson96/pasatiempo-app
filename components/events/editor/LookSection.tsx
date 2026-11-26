"use client";

import { useRef, useState } from "react";
import { uploadLogo } from "@/lib/events/actions";
import { TYPE_LABEL } from "@/lib/events/format";
import {
  DEFAULT_BUTTON_LABEL,
  DEFAULT_HEADINGS,
} from "@/lib/events/page-settings";
import type { EventType } from "@/lib/events/types";
import {
  DEFAULT_CONTACT,
  HERO_STYLES,
  LOGOS,
  WORDING_LIMITS,
  type HeroStyle,
  PRESETS,
  type EventTheme,
  type LogoId,
  type PresetId,
  logoUploadCheck,
  logosFor,
  resolveHero,
  resolveLogo,
  themeVars,
} from "@/lib/events/theme";

const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

// The editor's "Look" section: the page's colours, hero photo, logo and the
// contact members are pointed to. Everything here shows in the live preview.
const HERO_LABELS: Record<HeroStyle, { name: string; hint: string }> = {
  photo: { name: "Full photo", hint: "The photo fills the top of the page." },
  banner: { name: "Banner", hint: "A shorter photo, so the details come sooner." },
  plain: { name: "No photo", hint: "The title on the look's own colour." },
};

// Words a button often needs; any other wording can be typed.
const BUTTON_IDEAS = [
  DEFAULT_BUTTON_LABEL,
  "Sign up",
  "RSVP",
  "Enter your team",
  "Reserve your spot",
  "Book your place",
];

export default function LookSection({
  eventId,
  type,
  photos,
  theme,
  onTheme,
  contactName,
  contactEmail,
  onContact,
}: {
  eventId: string | undefined;
  type: EventType;
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
  // blank wording means "use the page's usual words"
  const words = (v: string) => (v.trim() ? v : undefined);
  const setHeading = (k: keyof typeof DEFAULT_HEADINGS, v: string) => {
    const headings = { ...t.headings, [k]: words(v) };
    set({ headings: Object.values(headings).some(Boolean) ? headings : undefined });
  };
  const heroStyle = t.heroStyle ?? "photo";

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
        <span className="lbl" id="look-hero-style-lbl">
          Top of the page
        </span>
        <div className="seg" role="radiogroup" aria-labelledby="look-hero-style-lbl">
          {HERO_STYLES.map((h) => (
            <label key={h} className={`segbtn ${heroStyle === h ? "on" : ""}`}>
              <input
                type="radio"
                name="look-hero-style"
                checked={heroStyle === h}
                onChange={() => set({ heroStyle: h === "photo" ? undefined : h })}
              />
              {HERO_LABELS[h].name}
            </label>
          ))}
        </div>
        <p className="hint">{HERO_LABELS[heroStyle].hint}</p>
      </div>

      <div className="field">
        <span className="lbl">Hero photo</span>
        {heroStyle === "plain" ? (
          <p className="hint">
            Not shown with &ldquo;No photo&rdquo;. Choose Full photo or Banner to
            use one.
          </p>
        ) : photos.length === 0 ? (
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

      <div className="look-words">
        <p className="look-words-title">Wording</p>
        <p className="hint" style={{ marginTop: 0 }}>
          Leave any box blank to keep the page&apos;s usual words, shown in grey.
        </p>
        <div className="row">
          <div className="field">
            <label htmlFor="look-button">Main button</label>
            <input
              id="look-button"
              list="look-button-ideas"
              value={t.buttonLabel ?? ""}
              maxLength={WORDING_LIMITS.buttonLabel}
              placeholder={DEFAULT_BUTTON_LABEL}
              onChange={(e) => set({ buttonLabel: words(e.target.value) })}
            />
            <datalist id="look-button-ideas">
              {BUTTON_IDEAS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="look-kicker">Line above the title</label>
            <input
              id="look-kicker"
              value={t.kicker ?? ""}
              maxLength={WORDING_LIMITS.kicker}
              placeholder={TYPE_LABEL[type]}
              onChange={(e) => set({ kicker: words(e.target.value) })}
            />
          </div>
        </div>
        <div className="row three">
          {(
            [
              ["about", "Overview heading"],
              ["info", "Details heading"],
              ["register", "Sign-up heading"],
            ] as const
          ).map(([k, label]) => (
            <div className="field" key={k}>
              <label htmlFor={`look-h-${k}`}>{label}</label>
              <input
                id={`look-h-${k}`}
                value={t.headings?.[k] ?? ""}
                maxLength={WORDING_LIMITS.heading}
                placeholder={DEFAULT_HEADINGS[k]}
                onChange={(e) => setHeading(k, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="field">
          <label htmlFor="look-thanks">Message after signing up</label>
          <textarea
            id="look-thanks"
            rows={2}
            value={t.thankYou ?? ""}
            maxLength={WORDING_LIMITS.thankYou}
            placeholder="Optional, e.g. See you on the first tee! Bring your partner to registration on Thursday."
            onChange={(e) => set({ thankYou: words(e.target.value) })}
          />
          <p className="hint">
            Shown on the &ldquo;You&apos;re registered&rdquo; screen and added to
            the confirmation email. Waitlisted sign-ups don&apos;t get it.
          </p>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={!!t.hideSpots}
            onChange={(e) => set({ hideSpots: e.target.checked || undefined })}
          />
          Hide how many spots are left
        </label>
        <p className="hint">
          Members won&apos;t see the counts; the event still fills and closes at
          its limit.
        </p>
      </div>

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
    // check here too: a file over the server's request limit never reaches it
    const checked = logoUploadCheck(file.type, file.size);
    if (!checked.ok) {
      setBusy(false);
      setError(checked.error);
      if (input.current) input.current.value = "";
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadLogo(eventId, fd);
      if (res.ok) onTheme({ ...theme, logo: { url: res.url } });
      else setError(res.error);
    } catch {
      setError("The logo didn't upload. Please try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
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
          accept="image/png,image/jpeg"
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
