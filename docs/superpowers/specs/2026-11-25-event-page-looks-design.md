# Event sign-up page: a look per event, and a UX pass

Date: 2026-11-25 · Owner: Ian Johnson · Status: **approved by Ian, 2026-11-25**
Carries on from `2026-11-25-event-page-looks-HANDOFF.md` (a cloud session's notes).

## Intent

The members' sign-up page (`/events/e/<slug>`, `app/events/e/[slug]/page.tsx`)
is the one screen every member sees for every event. Today every event looks
the same: the `logo-full.png` logo, ivory / club green / brass, and the first
uploaded photo as the hero, cropped wherever the browser decides. Ian wants
each event to be able to have **its own look — colours, hero photo and logo**
— so the Invitational looks like the Invitational and a wine dinner doesn't
look like a junior clinic. At the same time the page should get easier and
nicer to use on a phone: clearer facts, fewer dead ends, a better confirmation
and buttons that respond when pressed.

## Goals

1. An organiser picks a look for an event in the editor and sees it in the
   live preview before publishing.
2. Four preset looks ship: **Clubhouse** (default), **Invitational**,
   **Coastal**, **Evening**.
3. Optional custom accent colour on top of any preset, with button text that
   is always readable.
4. Organiser chooses the hero photo from the event's photos and sets where its
   focal point is, so faces aren't cropped.
5. Organiser chooses the header logo from the club's library or uploads one.
6. The UX pass listed below, on both the general form and the tournament
   (team entry) form.

## Non-goals

- Admin screens, emails, the Club Hub event cards: unchanged.
- Per-event fonts, section re-ordering, custom CSS.
- Moving optional questions to after confirmation (the research suggests it;
  it changes how registrations are stored and is left for later — *Claude's
  call*).
- Paying online.

## Anti-goals (would count as failure even if it "works")

- **Any existing event looks different** after release without someone
  choosing a look. Null theme = today's page, pixel for pixel in colour.
- A look that makes text or buttons hard to read (anything under WCAG AA).
- A heavier, slower page on phones: no new web fonts, no animation library.
- Motion that ignores "reduce motion".

## Constraints

- Next.js app router; the page is a server component, the forms are client
  components (`RegistrationForm.tsx`, `TeamEntryForm.tsx`,
  `ManageRegistration.tsx`).
- All planner styling lives in `app/event-planner.css`, scoped under `.ep`;
  colours are CSS variables (`--bg`, `--card`, `--ink`, `--muted`, `--line`,
  `--hairline`, `--club`/`--green`, `--brass`/`--gold`/`--accent`,
  `--brass-ink`, `--danger`, `--warn`, plus their aliases). Other club apps
  must keep their look.
- Database: Supabase project *pasatiempo-events*, table `events.events`.
  Schema changes are hand-run SQL files in `supabase/` (repo convention,
  e.g. `migration-roster-limit.sql`).
- Photos live in the Supabase Storage bucket `event-photos` under
  `<eventId>/`; `events.photos` is an ordered array of public URLs.
- Logo files in the repo: see the CLAUDE.md "Brand assets" list. The
  brush-script wordmark must be used as the SVG, never a font.

## Approaches considered

- **A. Free-form theming** — organiser picks every colour. Most flexible;
  easy to make something ugly or unreadable; lots of editor UI.
- **B. Presets only** — a short list of designed looks. Always good-looking;
  no way to match a sponsor or a one-off colour.
- **C. Presets + optional custom accent** *(Ian picked this)* — designed
  looks carry the page; the accent covers the "make it match the sponsor"
  case, and the page guards its contrast automatically.

## Design

### 1. What gets stored

Migration `supabase/migration-event-looks.sql` (hand-run, in the `events`
schema):

```sql
alter table events.events add column if not exists theme jsonb;
alter table events.events add column if not exists contact_name text;
alter table events.events add column if not exists contact_email text;
```

`theme` shape (null = Clubhouse with today's behaviour):

```ts
type EventTheme = {
  preset: "clubhouse" | "invitational" | "coastal" | "evening";
  accent?: string;            // "#rrggbb"; absent = the preset's own accent
  heroPhoto?: string;         // one of event.photos; absent/missing = photos[0]
  heroFocus?: { x: number; y: number }; // 0–100 %, default 50/50
  logo?: { library: LogoId } | { url: string }; // absent = preset default
};
```

Parsing is defensive (`lib/events/theme.ts`): unknown preset → clubhouse; bad
hex → ignored; a `heroPhoto` no longer in `photos` → falls back to
`photos[0]`; focus clamped to 0–100. Types go in `lib/events/types.ts`; the
mapping in `lib/events/data.ts`/`actions.ts` follows the existing
`rosterLimit` pattern.

`contact_name` / `contact_email`: null → Ian Johnson /
Ijohnson@pasatiempo.com (today's hard-coded values, moved into one constant).
Used **everywhere a member is told who to contact**: the "roster full"
notice, the new confirmation screen, and the server error messages in
`lib/events/actions.ts` that name Ian today (≈ lines 550, 837, 848), so a
member never sees two different contacts. *Claude's call.*

### 2. The four presets

Each preset is a set of CSS-variable overrides plus a default logo, defined
in one place (`lib/events/theme.ts`) and applied as an inline `style` on
`<main className="pub">` (and on the editor preview's root).

| Preset | Background / card | Ink | Primary (headings, bars) | Accent (buttons, rules) | Default logo |
|---|---|---|---|---|---|
| Clubhouse | ivory `#f5f1e6` / paper `#fbf8f1` | `#1b201d` | club green `#173a2a` | brass `#a2814a` | `logo-full.png` |
| Invitational | cream `#f5f0e2` / `#fbf8ef` | `#1f2419` | palm `#546434` | sombrero red `#b41c14` (sand `#c49c6c` for rules) | 1929 logo (`pasatiempo-logo-1929.png`) |
| Coastal | fog `#eef2f2` / `#f9fbfb` | `#14232e` | bay navy `#1f3b57` | sea blue `#3d6f8e` (sand `#d9c7a3` for rules) | `logo-full.png` |
| Evening | charcoal `#14191a` / `#1d2426` | `#ece6d6` | brass-light `#d4c29a` | brass `#c9a86a` | `pasatiempo-logo-1929-reverse.png` |

The exact hex values beyond Clubhouse and the Invitational's logo colours are
starting points — the builder tunes them against a contrast check (every
text/background pair ≥ 4.5:1, borders and bars ≥ 3:1) and shows Ian
screenshots of all four before the build is called done.

**Evening** is the one dark look, so it also overrides the status colours
(`--danger`, `--warn`, notice backgrounds, input backgrounds and borders,
focus ring) and the hero scrim. Any rule in `event-planner.css` under `.pub`
that hard-codes a light colour instead of a variable must be moved to a
variable as part of this work.

Clubhouse is literally today's values, so a null theme and `{preset:
"clubhouse"}` render identically.

### 3. Custom accent

- Editor: a colour input next to the preset choice, with "Use the look's own
  colour" to clear it.
- The accent replaces `--accent`/`--gold`/`--brass` and a derived
  `--brass-ink` (the accent darkened/lightened until it reaches 4.5:1 on the
  background, for small accent-coloured text).
- **Button text** is chosen automatically: near-black (`#111`) or white,
  whichever contrasts more, if it reaches 4.5:1. If neither does, the accent
  is nudged darker (on light looks) or lighter (Evening) in small lightness
  steps until one passes. The editor then shows the colour actually used and
  says: "Adjusted slightly so button text stays readable."
- Computed server-side in `theme.ts` (pure functions, unit-tested) so the page
  ships plain CSS variables — no client JS needed for colour.

### 4. Hero photo and focal point

- The hero becomes an `<img>` (not a CSS background) with
  `object-fit: cover; object-position: x% y%`, `fetchpriority="high"`, and an
  empty `alt` (decorative — the title is the heading).
- Editor: in the new Look section, the event's photos as thumbnails; tap one
  to make it the hero, then tap on the larger copy to set the focal point (a
  small crosshair marks it). Phone and desktop frames side by side show both
  crops.
- Scrim: the scrim is part of each preset. **Clubhouse keeps today's
  green-tinted 0.3 → 0.9 gradient exactly** (`event-planner.css` ≈ 969–976),
  so the null-theme rule holds. The other presets get a scrim tinted with
  their own primary/background colour, strong enough under the text for
  4.5:1 on any photo (dark at the text edge, fading toward the top). *Claude's
  call.*
- No photos → today's plain hero in the preset's primary colour.
- Deleting the hero photo in the Photos manager also clears `heroPhoto` in
  the editor's unsaved state (so Save can't write the deleted path back), and
  the page's parser falls back to the first photo if a stale path ever
  reaches the database.

### 5. Logo

- Library (fixed list, ids in `theme.ts`): club logo with wordmark
  (`logo-full.png`), 1929 logo (`pasatiempo-logo-1929.png` / `-reverse.png`),
  small mark (`logo-mark.png`), Events tile (`logo-events*.png`), brush-script
  wordmark (`invitational/img/wordmark-pasatiempo.svg`, cream — offered only
  for Evening, since it's light on transparent).
- Where a logo has a light and dark version, the page picks the one that suits
  the look (reverse on Evening).
- Upload: PNG/SVG/JPG up to 2 MB, stored in `event-photos/<eventId>/logo-*`
  through the same server action pattern as `uploadPhoto`. The file goes to
  storage on upload, but the event only points at it once the organiser
  presses Save (the theme saves with the event). On save, any other
  `logo-*` file in the event's folder that the theme no longer uses is
  deleted, which also cleans up uploads abandoned without saving. Like
  photos, upload is available once the event has been saved once (has an
  id). *Claude's call.*
- No automatic check that an uploaded logo suits the background: the
  editor preview shows it on the chosen look and the organiser judges.
  *Claude's call.*
- Shown in the top bar (`.pub-nav`) at today's size; max height capped so a
  tall upload doesn't push the page down. The footer keeps the club mark.

### 6. Editor: a "Look" section

New entry in `EDITOR_SECTIONS` (`lib/events/editor.ts`) between *Details* and
*Schedule*, rendered in `EventEditor.tsx`:

```
Look
  ( Clubhouse ) ( Invitational ) ( Coastal ) ( Evening )   ← swatch tiles
  Accent colour   [■ #b41c14]  Use the look's own colour
  Hero photo      [thumb][thumb][thumb]  · tap the large copy to set the focus
  Logo            [library tiles…]  [Upload]
  Contact for questions   name [      ]  email [      ]
```

The live preview (`components/events/editor/EditorPreview.tsx`) is today a
small mock (kicker, title, meta, form). The public page's **top bar, hero and
facts strip are pulled out into shared components** that both the page and
the preview render, so the preview shows the real logo, hero photo with its
focus and the look's colours rather than an approximation. *Claude's call.*
The phone/desktop crop frames for the focal point live in the Look section,
not the preview. Saving goes through the
existing save action; `buildEventInput`/`previewEvent` carry `theme`,
`contactName`, `contactEmail`.

### 7. The UX pass (all looks, both forms)

1. **Key facts under the hero**: date, time, place, price, spots left.
   Price shows the first price line **only when pricing is turned on**; with
   pricing off there is no price fact at all — the page never says "Free",
   since pricing off may just mean "charged to your account". *Claude's
   call.* When full:
   - waitlist on → the hero button and sticky bar read "Join the waitlist"
     and go to the form;
   - waitlist off (or a full tournament) → no Register button; the facts say
     "Full" and offer "Contact <name>" as a mailto link instead. *Claude's
     call.*
   When the roster cap is full the notice names the event's contact. Never a
   disabled dead-end button.
2. **Sticky Register bar on phones** (< 720px): appears once the hero's
   Register button scrolls out of view; hidden while the `#register` section
   is on screen or when registration isn't open. One button plus the spots
   line. A small client component using `IntersectionObserver`; respects the
   safe-area inset.
3. **Readable sizes**: body 17px on phones, inputs 16px minimum (stops iOS
   zoom), tap targets ≥ 48px with ≥ 8px between them (slot checkboxes,
   stepper buttons, links acting as buttons).
4. **Errors**: the form checks everything at once on submit. A summary box at
   the top of the form ("2 things to fix") with links to each field gets
   focus; each field shows its own message underneath and gets
   `aria-invalid` / `aria-describedby`. Server errors appear in the same box.
   The toast stays only for non-form messages.
5. **Confirmation**: after "You're registered!" — the date(s), time and
   place; **Add to calendar** (a Google Calendar link and a downloadable
   `.ics`, built client-side from the event and the chosen slots, in the
   club's time zone); **Change or cancel** (scrolls to the existing Manage
   Registration panel with the email just used already filled in; the
   member still presses Look up — *Claude's call*); "Questions? Contact <name>" with a mailto link.
   Waitlist confirmation gets the contact line, not the calendar.
6. **Button motion** (CSS only, in `event-planner.css`):
   - press: `transform: scale(0.97)`, 120ms ease-out; release back 160ms;
   - submitting: label stays, a spinner appears only if the request is still
     running after ~1s, and once shown stays ≥ 500ms;
   - success: the button morphs to a tick (~300ms) before the confirmation
     replaces the form;
   - transitions list their properties explicitly — never `transition: all`.
7. **Reduced motion**: under `prefers-reduced-motion: reduce`, movement and
   scale are replaced by a < 200ms opacity fade; states (pressed, busy, done)
   are still shown. The existing `.reveal` scroll-in follows the same rule.

## Testing

- Unit (vitest): theme parsing and fallbacks; contrast maths and accent
  nudging (including a pale yellow and a mid-grey that fail both ways);
  each preset's text pairs pass AA; `.ics` output (time zone, multi-slot);
  validation collecting all errors at once.
- Browser check of the Invitational and the Ladies clinic in each preset at
  phone and desktop widths, with and without reduced motion; screenshots to
  Ian.
- A null-theme event renders the same colours as today.

## Rollout

1. Ian runs `migration-event-looks.sql` in the Supabase SQL editor before the
   code deploys (the code must tolerate the columns being absent until then:
   treat a missing column as null).
2. Existing events keep Clubhouse. Ian sets the Invitational's look himself
   in the editor once it ships.

## Left to the builder

- Exact preset hex values (within the contrast rules) and the swatch-tile
  styling in the editor.
- File and component names beyond those given.
- How the focal-point picker draws its marker.
- Whether the sticky bar shows the price as well as spots left, space
  permitting.
