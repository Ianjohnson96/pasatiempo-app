# Merchandise Program Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle and reorganize the Merchandise Program (`/merch`) into a sidebar app grouped by job, with clickable charts, a new Receiving page and a new Season buys page, without changing any budget number.

**Architecture:** Stay in the plain-JS page (`merchandise/app/src/*.js` joined in filename order + `shell.html`, assembled by `lib/merch/page.ts`). Add two pure, test-loaded files (`18-ops.js`, `25-nav.js`), rework the shell and tokens, add page renderers, and route old tab ids to new pages. The engine (`20-engine.js`), analysis (`17-metrics.js`) and pipeline are not touched.

**Tech Stack:** Browser JS (globals, no framework), hand-built SVG charts (`16-charts.js`), vitest (`lib/merch/*.test.ts`, loading page files with `node:vm`), Next.js route serving the page, Supabase docs via `/merch/api/db`.

**Spec:** `docs/superpowers/specs/2026-11-18-merch-redesign-design.md`

## Global Constraints

- No budget, OTB or forecast number may change: `lib/merch/engine-parity.test.ts`, `lib/merch/analysis.test.ts`, `merchandise/pipeline` pytest stay green with no fixture edits; `20-engine.js`, `17-metrics.js` money logic, `77-receiving.js` `matchArrivals` unchanged.
- `shell.html` must keep the literal `<div class="wrap">`: `lib/merch/page.ts` splits head/body there.
- No new libraries or frameworks; charts stay SVG in `16-charts.js`. Hover readouts already exist (`data-cvt`/`data-cv`, shown by `15-tips.js`).
- Look "B · Pro shop modern": sidebar `#173a2a` (hover/active `#21503a`), accent brass `#a2814a`, type Inter (Google Fonts, weights 400/500/600/700), IBM Plex Mono kept only for tabular numbers, cards white, radius 10px, shadow `0 1px 2px rgba(0,0,0,.06)`, page background `#f4f6f5`. Light and dark tokens both defined.
- Sidebar groups and page ids (labels exact):
  - Every day: `today` "Today", `orders` "Orders", `receiving` "Receiving", `attention` "To do", `vendors` "Vendors"
  - Plan & buy: `overview` "Budget & open-to-buy", `seasons` "Season buys", `forecast` "Forecast"
  - Analyse: `scorecard` "Scorecard", `brands` "Brands", `stuck` "Stuck money & markdowns", `trends` "Trends & rounds"
  - Month-end: `monthend` "Upload & close", `inventory` "Counts"
- Old ids route: `summary`→`today`, `otb`→`overview` (view `months`), `subcats`→`scorecard`, `rounds`→`trends`, `reports`→`monthend`, `help`→`monthend`. Saved `localStorage` `ob.tab2` and every `data-tab="old"` keep working.
- First visit opens `today` for every role. Viewers see no action buttons (`canAct()` false).
- Desktop first; under 900px wide the sidebar becomes a top bar with a menu button.
- Receiving data: `pos/{id}.invoicesIn: [{date:'YYYY-MM-DD', by, amount?:number, invoice?:string, note?:string, source:'hand'|'log'}]`, `pos/{id}.invoicesClearedAt?: ISO string`. Never sets `received`/`receipts`.
- Seasons by delivery month: Spring Jan–Apr, Summer May–Jul, Fall Aug–Oct, Holiday Nov–Dec. Prebooked = `orderDate` before the season's first month; otherwise Reorder. Special Orders (640) excluded.

## Review Focus

- An order with `invoicesIn` but already `status:'received'` → shows Received, not in the store-room backlog (test in Task 2).
- An invoice amount larger than the open balance, or two clicks with no amount → arrived value capped at the order's open balance, never double-counted (test in Task 2).
- An order with no `orderDate` or no `deliveryMonth` → Season buys treats it as Reorder / no season rather than throwing (test in Task 2).
- A saved `ob.tab2` of a page that no longer exists (`subcats`, `help`, garbage) → lands on the mapped page or `today`, never a blank pane (test in Task 1).
- A viewer (Ken/Steve) opening Receiving → sees the list, no Invoice in / Clear buttons (checked in Task 6 browser step).

---

