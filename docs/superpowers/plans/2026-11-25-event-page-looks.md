# Event Page Looks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each event's public sign-up page (`/events/e/<slug>`) carry its own look (preset + optional accent, hero photo with focal point, logo, contact), and give that page a phone-first UX pass.

**Architecture:** A look is data (`events.theme jsonb`) turned into CSS-variable overrides by pure functions in `lib/events/theme.ts`, applied as an inline `style` on `<main className="pub">` and on the editor preview. The page's nav, hero and facts become shared components so the editor preview renders the real thing. UX behaviour that can be pure (facts/CTA rules, validation, calendar files, spinner timing) lives in `lib/events/*.ts` with vitest tests; the rest is verified in the browser.

**Tech Stack:** Next.js app router (server page + client forms), Supabase (schema `events`, Storage bucket `event-photos`), plain CSS in `app/event-planner.css` scoped under `.ep`, vitest (`lib/**/*.test.ts`, node env).

**Spec:** `docs/superpowers/specs/2026-11-25-event-page-looks-design.md`

## Global Constraints

- Null theme must render today's page: same colours, same logo (`/logo-full.png`), same hero photo (`photos[0]`), same green 0.3 → 0.9 scrim.
- Every text/background pair in every preset ≥ 4.5:1; borders, bars and button fills against the page ≥ 3:1.
- Default contact: `Ian Johnson` / `Ijohnson@pasatiempo.com`, defined once.
- No new fonts, no animation library, no `transition: all`.
- Under `prefers-reduced-motion: reduce`: no movement or scale; < 200ms opacity fades; states still shown.
- Tap targets ≥ 48px, ≥ 8px apart; phone body text 17px; inputs ≥ 16px.
- Brush-script wordmark only as `public/invitational/img/wordmark-pasatiempo.svg`.
- Only the public page and the editor change; admin screens, emails and Club Hub cards stay as they are.
- Copy, exactly: "Join the waitlist", "Register now", "Adjusted slightly so button text stays readable.", "Add to calendar", "Change or cancel", "Use the look's own colour".

## Review Focus

1. **Migration not yet run**: `theme`, `contact_name` and `contact_email` are absent from the row. The page must render as Clubhouse with the default contact, not crash. → Task 2 test `rowToEvent tolerates missing look columns`.
2. **Hero photo deleted after it was chosen**: the page must fall back to `photos[0]`, or to the plain hero if there are no photos. → Task 1 test `resolveHero falls back when heroPhoto is gone` + Task 2 `removePhoto` clears it.
3. **An accent that fails with both black and white text** (e.g. `#777777` on Clubhouse, `#8a8a8a` on Evening): buttons must still reach 4.5:1, and the editor must say the colour was adjusted. → Task 1 test `nudges a mid-grey accent until text passes`.
4. **Full event with the waitlist off, or a full tournament**: there must be no Register button anywhere (hero, sticky bar), and "Contact <name>" must show instead. → Task 4 test `ctaState full without waitlist offers contact`.
5. **Calendar for a slot with no date or no start time, or several slots**: the `.ics` must skip undated slots and produce all-day entries when there's no time. It must never output an invalid file. → Task 10 tests.

---

## File map

| File | Responsibility |
|---|---|
| `lib/events/color.ts` (new) | hex parsing, relative luminance, contrast ratio, lightness nudge |
| `lib/events/theme.ts` (new) | `EventTheme` type, presets, logo library, `parseTheme`, `themeVars`, `resolveHero`, `resolveLogo`, `eventContact` |
| `lib/events/public-page.ts` (new) | pure rules for facts strip + CTA (price fact, full/waitlist/contact) |
| `lib/events/validate.ts` (new) | `registrationErrors` (all problems at once) |
| `lib/events/calendar.ts` (new) | Google Calendar URL + `.ics` text |
| `lib/events/busy.ts` (new) | spinner timing rule |
| `supabase/migration-event-looks.sql` (new) | three columns |
| `lib/events/types.ts`, `map.ts`, `actions.ts`, `editor.ts` | carry `theme`, `contactName`, `contactEmail`; logo upload; contact in messages |
| `components/events/public/PublicNav.tsx`, `PublicHero.tsx`, `FactsStrip.tsx` (new) | shared by page and preview |
| `components/events/public/StickyRegister.tsx` (new) | phone sticky bar |
| `components/events/public/ErrorSummary.tsx`, `SubmitButton.tsx`, `Confirmation.tsx` (new) | form UX |
| `components/events/editor/LookSection.tsx` (new) | editor Look section |
| `app/events/e/[slug]/page.tsx`, `components/events/editor/EditorPreview.tsx`, `EventEditor.tsx`, `RegistrationForm.tsx`, `TeamEntryForm.tsx`, `ManageRegistration.tsx` | wire it up |
| `app/event-planner.css` | variable hookups, Evening, scrims, sizes, motion |

