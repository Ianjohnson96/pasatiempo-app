# Merchandise analysis and reorganization: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Summary and Analysis pages (scorecard, spend per round, trends, stuck money) with charts and ranked suggestions, and regroup the program into four sections that never scroll sideways.

**Architecture:**
- Everything is calculated in the browser from `assort/current`, which is already loaded as `ASSORT`: one row per category and subcategory, with 24 monthly sales values (`series`), `t12`, `oh`, `aged`, `gm`, `md`, `ty`/`ly` and `agedSkus`.
- Round counts come from `base/current` (`BASE.rounds`, keyed by calendar year, 12 values from Jan to Dec).
- Metrics live in a pure file (`17-metrics.js`) that the tests load through `vm`.
- Charts are SVG strings from `16-charts.js`.
- Pages are rendered by the new `35-summary.js` and `36-analysis.js`.

**Tech stack:** plain browser JS assembled by `lib/merch/page.ts`, and vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-merch-analysis-design.md`

## Global constraints

- Special orders (640) are excluded from every metric.
- Sales are at retail; stock is at cost.
- The rules of thumb are labelled "rules of thumb, not club targets".
- No page scrolls sideways at 375, 768 or 1280 px. Only a table card may scroll, inside itself.
- No new data documents, no pipeline changes, and no external libraries.

## Review focus

1. **No `ASSORT` yet** (before the first upload): every new page shows the "appears after the next month-end upload" note and doesn't throw. Test: `analyze(null)` returns `null`.
2. **Zero stock or zero sales rows:** turns, weeks and GMROI are `null` rather than `Infinity`/`NaN`. Test: `oh: 0` gives `gmroi === null`.
3. **Rounds missing for a month** (the future months of 2026 are 0): spend per round is `null` for that month, not `Infinity`. Test.
4. **Saved tab ids from before the change** (`overview`, `vendors`, `help`): each lands in its section. Checked in the browser.
5. **Long subcategory names and 13-row categories on a phone:** tables scroll inside their card. Checked with a scroll-width check on every page.

---

### Task 1: Metrics and suggestions (`17-metrics.js`)

**Files:**
- Create: `merchandise/app/src/17-metrics.js`
- Test: `lib/merch/analysis.test.ts`

**Interfaces (produced):**
- `BENCH`: the rules of thumb (see the spec table).
- `SEGOF(code)` returns `'apparel' | 'accessories' | 'equipment'`:
  - equipment: 160, 200, 220, 300, 320, 350
  - accessories: 440, 620, 660
  - apparel: 400, 430, 470, 480, 490, 500
- `analyze(assort, catNames)` returns `null` or `{months, shop, cats}`.
  - Each figure set `M` holds `{key, name, cat, sub, t12, prior12, growth, trend3, share, stockShare, oh, aged, agedPct, gm, md, gp, turns, wks, gmroi, series}`.
  - `cats[]` are `M` plus `subs: M[]`.
  - The 640 rows are dropped.
  - `growth` is `t12/prior12 - 1` only when `prior12 >= 500`; otherwise `null`.
  - `turns`, `wks` and `gmroi` are `null` when `oh <= 0` or cost of sales is `<= 0`.
- `grade(metric, value, seg)` returns `'good' | 'near' | 'bad' | null`.
- `perRound(ana, rounds)` returns `[{month, sales, rounds, member, guest, public, spr, sprLY}]` for the 24 months. `spr` is `null` when the month has no rounds.
- `seasonality(ana)` returns 12 shares (January to December) from the last 12 months.
- `stuckMoney(ana)` returns `{overstock: [{M, excess}], aged: [{M, aged}], agedSkus: [...], markdown: [{M, cashAt30}], reorder: [M]}`.
  - `excess = oh − 16 weeks of cost of sales`.
  - `cashAt30 = aged ÷ (1 − gm) × 0.7`.
  - `reorder` is subcategories with `wks < 4` and `t12 >= 2000`.
- `suggest(ana)` returns `[{id, title, why, impact, action, page, cat, sub}]`, sorted by `impact` from highest. The rules and their impact dollars:
  - Stock share more than 5 points above sales share: excess over a sales-proportional share of stock.
  - Aged over 10%: the aged dollars.
  - Markdowns over 15%: `t12 × (md − 0.15)`.
  - Weeks over 30: the excess stock.
  - Growth over 15% with fewer than 8 weeks of supply: sales lost at the current pace, `t12 ÷ 52 × (12 − wks)`.
  - GMROI under the guideline, with stock over $5k: `oh × guideline − gp`.
  - A subcategory whose 3-month trend is −25% or worse, with stock over $2k: the stock dollars.

- [ ] Write the test file. It loads `17-metrics.js` with `vm.runInNewContext(src + ';({BENCH,SEGOF,analyze,grade,perRound,seasonality,stuckMoney,suggest})')` on a made-up `assort` with two categories, three subcategories, one 640 row and one zero-stock row. It asserts:
  - the 640 row is excluded;
  - `cats[0].t12` is the sum of its subcategories;
  - `share` adds up to 1;
  - the zero-stock row has `gmroi === null`;
  - `analyze(null) === null`;
  - a month with 0 rounds has `spr === null`;
  - `suggest` puts the aged-heavy subcategory first, with `impact` equal to its aged dollars;
  - `grade('agedPct', 0.25, 'apparel') === 'bad'`.
- [ ] Run `npx vitest run lib/merch/analysis.test.ts`. It should fail because `17-metrics.js` doesn't exist.
- [ ] Implement the functions. They use no DOM, and none of the page's globals apart from what's passed in.
- [ ] Run it again. It should pass.
- [ ] Commit.

### Task 2: Charts (`16-charts.js`) and hover readout

**Files:**
- Create: `merchandise/app/src/16-charts.js`
- Modify: `15-tips.js`, so that elements with a `data-cv` attribute show their text in `#tip` on hover, focus or tap.

