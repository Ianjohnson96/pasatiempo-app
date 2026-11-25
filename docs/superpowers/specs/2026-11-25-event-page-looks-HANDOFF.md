# Handoff: member sign-up page — a look per event + UX pass

Date: 2026-11-25 · Owner: Ian Johnson · Status: **design in progress, nothing built**

This note carries a cloud session's work to a session on Ian's computer. The
next step is to finish the design doc (below is everything decided so far),
get Ian's approval, then plan and build.

## What Ian asked for

Improve the Event Planner's **members' sign-up page** (`/events/e/<slug>`,
`app/events/e/[slug]/page.tsx`) visually, practically and in UX, with some
button animation. Every future event page must be customisable: **a look per
event — colours, hero photo and logo.**

## Decided

- **Approach C (Ian picked it):** preset looks + an optional custom accent.
  - Presets, each a full colour set + default logo. Proposed: *Clubhouse*
    (today's ivory / club green / brass — the default, so existing events look
    the same), *Invitational* (palm green `#546434`, sombrero red `#b41c14`,
    sand `#c49c6c`, cream `#f5f0e2`, brush-script wordmark). Others to propose
    to Ian, e.g. *Coastal* (Monterey Bay blues) and *Evening* (dark, for
    dinners).
  - Custom accent: the page picks black or white button text automatically
    (≥ 4.5:1); if neither passes, nudge the accent darker/lighter and warn the
    organiser in the editor.
  - Logo: from the club library (`public/brand/pasatiempo-logo-1929*.png`,
    `public/logo-full.png`, `public/logo-mark.png`, `public/logo-events*.png`,
    `public/invitational/img/wordmark-pasatiempo.svg`) or an upload.
  - Hero photo: chosen from the event's own photos (today it's always
    `photos[0]`), with a focal point so faces aren't cropped.
- **Scope:** the public page only. Admin screens, emails, per-event fonts and
  section re-ordering are out.

## Proposed (Ian hasn't confirmed these yet)

- Storage: one new `theme jsonb` column on `events.events`
  (`{ preset, accent, heroPhoto, heroFocus, logo }`), null = Clubhouse.
  Migration as a hand-run SQL file in `supabase/` (repo convention).
- The `.ep` tokens in `app/event-planner.css` are already CSS variables, so a
  theme is a set of variable overrides on the `.pub` wrapper.
- A new "Look" section in the editor (`components/events/EventEditor.tsx`,
  sections in `lib/events/editor.ts`), reflected in the live preview.
- Replace the hard-coded contact email in the "roster full" notice on the
  public page with a per-event contact (defaulting to Ian).

## Research findings to design against

1. Keep sign-up short; optional questions after confirmation.
2. Single page for dinners/clinics; tournament keeps member+guest blocks.
3. Sticky Register bar on phones once the hero button scrolls away; hide it
   when the form is on screen.
4. Key facts (date, time, place, price, spots left) right under the hero;
   when full, offer the waitlist, never a dead button.
5. Confirmation: add to calendar (Google link + .ics), "change or cancel",
   practical details.
6. Tap targets ≥ 48px, 8px apart; body text 17–18px; inputs ≥ 16px (stops
   iOS zoom).
7. Errors: summary at top with focus + message by each field.
8. Button press `scale(0.97)` 100–160ms ease-out; spinner only after ~1s,
   held ≥ 500ms; ~300ms morph to a tick on success. Never `transition: all`.
9. Reduced motion: swap movement for a < 200ms fade, don't strip state.
10. Hero: dark scrim under text (~0.6 → 0), focal point as x/y %, applied
    with `object-position`.

Sources: Eventbrite, Baymard, Golf Genius help, NN/g, GOV.UK design system,
WCAG 2.2 SC 2.5.8, emilkowal.ski, WebKit `contrast-color()`.

## Environment notes

- Planner database: Supabase project **pasatiempo-events**
  (`whzelknnxvooguvbajap`), schema `events`. Live events today: the 2027
  Men's Club Invitational (tournament, open, 60 teams) and the Ladies Intro to
  Golf Fall Clinic (slots, closed, 25 sign-ups).
- Running the pages needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

## Next steps

1. Finish the full design doc as
   `docs/superpowers/specs/2026-11-25-event-page-looks-design.md`, with Ian
   confirming the "Proposed" items and the preset list.
2. Builder check, Ian's approval, then a plan (superpowers:writing-plans).