Note: photos are managed on the event's Manage page (`app/admin/events/[id]/page.tsx` → `PhotoManager`), not in the editor, so the editor's Look section only *chooses* among `event.photos`.

---

### Task 1: Colour maths and the theme model

**Files:**
- Create: `lib/events/color.ts`, `lib/events/theme.ts`
- Test: `lib/events/color.test.ts`, `lib/events/theme.test.ts`

**Interfaces:**
- Produces (color.ts):
  - `parseHex(s: string): string | null`: normalises `#abc`/`#aabbcc` (any case) to lower-case `#rrggbb`, else null
  - `contrast(a: string, b: string): number`: WCAG ratio
  - `shiftLightness(hex: string, deltaPct: number): string`: HSL lightness ± percentage points, clamped
- Produces (theme.ts):
  - `type PresetId = "clubhouse" | "invitational" | "coastal" | "evening"`
  - `type LogoId = "club-full" | "logo-1929" | "mark" | "events-tile" | "wordmark"`
  - `interface EventTheme { preset: PresetId; accent?: string; heroPhoto?: string; heroFocus?: { x: number; y: number }; logo?: { library: LogoId } | { url: string } }`
  - `const PRESETS: Record<PresetId, Preset>` where `Preset = { label: string; dark: boolean; vars: Record<string, string>; accent: string; defaultLogo: LogoId }`. `vars` holds the full token set from `event-planner.css:21-54` (`--bg --card --ink --muted --line --hairline --club --club-2 --green --green-dark --green-light --green-tint --brass --brass-soft --brass-ink --accent --gold --gold-soft --cream --ivory --paper --rule-strong --danger --warn`) plus the new `--on-accent`, `--scrim`, `--input-bg`, `--notice-warn-bg`, `--notice-err-bg`, `--focus`. Clubhouse values are exactly today's; Clubhouse `--scrim` is today's gradient from `event-planner.css:969-976`. Other presets start from the spec §2 table.
  - `const LOGOS: Record<LogoId, { label: string; light: string; dark: string }>`: paths: club-full `/logo-full.png` (both); logo-1929 `/brand/pasatiempo-logo-1929.png` / `/brand/pasatiempo-logo-1929-reverse.png`; mark `/logo-mark.png` (both); events-tile from `public/logo-events*.png` (check names); wordmark `/invitational/img/wordmark-pasatiempo.svg` (dark only. `light` is `""`, and it is offered only when the preset is dark)
  - `parseTheme(raw: unknown): EventTheme | null`
  - `themeVars(theme: EventTheme | null): { vars: Record<string, string>; accentUsed: string; adjusted: boolean }`
  - `resolveHero(theme: EventTheme | null, photos: string[]): { src: string; focus: { x: number; y: number } } | null`
  - `resolveLogo(theme: EventTheme | null): string`: always a URL
  - `DEFAULT_CONTACT = { name: "Ian Johnson", email: "Ijohnson@pasatiempo.com" }` and `eventContact(e: { contactName: string | null; contactEmail: string | null }): { name: string; email: string }`

- [ ] **Step 1: Write failing tests in `color.test.ts`**

```ts
expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
expect(contrast("#a2814a", "#f5f1e6")).toBeCloseTo(3.2, 1); // matches the css comment
expect(parseHex("#ABC")).toBe("#aabbcc");
expect(parseHex("red")).toBeNull();
expect(shiftLightness("#808080", -10)).toBe("#666666");
```