**Produces** (each returns an SVG string with `viewBox`, `width: 100%` and fills from CSS variables; every mark carries `data-cv="label: value"`):
- `chBars({labels, series: [{name, values, tone}], fmt, h = 220})`: grouped bars. `tone` is one of `cypress | fog | ochre | brick | faint`.
- `chLine({labels, series, fmt, h})`
- `chStack({labels, series, fmt, h})`
- `chScatter({points: [{x, y, r, label, tone}], xFmt, yFmt, xRef, yRef, quads: [tl, tr, bl, br], h})`
- `chSpark(values, {w = 120, h = 28})`
- `chLegend(series)`: HTML.

- [ ] Implement it, following the `dataviz` skill: a small palette, direct labels, gridlines only on the y axis, and axis labels rounded with `moneyK`.
- [ ] Commit.

### Task 3: Four-section navigation

**Files:** modify `30-home.js` (`renderTabs`, `TABHEAD`), `90-io.js` (`PAGES` and the tab click), and `shell.html` (styles).

- `SECTIONS = [['summary', 'Summary', ['summary']], ['analysis', 'Analysis', ['scorecard', 'rounds', 'trends', 'stuck', 'brands']], ['buying', 'Buying', ['overview', 'otb', 'forecast', 'orders', 'vendors', 'attention']], ['ops', 'Operations', ['monthend', 'reports', 'inventory', 'subcats', 'help']]]`.
- `overview` becomes "Budget", the first page in Buying.
- `vendors` stays a pill that opens the existing drawer.
- The section row is a 4-column grid at every width. The page row is wrapping pills with counts and badges.
- An unknown saved `TAB` falls back to `summary`, which is also the default.
- Remove the More-menu code and the `#tabPop` entry in `POPS`.
- [ ] Implement it, check it in the browser, and commit.

### Task 4: Summary page (`35-summary.js`)

- `renderSummary2()`. `renderSummary` already exists for the overview.
- Six tiles: sales T12 with growth, gross margin %, turns, GMROI, aged %, and sales per round (last 12 months against the 12 before). Each has a grade marker.
- `chBars`: the last 12 months against the same months a year earlier.
- A category health strip: cells coloured by how many of `grade(...)` over agedPct, gmroi, md and wks come back `bad`. Clicking a cell opens the Scorecard.
- The top 5 `suggest()` entries.
- A "Print" button and `@media print` rules that hide the band, tabs and actions.
- [ ] Implement it, check it in the browser, and commit.

### Task 5: Analysis pages (`36-analysis.js`)

- `renderScorecard()`:
  - Tiles, then the scatter (growth against GMROI, bubble size = t12, quadrant lines at growth 0 and GMROI 2).
  - The table: category rows with `data-anacat` that open to their subcategory rows. Heat-map shading comes from `grade`, and each row has a stock-vs-sales share bar.
  - Filtered suggestions follow.
- `renderRounds()`: tiles (spend per round T12, spend per member round, the best month), a line chart of spend per round this year against last year, a stacked bar of rounds by type, and a monthly table.
- `renderTrends()`: a shop 24-month line, a grid of small charts for each category (sparkline plus T12 and growth), and a seasonality bar chart with a "buy for" note (the top 3 months, landing a month earlier).
- `renderStuck()`: tiles (overstock $, aged $, cash at 30% off, reorder count), a bar chart of overstock and aged stock by category, then tables of the top aged SKUs (from `agedSkus`), markdown candidates and reorder candidates.
- Every page shows the rules-of-thumb note, and the "appears after the next upload" note when `ASSORT` is missing.
- [ ] Implement it, check it in the browser, and commit.

### Task 6: Consistent layout and overflow fixes

- Shared classes in `shell.html`:
  - `.tiles`: an auto-fit grid, minimum 150px.
  - `.chart-card`
  - `.tbl`: `overflow-x: auto; max-width: 100%`, with the first column sticky.
  - `.heat-good`, `.heat-near`, `.heat-bad`
- Apply `.tbl` wrappers to every existing table that is missing one: forecast, OTB, month-end, subcategories and inventory.
- Run a script that visits all pages at 375, 768 and 1280 px and reports `scrollWidth > clientWidth`. Fix each one until all report none.
- [ ] Implement it, verify it, and commit.

### Task 7: Ship

- [ ] Run `npx vitest run` and `python -m pytest merchandise/pipeline`. Both must pass.
- [ ] Check in the browser with a data snapshot: every page, light and dark mode, and a phone.
- [ ] Update `merchandise/README.md`: Pages table and a Benchmarks note.
- [ ] Commit, push to `main`, and confirm that Vercel's status is `success`.
