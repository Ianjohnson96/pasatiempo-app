# Merchandise Program redesign: a modern look, organized by job, interactive charts, Receiving and Season buys

Date: 2026-11-18 · Owner: Ian Johnson (pro shop) · Program: `merchandise/` (served at `/merch`)

## Intent

The Merchandise Program works, but it feels unorganized and plain. It is three tools in one — a **planning** tool
(budget, open-to-buy, forecast), an **analytical** tool (scorecard, brands, stuck money, trends) and a **daily
working** tool (orders, receiving, to-dos) — and today those are mixed together across 5 sections and ~19 pages,
with the same lists repeated in several places and prose where a chart would say more.

Make it more attractive (closer to the club's look, but its own), more visual (charts throughout, and charts you
can hover and click into), and organized by the job the merchandiser is doing. Fit how the shop actually works:

1. Ian and the reps place orders months ahead (the Order Book).
2. Boxes arrive and go to the store room. **Box-by-box check-off is not workable — too many boxes.**
3. The invoice goes to Chris or CJ; when time allows the goods are received into the POS, then repackaged or put
   on the floor. Until then the POS (and this program) doesn't know the goods are in the building.
4. A **receiving log** (an Excel spreadsheet) records what comes in. Ian will get access to it; its location and
   columns aren't known yet.

**Who uses it:** Ian (owner) at a desk; Chris and CJ (staff) at computers; Ken or Steve (view-only) occasionally.
It is a **desktop tool**. Phone use must still work (no broken layouts) but is not designed for.

## Goals

- A new look: the approved direction **"B · Pro shop modern"** (mockup:
  `.superpowers/brainstorm/1874-1794966732/content/visual-style.html`).
- A new organization: the approved sidebar (mockup: `.../content/organization.html`), 14 pages in 4 groups.
- Charts on the pages that are mostly prose or tables today, and every chart interactive (hover readout; click
  through to the detail behind it).
- A **Receiving** page that shows what has arrived but isn't in the POS yet, fed by a one-click "invoice in" on an
  order now, and by the receiving log later.
- A **Season buys** page: each season's buy, prebooked against held back, by brand and delivery month.

## Non-goals

- No change to the money math: the engine (`app/src/20-engine.js`, `pipeline/engine.py`), budgets, OTB, carry,
  analysis rules (`17-metrics.js`) and the month-end pipeline stay as they are. Pages may *read* new combinations
  of existing figures; they don't compute budgets differently.
- No rewrite into React/Next. The program stays plain JS assembled from `app/src/*.js` + `shell.html` (approach 1).
- No mobile-first design, no new roles, no changes to access rules beyond a new staff-writable field (below).
- Linking the receiving log itself is **not** in this build (its location and columns are unknown). This build
  leaves a clean place for it (see Receiving).

## Anti-goals (would make it a failure even if it works)

- Any budget, OTB or forecast number changes because of the redesign. The parity test
  (`lib/merch/engine-parity.test.ts`) and analysis tests must stay green with no fixture changes.
- Losing a feature: every current page's content must be reachable in the new structure (mapping below).
- Charts that look nice but hide the numbers: every chart keeps a "show the numbers" table or a readout.
- A heavier, slower page: no chart library or framework is added; charts stay hand-built SVG (`16-charts.js`).

## Constraints

- Plain browser JS, globals across files, file order by numeric prefix; `lib/merch/page.ts` assembles the page at
  request time. Styles live in `app/src/shell.html` (`:root` tokens, light and dark).
- Data comes only through the shim (`app/host/club-shim.js`) and `/merch/api/db`; staff can write only
  `STAFF_WRITABLE` collections (`lib/merch/rules.ts`), with shape checks in `docProblem`.
- Keep dark mode working (tokens are already defined for both).
- The page's own counts must keep matching: e.g. 83 orders, $62,167 Peter Millar committed.

## Approaches considered

1. **Redesign inside the current program — chosen.** New shell (sidebar), new tokens and components in
   `shell.html`, pages merged and moved, charts upgraded, two new pages added as new `app/src` files. Keeps the
   tested engine untouched. Moderate size; can be built and checked page by page.
2. **Rebuild as React/Next pages like the Lesson Book.** Most consistent with the hub, but a rewrite of ~3,300
   lines including the budget math, weeks of work and real risk to numbers the shop relies on. Rejected.
3. **Restyle only (CSS + sidebar).** Fast, but leaves the organization problem — the main complaint. Rejected.

Approach 1 was chosen by Claude after Ian handed over the how ("go ahead with the redesign").

## Decided with Ian

- Look: **B · Pro shop modern** — club green (`#173a2a`, from the Lesson Book) for the sidebar frame; crisp sans
  type (Inter); white rounded cards with a soft shadow; sparklines in headline tiles; brass (`#a2814a`) as the one
  accent for "new" and highlights; green/red pills for good/needs-attention.
- Organization, sidebar groups and pages:

| Group | Page | What's on it | Replaces today's |
|---|---|---|---|
| Every day | **Today** | Headline tiles with sparklines; the six most important decisions; overdue checklists; deliveries due in the next 30 days | Home; Budget's "top things"; the overdue banner on every page |
| | **Orders** | The order book, filter by vendor / season / month / status / category; totals by vendor at the top | Orders |
| | **Receiving** (new) | What's arrived but not in the POS; due this month; late; matched at month-end | receiving parts of Month-end and Orders |
| | **To do** | The full list, grouped and filterable (Most important at top stays) | To do |
| | **Vendors** | Vendor list (today a drawer) as a page | Vendors drawer |
| Plan & buy | **Budget & open-to-buy** | Room to buy by category × month, one grid + chart; click a category for its plan | Budget, Open-to-buy |
| | **Season buys** (new) | Per season: prebooked vs held back, by brand and delivery month | — |
| | **Forecast** | Unchanged content, restyled | Forecast |
| Analyse | **Scorecard** | Categories → subcategories → SKUs, role, grades, chart | Scorecard, Subcategories |
| | **Brands** | Scorecard and calls; Assign/Edit brands behind buttons | Brands |
| | **Stuck money & markdowns** | Over-target and aged stock, markdown candidates | Stuck money |
| | **Trends & rounds** | Trends, seasonality, spend per round | Trends, Spend per round |
| Month-end | **Upload & close** | Upload, checklist, reporting calendar, how it works | Month-end, Checklists, How it works |
| | **Counts** | Quarterly counts, on hand by category | Inventory & counts |

