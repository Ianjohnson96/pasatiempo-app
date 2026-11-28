# Pasatiempo app — notes for Claude

## Brand assets

The club's official logo — the palm, the sleeping figure in the red sombrero,
and the founding year **1929** beneath — lives in `public/brand/`:

- `pasatiempo-logo-1929.png` — the logo as supplied by the club (full colour,
  black outlines and black "1929", transparent background, 1150×2000). Use it on
  light backgrounds.
- `pasatiempo-logo-1929-reverse.png` — the same logo for dark backgrounds and
  photographs: the black outlines and "1929" turned cream (#f5f0e2); the palm,
  hat and figure keep their colours. Made from the original, not redrawn.

Logo colours (sampled from the artwork): palm green `#546434`, sand `#c49c6c`,
sombrero red `#b41c14`, outline black.

The wordmark "Pasatiempo" in the logo's own brush script, traced to vector from
`public/logo-full.png`, is `public/invitational/img/wordmark-pasatiempo.svg`
(filled cream, for dark backgrounds). It is not a standard font — use the SVG
rather than substituting a typeface.

Other logo files: `public/logo-full.png` (logo + wordmark, no year),
`public/logo-mark.png` (small, no wordmark), `public/logo-events*.png` (the
red Events tile).

The club's full brand guide has not been added to the repository yet; if it
turns up, put it in `public/brand/` and summarise its rules here.

## Event photographs (Men's Club Invitational)

Photographs from past Invitationals, supplied by the club, live in
`public/invitational/img/event/`: each as the full-size original
(`<name>.jpg`) and a light 1000px copy for grids (`<name>-1000.webp`). The
list the home page's "Scenes from the Invitational" gallery shows is
`GALLERY` in `components/invitational/content.ts` — add a photograph by adding
both files and a line there. Use these for any later page, card or intro.

## The Invitational intro

The opening title sequence on the Invitational page is
`components/invitational/IntroReel.tsx`. The one visitors get is
`DEFAULT_VARIANT`; every other cut still plays with `?intro=<name>`.

- **Default: `somewhere`** — cut to Keane's "Somewhere Only We Know" with its
  first chorus (`public/invitational/audio/intro-somewhere-lyrics.mp3`, 48 s):
  the opening piano, the first chorus, the song's ending. Twenty shots,
  photographs and three drone flyovers (`public/invitational/video/intro/`),
  timed to the words; all in colour, no year card, ending on the clock. The
  shots are named in `SHOT` (the names on the running-order board); the cut,
  its cues and the reasoning are in the comment above `SONG_LYRICS_CUES`.
- **Earlier defaults, kept:** `somewhere-37` (37 s, the song's last chorus
  only) and `score` (the twelve-photograph scored dissolve to "A Perfect Day",
  1929 photographs and year card). To revert, set `DEFAULT_VARIANT` to either.

The club holds the licence for the Keane recording (confirmed November 2026).