### Task 1: Navigation model and routing

**Files:**
- Create: `merchandise/app/src/25-nav.js` (pure; no page globals)
- Modify: `merchandise/app/src/10-core.js:62-63` (`FIRST_TAB`, `TAB` load), `merchandise/app/src/90-io.js:113-136` (`PAGES`, `render`), every `TAB = …`/`data-tab` click handler in `90-io.js` and `35-analysis.js:203`
- Test: `lib/merch/nav.test.ts`

**Interfaces:**
- Produces: `NAV` = `[{key:'daily', label:'Every day', pages:[['today','Today'],…]}, {key:'plan',…}, {key:'analyse',…}, {key:'close',…}]` (groups/labels from Global Constraints); `TAB_ALIAS = {summary:'today', otb:'overview', subcats:'scorecard', rounds:'trends', reports:'monthend', help:'monthend'}`; `resolveTab(id: string): string` (alias → id, unknown → `'today'`); `pageLabel(id): string`; `pageGroup(id): string`; `parseGo(s: string): {tab: string, key: string|null}` for `data-go="tab:key"`; in `90-io.js`: `goTab(id: string, key?: string)`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test** `lib/merch/nav.test.ts` (load `25-nav.js` with `vm.runInNewContext(src + ';({NAV,TAB_ALIAS,resolveTab,pageLabel,pageGroup,parseGo})')` as `analysis.test.ts` does):
  - `resolveTab('summary')==='today'`, `resolveTab('otb')==='overview'`, `resolveTab('subcats')==='scorecard'`, `resolveTab('rounds')==='trends'`, `resolveTab('help')==='monthend'`, `resolveTab('reports')==='monthend'`, `resolveTab('nonsense')==='today'`, `resolveTab('')==='today'`, `resolveTab('brands')==='brands'`
  - `NAV.flatMap(g=>g.pages).length===14`; ids equal the 14 in Global Constraints, in order
  - `pageLabel('overview')==='Budget & open-to-buy'`, `pageGroup('receiving')==='daily'`
  - `parseGo('overview:480')` → `{tab:'overview', key:'480'}`; `parseGo('brands')` → `{tab:'brands', key:null}`