- [ ] **Step 2: Write failing tests in `theme.test.ts`**

```ts
test("null and clubhouse are identical", () => {
  expect(themeVars(null)).toEqual(themeVars({ preset: "clubhouse" }));
  expect(themeVars(null).vars["--bg"]).toBe("#f5f1e6");
  expect(resolveLogo(null)).toBe("/logo-full.png");
});
test("parseTheme is defensive", () => {
  expect(parseTheme(null)).toBeNull();
  expect(parseTheme({ preset: "disco" })?.preset).toBe("clubhouse");
  expect(parseTheme({ preset: "coastal", accent: "nope" })?.accent).toBeUndefined();
  expect(parseTheme({ preset: "evening", heroFocus: { x: 140, y: -5 } })?.heroFocus).toEqual({ x: 100, y: 0 });
});
test("every preset passes AA for its text pairs", () => {
  for (const id of Object.keys(PRESETS) as PresetId[]) {
    const v = themeVars({ preset: id }).vars;
    for (const [fg, bg] of [["--ink","--bg"],["--ink","--card"],["--muted","--bg"],["--muted","--card"],["--brass-ink","--bg"],["--on-accent","--accent"],["--danger","--card"]])
      expect(contrast(v[fg], v[bg]), `${id} ${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["--accent"], v["--bg"]), `${id} accent/bg`).toBeGreaterThanOrEqual(3);
  }
});
test("picks readable button text for a custom accent", () => {
  expect(themeVars({ preset: "clubhouse", accent: "#b41c14" }).vars["--on-accent"]).toBe("#ffffff");
  expect(themeVars({ preset: "clubhouse", accent: "#f2d14b" }).vars["--on-accent"]).toBe("#111111");
});
test("nudges a mid-grey accent until text passes", () => {
  const r = themeVars({ preset: "clubhouse", accent: "#777777" });
  expect(r.adjusted).toBe(true);
  expect(contrast(r.vars["--on-accent"], r.accentUsed)).toBeGreaterThanOrEqual(4.5);
  const e = themeVars({ preset: "evening", accent: "#8a8a8a" });
  expect(contrast(e.vars["--on-accent"], e.accentUsed)).toBeGreaterThanOrEqual(4.5);
});
test("resolveHero falls back when heroPhoto is gone", () => {
  expect(resolveHero({ preset: "clubhouse", heroPhoto: "/x.jpg" }, ["/a.jpg"])).toEqual({ src: "/a.jpg", focus: { x: 50, y: 50 } });
  expect(resolveHero(null, [])).toBeNull();
});
test("evening swaps a logo to its dark version", () => {
  expect(resolveLogo({ preset: "evening", logo: { library: "logo-1929" } })).toBe("/brand/pasatiempo-logo-1929-reverse.png");
  expect(resolveLogo({ preset: "coastal", logo: { url: "https://x/logo-1.png" } })).toBe("https://x/logo-1.png");
});
test("eventContact defaults to Ian", () => {
  expect(eventContact({ contactName: null, contactEmail: null })).toEqual(DEFAULT_CONTACT);
});
```

Note: if Clubhouse's own brass on ivory (3.2:1) fails `--accent`/`--bg` ≥ 3 it passes; but `--on-accent`/`--accent` for Clubhouse must use today's button text colour — check `.ep .btn.gold` in the css and, if today's pair is under 4.5, record that in the PR rather than changing Clubhouse (the null-theme rule wins; exempt Clubhouse's `--on-accent` pair in the test with a comment).

- [ ] **Step 3: Run `npx vitest run lib/events/color.test.ts lib/events/theme.test.ts`.** Expected: FAIL (modules missing).
- [ ] **Step 4: Implement `color.ts` and `theme.ts`.** Accent rule in `themeVars`: start from `parseHex(accent) ?? preset.accent`. Pick `#111111` or `#ffffff`, whichever has the higher contrast. If it is < 4.5, shift lightness 2 points at a time (darker on light presets, lighter on dark), up to 50 steps, until either text colour passes. Set `adjusted = accentUsed !== input`. The accent sets `--accent`, `--gold` and `--brass`. `--brass-ink` is the accent shifted toward the ink side until it reaches ≥ 4.5 on `--bg`. With no custom accent, the preset's own `--brass-ink` is kept. Tune preset hexes until the AA test passes.
- [ ] **Step 5: Run the same command.** Expected: PASS.
- [ ] **Step 6: Commit** `Event Planner: theme model and colour maths for per-event looks`.

