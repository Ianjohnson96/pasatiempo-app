# Merchandise Program: analysis section and reorganization

Date: 2026-09-29 · Status: awaiting review

## Why

The program holds rich data but shows it as scattered tabs and tables. The owner wants to read it like a financial analyst for a top-100 course. That means a one-page summary on top, deep analysis underneath, every category and subcategory compared side by side, charts, clear suggestions with dollar impact, a consistent layout on every page, and no table that overflows.

## Readers

- **The owner, while buying (weekly):** detailed analysis and ranked suggestions.
- **The GM or board (monthly):** the Summary page, printable.

## Decisions

- Comparisons: **this year against last year**, plus **industry rules of thumb**. The rules of thumb are labelled as general guidelines, not club targets. No club targets for now.
- All analysis is **calculated in the page** from documents it already loads (`base/current`, `assort/current`, `inventory/current`, `brands/current`, `skuhist/*`, `insights/current`, `pos/*`). No pipeline or upload changes, and no new documents.
- Charts are **inline SVG drawn by the page's own helpers**. No external chart library.
- Suggestions are **rule-based**, ranked by dollar impact, each with a one-sentence reason. No AI text.

## Navigation

Four sections, in one row at every width, replacing today's five tabs plus More. Each section's pages appear as a wrapping row of pills. Nothing scrolls sideways.

| Section | Pages |
|---|---|
| Summary | (single page) |
| Analysis | Scorecard · Spend per round · Trends · Stuck money · Brands |
| Buying | Open-to-buy · Forecast · Orders · Vendors · To do |
| Operations | Month-end · Reports · Inventory & counts · Subcategories · How it works |

Existing page ids keep working: saved tabs and the `#reports` email link resolve to their new section. Vendors opens as a page within Buying, reusing today's drawer content.

## Page layout (every page)

1. Title and a one-line purpose (already in place).
2. **Headline figures**: 3–6 tiles, each with its value, its change against last year (▲/▼ and %), and a benchmark marker (within / near / outside the rule of thumb).
3. **Charts**.
4. **Detail table** inside a card. The table scrolls sideways within the card, the first column stays put, and the page never widens.

## Metrics (defined once, used everywhere)

These are per category, per subcategory, and for the shop as a whole. Figures are for the last 12 months (T12) unless stated otherwise.

- Sales T12, and growth against the prior 12 months (from `cats[c].hist`/`act`). For subcategories: the 3-month trend `ty/ly` from `assort`.
- Share of sales, and share of stock at cost.
- Gross margin % (`gm`), and markdown % (`md`).
- Turns = cost of sales T12 ÷ stock on hand at cost. Weeks of supply = 52 ÷ turns.
- GMROI = gross margin $ T12 ÷ stock on hand at cost.
- Aged % = stock unsold for 12 months or more ÷ stock on hand.
- Sales per round = shop sales ÷ total rounds, by month, with member, guest and public rounds shown.

Rules of thumb (one editable list in the code, shown in a "Benchmarks" note):

| Metric | Guideline |
|---|---|
| Turns | 2–3 a year for apparel; 3–4 for balls and gloves |
| GMROI | above 2 for apparel and accessories; above 1 for equipment |
| Markdowns | under 15% of sales |
| Aged stock | under 10% of stock |
| Weeks of supply | 12–16 |
| Margin | apparel 45%+, accessories 40%+, equipment 25%+ |

## Pages

**Summary**
- Tiles: sales T12 against last year, gross margin %, turns, GMROI, aged %, sales per round.
- Chart: sales by month, this year against last year (bars and a line).
- Category health strip: one cell per category, coloured by how many benchmarks it misses.
- The top 5 suggestions, with dollar impact.
- Print styles.

**Analysis › Scorecard**
- Category table; each row opens to its subcategories.
- Columns: sales, growth, share of sales, share of stock, margin, markdowns, turns, GMROI, weeks, aged %.
- Heat-map shading against the benchmarks.
- A share-of-sales vs share-of-stock bar for each category.
- A scatter of growth (x) against GMROI (y), with quadrants labelled Grow / Fix / Harvest / Exit.

**Analysis › Spend per round**
- Monthly sales per round, this year against last year.
- A stacked bar of rounds by type.
- Spend per member round.
- Best and worst months.

**Analysis › Trends**
- 24-month line for each category; a small chart per category, with the shop total on top.
- Seasonality: each month's share of annual sales.
- A "buy for" note: the peak months, with orders landing 1–2 months before.

**Analysis › Stuck money**
- Stock over the 16-week target by category, in $.
- Aged stock by category and subcategory, and the top aged SKUs.
- Markdown candidates, with the estimated cash freed at a 30% markdown.
- Out of stock or under 4 weeks of supply while still selling: reorder candidates.

**Analysis › Brands** is today's scorecard, moved here.

**Suggestions engine**
- One function returns `{title, why, impact$, action, where}`.
- Rules:
  - stock share far above sales share;
  - aged above 10%;
  - markdowns above 15%;
  - weeks above 30;
  - growth above 15% with under 8 weeks of supply;
  - GMROI below the guideline;
  - a subcategory declining 25% or more with stock on hand.
- Ranked by `impact$`. Shown on Summary (top 5) and on each Analysis page (filtered to that page).

## Files

- `merchandise/app/src/16-charts.js`: SVG helpers for bar, line, stacked bar, scatter, sparkline and heat cell, each with a hover readout, using the colour tokens.
- `merchandise/app/src/17-metrics.js`: metric calculations, rules of thumb, and the suggestions engine.
- `merchandise/app/src/35-summary.js` and `36-analysis.js`: the new pages.
- `30-home.js`: the four-section navigation.
- `shell.html`: the tile, chart and table layout, and print styles.
- Existing pages get the tile/chart/table layout where it fits.
- Tests: metric and suggestion calculations checked with vitest against a small made-up data set (`lib/merch/analysis.test.ts`, loading `17-metrics.js`).

## Verification

- Every page checked at 375, 768 and 1280 px with no sideways page scroll. Charts render in light and dark mode.
- The headline figures reconciled by hand against the Sep 30, 2026 data: sales, stock and aged stock match the Inventory page and the upload.

## Not included

Club targets, AI-written commentary, and pipeline or upload changes.