- [ ] **Step 2: Run** `npx vitest run lib/merch/nav.test.ts` → FAIL (file missing).
- [ ] **Step 3: Implement `25-nav.js`, then wire it:** `10-core.js` `FIRST_TAB = 'today'`; `TAB` = `resolveTab(saved || 'today')`; `90-io.js` routes every tab change through `goTab(id, key)` (sets `TAB = resolveTab(id)`, stores `ob.tab2`, and when the incoming id was `otb` sets the Budget view to `months`, see Task 4's `BV`). `PAGES` gains `today`, `receiving`, `seasons`, `vendors`, each pointing at a `renderSoon` stub ("Coming in this build") until its task lands.
- [ ] **Step 4: Run** `npx vitest run lib/merch` → all pass.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: one navigation model, old page links routed to the new pages"`

### Task 2: Pure receiving and season logic

**Files:**
- Create: `merchandise/app/src/18-ops.js` (pure)
- Modify: `lib/merch/rules.ts` (`docProblem` case `pos`: `invoicesIn` must be an array of objects with `date` matching `YYYY-MM-DD`, `amount` passing `isNum`, `source` in `hand|log`; `invoicesClearedAt` a string or absent)
- Test: `lib/merch/ops.test.ts`, `lib/merch/rules.test.ts`

**Interfaces:**
- Produces:
  - `arrivedValue(invoicesIn: Entry[], openValue: number): number` — sum of `amount`s, an entry without `amount` counting as the whole `openValue`; result capped at `openValue`, floored at 0.
  - `rcvState(o: {status, deliveryMonth, invoicesIn, invoicesClearedAt, receivedValue, openValue}, thisMonth: 'YYYY-MM'): 'received'|'arrived'|'late'|'due'|'later'` — rules fixed by the tests below.
  - `daysWaiting(invoicesIn, todayISO): number` — days since the earliest entry.
  - `seasonOf(month: 'YYYY-MM'): {key:'spring'|'summer'|'fall'|'holiday', label, year:number, first:'YYYY-MM'}`.
  - `isPrebook(orderDate: string|undefined, season): boolean`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests** in `lib/merch/ops.test.ts`:
  - `arrivedValue([], 500)===0`; `arrivedValue([{date:'2026-11-18'}], 500)===500`; `arrivedValue([{amount:200},{amount:200}], 300)===300`; `arrivedValue([{},{}], 300)===300`; `arrivedValue([{amount:-50}], 300)===0`
  - received wins: `rcvState({status:'received', invoicesIn:[{date:'2026-11-01'}], openValue:0, receivedValue:500, deliveryMonth:'2026-11'}, '2026-11')==='received'`; `status:'cancelled'` → `'received'`
  - arrived: `{status:'open', invoicesIn:[{date:'2026-11-10', amount:1000}], openValue:3000, receivedValue:0, deliveryMonth:'2027-02'}` → `'arrived'`
  - cleared: the same plus `invoicesClearedAt:'2026-11-20T00:00:00Z'` → `'received'`
  - month-end caught up: `receivedValue:1000` with one 1000 entry → `'received'`
  - late: no invoices, `deliveryMonth:'2026-10'`, thisMonth `'2026-11'` → `'late'`; `'2026-11'` → `'due'`; `'2027-02'` → `'later'`; missing `deliveryMonth` → `'later'`
  - `daysWaiting([{date:'2026-11-01'},{date:'2026-11-10'}], '2026-11-18')===17`
  - `seasonOf('2027-03')` → key `spring`, label `'Spring 2027'`, first `'2027-01'`; `seasonOf('2027-06').key==='summer'`; `seasonOf('2026-09').first==='2026-08'`; `seasonOf('2026-12')` → label `'Holiday 2026'`, first `'2026-11'`
  - `isPrebook('2026-08-01', seasonOf('2027-03'))===true`; `isPrebook('2027-02-10', seasonOf('2027-03'))===false`; `isPrebook(undefined, seasonOf('2027-03'))===false`
  - `rules.test.ts`: `docProblem('pos/a', {invoicesIn:[{date:'2026-11-18', amount:'abc', source:'hand'}]})` matches `/amount/`; `{invoicesIn:[{date:'Nov 18', source:'hand'}]}` matches `/date/`; `{invoicesIn:'x'}` matches `/invoicesIn/`; a valid entry → `null`.
- [ ] **Step 2: Run** `npx vitest run lib/merch` → the new tests FAIL.
- [ ] **Step 3: Implement** `18-ops.js` and the `docProblem` additions.
- [ ] **Step 4: Run** `npx vitest run lib/merch` → all pass.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: receiving states and seasons, tested on their own"`

### Task 3: Shell, sidebar and look

**Files:**
- Modify: `merchandise/app/src/shell.html` (fonts link → Inter + IBM Plex Mono; `:root` tokens light / dark media / `[data-theme]`; markup inside `<div class="wrap">`: `<aside class="side" id="side">` + `<div class="main">` holding `header.top`, `#banner`, `#wibar`, `.monthbar`, `#summary`, `#kpis`, `#pane`; remove `.band` and `nav#tabs`; component styles for `.side`, `.tile`, `.panel`, tables, pills, buttons), `30-home.js` (`renderTabs` → `renderSide(S)`; delete `SECTIONS` and section-pill code; `TABHEAD` keyed by the 14 ids with the spec's one-line descriptions), `90-io.js` (`render()` calls `renderSide`; due bar only on `today` and `monthend`; menu toggle under 900px; account menu and Tools move to the sidebar foot)

**Interfaces:**
- Consumes: `NAV`, `resolveTab`, `pageLabel` (Task 1); `rcvState` (Task 2).
- Produces: `renderSide(S)`. Badges: `today` = `topDecisions(S).length` (red if any `sev:'crit'`); `orders` = open orders (green); `receiving` = orders in `arrived` + `late` (red if any late); `attention` = open items (red if crit); `monthend` = checklist items left (red if overdue); `scorecard` = unsorted SKUs, when any.

- [ ] **Step 1: Restyle and restructure** as above, keeping every id other code queries: `#pane #overlay #toast #banner #wibar #summary #kpis #years #months #monthHint #pageTitle #pageSub #btnNew #btnMore #morePop #acct #btnAcct #acctPop #acctAv #acctNm #backHub`.
- [ ] **Step 2: Check:** `node --check` each changed JS file; `npx vitest run lib/merch` green.
- [ ] **Step 3: Browser check** (preview `pasatiempo`, `/merch`, signed in): sidebar shows 4 groups / 14 pages with badges; every page opens with no console errors; dark mode readable; at 800px wide the sidebar collapses to a menu button. Screenshot.
- [ ] **Step 4: Commit** `git commit -m "Merchandise: the new look and a sidebar grouped by job"`

### Task 4: Today, Budget & open-to-buy, clickable charts

**Files:**
- Create: `merchandise/app/src/31-today.js`
- Modify: `16-charts.js` (bars/points accept `go` per datum → `data-go="tab:key"`, pointer cursor), `90-io.js` (delegate `[data-go]` clicks → `goTab`, then open the keyed thing: category → `openCategory(key)`, brand → `openBrand(key)`, month `YYYY-MM` → set the selected month), `30-home.js` (`renderOverview` becomes Budget & open-to-buy with view switch `BV` stored in `localStorage` `mp.budgetView`: `cats` | `months` | `worksheet`; `months`/`worksheet` render the existing `renderOTB` / `worksheet` output; prose `renderSummary` replaced by 4 tiles: room to buy, committed, left to buy, on hand), `35-analysis.js` (Home's tiles and charts reused by Today; `summary` page retired)

**Interfaces:**
- Consumes: `topDecisions(S, n)`, `decisionHtml` (`30-home.js`), `anaNow()`, `chBars`, `chLine`, `chSpark`, `rptAlerts()`, `rcvState` (Task 2), `goTab` (Task 1).
- Produces: `renderToday(S)`; `PAGES.today`.

- [ ] **Step 0: Record today's numbers** from the running page before changing it: FY2027 room through Nov, committed, left, on hand, on order; Fancy Shirts / Sweaters / Ladies left (`committedIn(PLANS.cur)` vs plan); 83 orders; Peter Millar $62,167.
- [ ] **Step 1: Build Today:** 4 tiles with sparklines (Sales 12 mo + growth, Gross margin, Room to buy this FY, Sales per round); "Most important this week" (`topDecisions(S, 6)`); "Sales by month" bars, this year vs last (a month → `trends`); "Receiving room by month" (the existing `renderChart` series; a month → `overview` at that month); "Overdue" from `rptAlerts()` (→ `monthend`); "Due in the next 30 days" (open orders with `rcvState` `due` or `late`, → `receiving`).
- [ ] **Step 2: Budget & open-to-buy:** tiles + room-by-month chart + category table (name, role, committed / room bar, left, weeks of supply; row → `openCategory`) + view switch to Month by month / Worksheet. Category bars carry `go:'overview:<code>'`.
- [ ] **Step 3: Check numbers unchanged** against Step 0; `npx vitest run lib/merch` green.
- [ ] **Step 4: Commit** `git commit -m "Merchandise: Today page, one Budget & open-to-buy page, charts you can click"`

### Task 5: Orders and Vendors

**Files:**
- Modify: `40-lists.js` (`renderOrders`: open cost by vendor strip — top 8 vendors, click filters; "Deliveries by month" stacked chart of the top 5 vendors; filters add Vendor and Season via `seasonOf`), `60-panels.js` (`renderVendorsPage()` lists vendors as a page; the drawer stays for editing)

**Interfaces:**
- Consumes: `seasonOf` (Task 2), `chStack`.
- Produces: `PAGES.vendors = renderVendorsPage`.

- [ ] **Step 1: Implement** strip, chart, filters and Vendors page (vendor, open orders, open cost, next delivery, terms, rep; edit → `openVendors(id)`).
- [ ] **Step 2: Browser check:** 83 orders; Vendor = Peter Millar → 18 orders, $62,167; Season = Spring 2027 shows the spring Peter Millar orders. Screenshot.
- [ ] **Step 3: Commit** `git commit -m "Merchandise: orders by vendor and season, and a Vendors page"`

### Task 6: Receiving page and Invoice in

**Files:**
- Modify: `77-receiving.js` (add `renderReceiving(S)`, `openInvoiceIn(poId)` dialog — date default today, optional amount, optional invoice #, note — and `clearArrived(poId)`), `50-order.js` (order drawer: "Invoice in" button and the order's entries), `90-io.js` (handlers `data-invin`, `data-invclear`)

**Interfaces:**
- Consumes: `arrivedValue`, `rcvState`, `daysWaiting` (Task 2), `write()`, `canAct()`, `onOrder(p)`, `num(p.received)`.
- Produces: `PAGES.receiving = renderReceiving`; appends `{date, by: myId, amount?, invoice?, note?, source:'hand'}` to `invoicesIn`; sets `invoicesClearedAt`.

- [ ] **Step 1: Implement** tiles (In the store room $ at cost, Orders waiting, Oldest wait in days, Late orders); backlog-by-vendor chart (click filters); sections "In the store room, not in the POS" (oldest first, days waiting, arrived $, Clear), "Late", "Due this month"; one line saying the receiving log will fill this in once it's linked.
- [ ] **Step 2: Browser check:** Invoice in $1,000 on a Peter Millar order → listed in the store room at $1,000; Clear → gone; Budget tiles identical before and after; then remove the test entry so no test data is left. With `readOnly = true` set in the console, no buttons show.
- [ ] **Step 3: Commit** `git commit -m "Merchandise: Receiving page, with Invoice in on each order"`

### Task 7: Season buys

**Files:**
- Create: `merchandise/app/src/79-seasons.js` (`renderSeasons(S)`)

**Interfaces:**
- Consumes: `seasonOf`, `isPrebook` (Task 2), `POS`, `poParts(p)`, `roomThrough(code, month)`, `withPlan`, `planKeyFor`, `chStack`.
- Produces: `PAGES.seasons = renderSeasons`.

- [ ] **Step 1: Implement:** season picker (seasons with orders, current first); tiles (Committed, Prebooked, Reorders, Held back = the season's room left, summed by category, months inside the plan windows only); committed-by-month chart stacked prebooked / reorder; table by category (room in season, committed, held back, % held back) and by brand (committed, prebooked, reorders, units). 640 excluded.
- [ ] **Step 2: Browser check:** Spring 2027 shows Peter Millar $41,682 prebooked; Summer 2027 shows $20,485. Screenshot.
- [ ] **Step 3: Commit** `git commit -m "Merchandise: Season buys"`

### Task 8: Merged analysis and month-end pages

**Files:**
- Modify: `35-analysis.js` (`renderScorecard` rows show the role pill; a subcategory row opens `openSubcat(key)`; "Sort SKUs" button moves here from Subcategories; `renderTrends` appends the `renderRounds` content), `76-monthend.js`, `78-reports.js`, `40-lists.js` (`renderMonthEnd` = upload, this month's checklist, the calendar from `renderReports`, then `renderHelp` in a collapsible; `renderInventory` restyled with a book-vs-counted bar chart), `74-brands.js` (Assign / Edit brands as header buttons)

- [ ] **Step 1: Implement** the merges; every control from the old pages stays reachable.
- [ ] **Step 2: Browser check:** all 14 pages load with no console errors; `data-tab` `subcats`, `rounds`, `reports`, `help` land on their new pages.
- [ ] **Step 3: Commit** `git commit -m "Merchandise: Scorecard with subcategories, Trends with rounds, Upload & close in one place"`

### Task 9: Finish

**Files:**
- Modify: `merchandise/README.md` (Pages and Navigation rewritten for the 14 pages; Receiving and Season buys sections)

- [ ] **Step 1: Update the README.**
- [ ] **Step 2: Run** `npx vitest run lib/merch`, `cd merchandise/pipeline && python -m pytest -q`, `npx tsc --noEmit -p .` → all pass, no errors in `lib/merch` or `app/merch`.
- [ ] **Step 3: Final browser pass:** all 14 pages, light and dark, 1440px and 800px; Task 4 Step 0 numbers unchanged. Screenshots of Today, Budget & open-to-buy, Receiving, Season buys.
- [ ] **Step 4: Commit** `git commit -m "Merchandise: README for the redesign"`