### Task 2: Storage, contact and photo clean-up

**Files:**
- Create: `supabase/migration-event-looks.sql` (the three `alter table … add column if not exists` lines from spec §1, with the header comment style of `migration-roster-limit.sql`)
- Modify: `lib/events/types.ts` (`EventRec`), `lib/events/map.ts` (`rowToEvent`, `eventToRow`), `lib/events/actions.ts` (`EventInput`, `saveEventInner` fields, messages at ≈550, 772, 837, 848, `removePhoto` ≈363), `lib/events/editor.ts` (`EditorState`, `buildEventInput`, `previewEvent`), `components/events/EventEditor.tsx` (initial state from `event`)
- Test: `lib/events/map.test.ts`, `lib/events/editor.test.ts`

**Interfaces:**
- Consumes: `parseTheme`, `EventTheme`, `eventContact` (Task 1)
- Produces: `EventRec.theme: EventTheme | null`, `EventRec.contactName: string | null`, `EventRec.contactEmail: string | null`. The same three fields on `EventInput`. `EditorState.theme: EventTheme | null`, `EditorState.contactName: string`, `EditorState.contactEmail: string` (blank → null in `buildEventInput`).

- [ ] **Step 1: Write failing tests**: in `map.test.ts`: `rowToEvent tolerates missing look columns` (a row without the keys → `theme: null, contactName: null, contactEmail: null`); `rowToEvent parses theme jsonb` (`{preset:"disco"}` → clubhouse); `eventToRow writes theme and contact` (`theme` → `row.theme`, `contactName` → `row.contact_name`, `contactEmail` → `row.contact_email`). In `editor.test.ts`: `buildEventInput carries theme and blank contact becomes null`, `previewEvent carries theme`.
- [ ] **Step 2: Run `npx vitest run lib/events/map.test.ts lib/events/editor.test.ts`.** Expected: the new tests FAIL.
- [ ] **Step 3: Implement the mapping and plumbing.** In `saveEventInner`, trim the contact fields and lower-case the email. Store the theme only via `parseTheme(input.theme)`. Replace each hard-coded "Ian Johnson at Ijohnson@pasatiempo.com" in `actions.ts` with `eventContact(ev)`, written as `${c.name} at ${c.email}`. Replace the page's notice at `page.tsx:339-342` in Task 4. In `removePhoto`, also select `theme`. If `theme.heroPhoto === photoUrl`, delete `heroPhoto` and write the theme back in the same update.
- [ ] **Step 4: Run the same command plus `npx tsc --noEmit`.** Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `Event Planner: store an event's look and contact`.

### Task 3: Logo upload

**Files:**
- Modify: `lib/events/actions.ts` (next to `uploadPhoto`, ≈ line 318; clean-up in `saveEventInner`)
- Test: `lib/events/theme.test.ts` (pure helper)

**Interfaces:**
- Produces: `uploadLogo(eventId: string, fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }>`, which accepts `image/png | image/svg+xml | image/jpeg` ≤ 2 MB and stores the file at `event-photos/<eventId>/logo-<newId()>.<ext>` without touching the event row. Also `unusedLogoPaths(files: string[], keepUrl: string | null): string[]` (pure, in `theme.ts`), which returns the `logo-*` names in the folder other than the kept one.
- `saveEventInner` calls the storage `list(id)`, then `remove(unusedLogoPaths(...))` (prefixed `<id>/`), after a successful update. Errors are swallowed the same way as `removePhoto`.