- Desktop first; the sidebar collapses to a top menu button under ~900px wide.

## Design

### Shell and look
- Replace the band + header + pill-tabs with a fixed left **sidebar** (≈220px): "Pro Shop" title, the four groups,
  each page with a live count badge where it has one (Today = open decisions, Orders = open orders, To do = open
  items, Upload & close = checklist items left; red when something is overdue). Signed-in person and Tools menu at
  the bottom; "Club Hub" link at the top.
- Main area: page title + one-line description + page actions (e.g. `+ New order`) in a header row; the fiscal-year
  and month pickers only on pages that use them (Budget & OTB, Orders, Season buys), not globally.
- Tokens: rework `:root` in `shell.html` to the B palette (light + dark). Cards: white, 10px radius, soft shadow;
  tables: quieter rules, sticky header, tabular numbers; pills for status/calls.
- Navigation state stays in `TAB` and `localStorage` (`ob.tab2`); old tab ids map to new pages so saved state and
  links (`data-tab="…"`) keep working.
- *Claude's call:* everyone opens on **Today** the first time (staff included; Today shows the receiving backlog and
  due deliveries). View-only users see no action buttons (Invoice in, Clear, + New order), as with other actions.

### Charts
- Keep `16-charts.js` (SVG). Add: a shared hover readout (a small floating card, from the existing `data-cvt`/`data-cv`
  attributes) for every chart; click handlers (`data-go="tab:key"`) so a bar/point opens its detail (a category bar
  opens that category; a brand point opens the brand; a month opens that month on Budget & OTB).
- New charts where today there's prose or a bare table: Today (sales by month, room-to-buy by month), Budget & OTB
  (stacked committed vs room by month per category), Orders (deliveries by month by vendor), Receiving (backlog by
  vendor), Season buys (prebooked vs held back per season), Counts (book vs counted).

### Receiving (new)
- Each order gets staff-settable **invoice-in** entries: `invoicesIn: [{date, by, amount?, invoice?, note?, source}]`
  on the `pos/{id}` document (named `invoicesIn`, not `arrivals`, to avoid confusion with the month-end
  `arrivals/{asOf}` collection). `source` is `"hand"` now and `"log"` when the receiving log is linked. Staff can
  already write `pos`; extend `docProblem` to check the shape (date required, amount a number if present).
- **Amount is optional (decided with Ian):** one click marks the whole open balance arrived; typing the invoice $
  records a partial shipment. Arrived $ for an order = sum of entry amounts, an entry without an amount counting as
  the open balance at that time (capped at the order's open balance).
- States: **Due** (open, delivery month ≤ this month, nothing arrived) · **Arrived, not in POS** (arrived $ greater
  than what month-end has recorded as received) · **Received** (status `received`, or month-end `received` $ ≥
  arrived $, or someone pressed **Clear**). *Claude's call:* month-end matching (`matchArrivals`, `77-receiving.js`)
  is **not** changed and does not prioritise orders with invoices in, so each order's `received` figure — and every
  budget number — stays exactly as today.
- **Clear** (staff and owner) only removes an order from the store-room list (`invoicesClearedAt`); it never sets
  `received` or `receipts`. The existing "Record delivery" dialog stays where it is for changing money.
- The page: backlog at cost by vendor (chart), then the list, oldest first, with days waiting.
- The receiving log, when linked later, writes the same `invoicesIn` entries (source: "log"); no page change needed.
- Budget effect: none (arrived goods stay "committed" until received, as today). Shown as information.

### Season buys (new)
- Seasons by delivery month: Spring = Jan–Apr, Summer = May–Jul, Fall = Aug–Oct, Holiday = Nov–Dec (Claude's call;
  editable later). For each season: committed at cost by brand and by month (from the Order Book), against the
  season's share of the plan's room; "held back" = room not yet committed. Read-only; uses existing figures
  (`roomThrough`, `committedIn`-style sums), no new budget math.
- *Claude's calls:* **prebooked** = orders whose `orderDate` is before the season's first month; orders placed
  during the season are **reorders** (shown separately). Room and "held back" exist by category and season only
  (the plan has no brand budgets); brand rows show committed only. Special Orders (640) are left out. Past and
  current seasons include goods already received.

### Merges
- Budget + Open-to-buy: one page — the category cards become a compact table with a bar per row, the OTB grid sits
  behind a "Month by month" toggle, the classic worksheet behind "Worksheet".
- Scorecard + Subcategories: the scorecard rows expand to subcategories (as now) and a subcategory opens its SKU
  list (today's Subcategories detail).
- Upload & close: upload panel, then this month's checklist, then the calendar, then "How it works".

## Left to the builder
- Exact spacing, sizes and component names; the order of building pages (suggested: shell + tokens → Today →
  Orders → Budget & OTB → Receiving → the rest).
- How each merged page lays out its existing pieces, as long as nothing is lost.
- Tests: keep all existing ones green; add tests for the Receiving state logic and `docProblem` on `invoicesIn`, and
  for the old-tab-id mapping.