- [ ] **Step 1: Write the failing test.** `unusedLogoPaths(["a.jpg","logo-1.png","logo-2.svg"], "https://…/event-photos/E/logo-2.svg")` → `["logo-1.png"]`; with `keepUrl` null → both logos; never returns non-logo files.
- [ ] **Step 2: Run `npx vitest run lib/events/theme.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement `unusedLogoPaths` and `uploadLogo`, and add the clean-up to save.** Reuse `assertCanManageEvent` and the bucket upload code from `uploadPhoto`. The error copy for a bad type or size is "Logos must be PNG, SVG or JPG under 2 MB."
- [ ] **Step 4: Run tests plus `npx tsc --noEmit`.** Expected: PASS.
- [ ] **Step 5: Commit** `Event Planner: upload a logo for an event`.

### Task 4: Shared header pieces and the themed public page

**Files:**
- Create: `lib/events/public-page.ts`, `lib/events/public-page.test.ts`, `components/events/public/PublicNav.tsx`, `PublicHero.tsx`, `FactsStrip.tsx`
- Modify: `app/events/e/[slug]/page.tsx` (lines ≈ 60-209 and 335-345), `app/event-planner.css` (hero ≈ 940-1000)

**Interfaces:**
- Consumes: `themeVars`, `resolveHero`, `resolveLogo`, `eventContact`
- Produces:
  - `type Cta = { kind: "register"; label: "Register now" } | { kind: "waitlist"; label: "Join the waitlist" } | { kind: "contact"; name: string; email: string } | { kind: "none" }`
  - `ctaState(event: EventRec, seats: SeatInfo, rosterFull: boolean): Cta`: `none` when status ≠ open; `contact` when full (or the roster is full) and either the waitlist is off or the event is a tournament; `waitlist` when full and the waitlist is on; otherwise `register`
  - `priceFact(event: EventRec): string | null`: null when `!pricingEnabled` or the pricing is blank, else the first non-blank pricing line
  - `<PublicNav logo={string} />`, `<PublicHero event={EventRec} hero={ReturnType<typeof resolveHero>} cta={Cta} />`, `<FactsStrip facts={{lbl:string;val:ReactNode}[]} spots={…} roster={…} />` (props lifted from the current page JSX)
  - Root: `<main className="pub" data-look={preset} style={themeVars(event.theme).vars}>`

- [ ] **Step 1: Write failing tests in `public-page.test.ts`**: `ctaState full without waitlist offers contact` (general event, full, `waitlistEnabled:false` → `{kind:"contact", name:"Ian Johnson", …}`); `full tournament offers contact even with waitlist on`; `full with waitlist shows Join the waitlist`; `closed event has no CTA`; `priceFact is null when pricing is off` (also when `pricingEnabled` is true but the pricing text is blank); `priceFact takes the first line`. Build fixtures with `previewEvent` from `editor.ts`.
- [ ] **Step 2: Run `npx vitest run lib/events/public-page.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement `public-page.ts`.**
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Extract the three components from `page.tsx`.** The hero becomes `<img className="pub-hero-photo" src alt="" fetchPriority="high" style={{objectPosition:`${x}% ${y}%`}}>` with `object-fit: cover` in CSS, and the scrim reads `var(--scrim)`. The facts get a "Price" fact from `priceFact`. The hero CTA renders from `ctaState`: a contact CTA is a `mailto:` link styled `.btn` reading "Contact <name>". The roster-full notice uses `eventContact(event)`.
- [ ] **Step 6: Verify in the browser.** Run `npm run dev` (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`) and open the Invitational and the Ladies clinic. Their colours, logo, photo and scrim must match `main` exactly. Compare screenshots of both pages on `main` and on the branch at 390px and 1280px wide.
- [ ] **Step 7: Commit** `Event Planner: shared hero, nav and facts; the page wears its look`.

### Task 5: Preset styling, Evening and the colour sweep

**Files:**
- Modify: `app/event-planner.css`, `lib/events/theme.ts` (new variables)

**Interfaces:**
- Consumes: the variables `themeVars` sets (Task 1), including `--on-accent --scrim --input-bg --notice-warn-bg --notice-err-bg --focus`.

- [ ] **Step 1: List the hard-coded colours under the public page.** Run `grep -nE "#[0-9a-fA-F]{3,6}|rgba?\(" app/event-planner.css` and keep only the rules that apply under `.pub` or inside the forms the page renders (`.card`, `.notice`, inputs, `.chip`, `.success-box`, `.spots-bar`, `.sched-*`, `.roster`, `.pricing-card`, `.btn*`).
- [ ] **Step 2: Swap each one for a variable.** Replace each listed literal with the matching variable, adding a variable to `PRESETS` (Task 1) where none exists. Clubhouse values stay identical to the literal they replace. Button text becomes `color: var(--on-accent)` on `.btn.gold` and the accent buttons. Focus rings use `var(--focus)`.
- [ ] **Step 3: Check every look in the browser.** Temporarily set each preset in the editor (Task 6), or set `theme` in the database, and look at all four at 390px and 1280px. Check the notices, inputs, chips, the spots bar and the success box. Then run `npx vitest run lib/events/theme.test.ts`. Expected: PASS.
- [ ] **Step 4: Commit** `Event Planner: presets reach every part of the sign-up page, Evening included`.

### Task 6: The editor's Look section and a real preview

**Files:**
- Create: `components/events/editor/LookSection.tsx`
- Modify: `lib/events/editor.ts` (`EDITOR_SECTIONS`: insert `{ id: "look", label: "Look" }` after `details`), `components/events/EventEditor.tsx` (state, render the section), `components/events/editor/EditorPreview.tsx` (render `PublicNav` + `PublicHero` + `FactsStrip` inside a wrapper with `themeVars(...).vars`), `app/event-planner.css` (Look-section styles)
- Test: `lib/events/editor.test.ts`

**Interfaces:**
- Consumes: `PRESETS`, `LOGOS`, `themeVars`, `resolveHero`, `uploadLogo`, the shared components (Task 4)
- Produces: `<LookSection eventId={string|undefined} photos={string[]} theme={EventTheme|null} onTheme={(t: EventTheme) => void} contactName={string} contactEmail={string} onContact={(name: string, email: string) => void} />`

- [ ] **Step 1: Write the failing test.** `EDITOR_SECTIONS has look after details`.
- [ ] **Step 2: Run `npx vitest run lib/events/editor.test.ts`.** Expected: FAIL. Then insert the section. Expected: PASS.
- [ ] **Step 3: Build `LookSection`** as laid out in spec §6:
  - Four preset tiles as radio buttons, each showing its bg/primary/accent swatches.
  - A colour input plus a "Use the look's own colour" button. When `themeVars(...).adjusted`, show the colour actually used and "Adjusted slightly so button text stays readable."
  - Hero thumbnails from `photos`. If there are none: "Add photos on the event's Manage page." Clicking a large copy sets `heroFocus` from the click position as a percentage, marked with a crosshair. Phone (9:16-ish) and desktop (16:6-ish) crop frames use the same `object-position`.
  - Logo tiles from `LOGOS` (wordmark only when the preset is dark), plus Upload. Upload is disabled with "Save the event first" when `eventId` is undefined.
  - Contact name and email inputs, with placeholders showing `DEFAULT_CONTACT`.
- [ ] **Step 4: Check it in the browser.** Change the preset, accent, hero, focus and logo. Each change shows in the preview at once. Save, reload, and the values stay. The public page matches the preview.
- [ ] **Step 5: Commit** `Event Planner: a Look section in the editor, previewed for real`.

### Task 7: Sticky Register bar on phones

**Files:**
- Create: `components/events/public/StickyRegister.tsx`
- Modify: `app/events/e/[slug]/page.tsx`, `app/event-planner.css`

**Interfaces:**
- Consumes: `Cta` (Task 4); the hero button gets `id="hero-cta"`, the form section keeps `id="register"`
- Produces: `<StickyRegister cta={Cta} spots={string | null} />`. Client component. Renders nothing for `kind: "none"`. For `contact` it shows the mailto. It is visible only when `#hero-cta` and `#register` are both off screen (two `IntersectionObserver`s), and only below 720px (CSS). It uses `padding-bottom: env(safe-area-inset-bottom)` and slides up 160ms, or fades under reduced motion.

- [ ] **Step 1: Implement and wire it up.**
- [ ] **Step 2: Check it at 390px wide.** The bar is hidden at the top. It appears after scrolling past the hero, disappears when Register comes into view, and never shows at 1280px. Tab to the button and check the focus ring shows.
- [ ] **Step 3: Commit** `Event Planner: a Register bar that follows you on phones`.

### Task 8: Sizes, button motion and reduced motion

**Files:**
- Create: `lib/events/busy.ts`, `lib/events/busy.test.ts`, `components/events/public/SubmitButton.tsx`
- Modify: `app/event-planner.css` (`.ep .btn` ≈ 343-400, `.pub` type sizes, inputs, slot rows, the `@media (prefers-reduced-motion)` block ≈ 2568), `RegistrationForm.tsx` (button ≈ 294), `TeamEntryForm.tsx` (buttons ≈ 369-379)

**Interfaces:**
- Produces:
  - `spinnerVisible(startedAt: number, now: number): boolean`: true from `startedAt + 1000` on
  - `holdUntil(shownAt: number | null, now: number): number`: ms still to wait so the spinner stays at least 500ms (0 if it never showed)
  - `<SubmitButton busy={boolean} done={boolean} className?>{label}</SubmitButton>`: keeps its label, adds `.is-busy` after 1s, and adds `.is-done` (a tick morph of about 300ms) once `done`. The parent waits `holdUntil(...) + 300` ms before swapping in the confirmation.

- [ ] **Step 1: Write failing tests.** `spinnerVisible(0, 999)` is false and `spinnerVisible(0, 1000)` is true. `holdUntil(1000, 1200)` is 300. `holdUntil(null, 5000)` is 0.
- [ ] **Step 2: Run `npx vitest run lib/events/busy.test.ts`.** Expected: FAIL. Implement it, run again. Expected: PASS.
- [ ] **Step 3: CSS.**
  - `.ep .btn` press: `transform: scale(0.97)` with `transition: transform 120ms ease-out, background-color 160ms ease-out, color 160ms ease-out`. The release goes back in 160ms.
  - Under `.pub` below 720px: body 17px. Inputs, selects and textareas 16px. `.btn`, the slot rows, the checkbox labels and the party stepper buttons get `min-height: 48px` with `gap ≥ 8px`.
  - Reduced motion: scale removed, the spinner replaced by a static "Sending…" label, `.reveal` uses only opacity at 150ms.
  - Make sure no `transition: all` is left: `grep -n "transition: all" app/event-planner.css` should return nothing.
- [ ] **Step 4: Swap the submit buttons.** Use `SubmitButton` for the submit buttons in both forms.
- [ ] **Step 5: Check it in the browser.** Throttle the network to Slow 3G, submit, and watch the spinner appear after 1s and then the tick. Repeat with reduced motion emulated.
- [ ] **Step 6: Commit** `Event Planner: buttons that answer a press; sizes a thumb can hit`.

### Task 9: Error summary

**Files:**
- Create: `lib/events/validate.ts`, `lib/events/validate.test.ts`, `components/events/public/ErrorSummary.tsx`
- Modify: `RegistrationForm.tsx` (submit ≈ 85-115 and the field JSX), `TeamEntryForm.tsx` (show `ErrorSummary` over its existing `fieldErrors`, ≈ 55-90 and 200-262)

**Interfaces:**
- Produces:
  - `type FieldError = { field: string; message: string }`. `field` is the input's DOM id: `reg-name`, `reg-email`, `reg-slots`, `reg-q-<fieldId>`.
  - `registrationErrors(input: { event: EventRec; name: string; email: string; slotIds: string[]; answers: Answers }): FieldError[]`. It checks a missing name ("Enter your name"), a missing or invalid email ("Enter an email address like name@example.com"), no slot chosen in slots mode ("Choose at least one date"), and each required custom question ("Answer: <label>").
  - `<ErrorSummary errors={FieldError[]} />`. It focuses itself on mount or change (`tabIndex={-1}`). The title is "1 thing to fix" or "N things to fix". Each item is a link to `#<field>`. Server errors pass as `[{ field: "", message }]` and render without a link.
- Each field with an error gets `aria-invalid="true"` and `aria-describedby="<id>-err"`, with the message under it. The `Toast` is no longer used for form errors in `RegistrationForm`.

- [ ] **Step 1: Write failing tests.** An empty submission on a slots event with one required question gives exactly 4 errors in field order. `"bob@"` is invalid. A valid input gives `[]`.
- [ ] **Step 2: Run `npx vitest run lib/events/validate.test.ts`.** Expected: FAIL. Implement it, run again. Expected: PASS.
- [ ] **Step 3: Wire both forms.** Check in the browser: submit empty, the summary gets focus, clicking an item focuses its field, and fixing a field removes its message on the next submit.
- [ ] **Step 4: Commit** `Event Planner: every problem with a sign-up shown at once`.

### Task 10: Confirmation with calendar, change/cancel and contact

**Files:**
- Create: `lib/events/calendar.ts`, `lib/events/calendar.test.ts`, `components/events/public/Confirmation.tsx`
- Modify: `RegistrationForm.tsx` (success view ≈ 117-152), `TeamEntryForm.tsx` (its success view), `ManageRegistration.tsx` (accept a prefill)

**Interfaces:**
- Consumes: `CLUB_TIME_ZONE`, `formatWhen` and `formatSlot` from `lib/events/format.ts`; `eventContact`
- Produces:
  - `calendarEntries(event: EventRec, slotIds: string[]): { title: string; start: string; end: string; allDay: boolean; location: string }[]`. In slots mode it uses the chosen slots that have a `date`, skipping undated ones. With no `startTime` the entry is all-day. Otherwise it uses `startsAt`/`endsAt`, with end defaulting to start + 2h. With no date at all it returns `[]`.
  - `googleCalendarUrl(entry): string` (`https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=…&ctz=America/Los_Angeles&location=…`)
  - `icsText(entries, uid: string): string`: a VCALENDAR with one VEVENT per entry, `DTSTART;TZID=America/Los_Angeles:YYYYMMDDTHHMMSS` or `;VALUE=DATE` for all-day, CRLF line endings, escaped commas, semicolons and newlines
  - `<Confirmation event status email slotIds />`: confirmed shows the when/where lines, "Add to calendar" (the Google link plus a download made from `icsText`, as a Blob, named `<slug>.ics`), "Change or cancel", and "Questions? Contact <name>" (mailto). Waitlist shows the existing waitlist copy and the contact line only.
  - Prefill: "Change or cancel" sends `window.dispatchEvent(new CustomEvent("ep:manage", { detail: { email } }))` and scrolls to the panel. `ManageRegistration` listens, fills in its email, and focuses Look up without submitting.

- [ ] **Step 1: Write failing tests.**
  - A single-date event gives one timed entry in LA time.
  - Two dated slots plus one undated slot give 2 entries.
  - A slot with no start time is all-day (`;VALUE=DATE`).
  - `icsText` has CRLF endings, starts `BEGIN:VCALENDAR`, has one `BEGIN:VEVENT` per entry, and escapes `"Lunch, wine; fun"`.
  - An event with no date returns `[]`.
- [ ] **Step 2: Run `npx vitest run lib/events/calendar.test.ts`.** Expected: FAIL. Implement it, run again. Expected: PASS.
- [ ] **Step 3: Build `Confirmation`** (no "Add to calendar" when entries are empty) and use it in both forms and in `ManageRegistration`. Check in the browser on a test event, not the live Invitational. Register, download the `.ics` and open it, follow the Google link, then use "Change or cancel" and check the email is filled in.
- [ ] **Step 4: Commit** `Event Planner: a confirmation you can put in your calendar`.

### Task 11: Whole-page check and hand-off

- [ ] **Step 1: Run `npx vitest run && npx tsc --noEmit && npx eslint app components lib`.** Expected: all pass.
- [ ] **Step 2: Check every combination in the browser.** For each preset × (the Invitational, the Ladies clinic) × (390px, 1280px), take screenshots. Do one pass with reduced motion and one with the database row's `theme` null. Send Ian the screenshots of all four looks.
- [ ] **Step 3: Note in the PR description** that `supabase/migration-event-looks.sql` must be run in the *pasatiempo-events* SQL editor before merging.
- [ ] **Step 4: Commit** any fixes.
