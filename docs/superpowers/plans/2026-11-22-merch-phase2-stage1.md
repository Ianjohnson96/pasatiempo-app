# Merchandise phase 2, stage 1: numbers that agree, the phase sidebar, Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Merchandise Program's sidebar by phase (Buy / Sell & stock / Month-end), give every page a one-line verdict, make "weeks of supply" and "Left to buy" mean one thing everywhere, and turn Today into Home.

**Architecture:** Plain JS page assembled from `merchandise/app/src/*.js` + `shell.html` (served by `app/merch/route.ts` via `lib/merch/page.ts`). Pages are render functions keyed in `PAGES` (`90-io.js`); the sidebar model is `NAV` (`05-nav.js`). Merged pages keep their old page ids as *views* under a parent page, so every old link still opens the same content. No change to `20-engine.js`'s budget math or `pipeline/`.

**Tech Stack:** Plain browser JS, Vitest (`lib/merch/*.test.ts`, loading `app/src` files with `node:vm`), Playwright for the browser check.

**Spec:** `docs/superpowers/specs/2026-11-22-merch-phase2-design.md` (stage 1)

## Global Constraints

- No change to budget or forecast math: `lib/merch/engine-parity.test.ts` and `merchandise/pipeline/test_parity.py` stay green with no fixture changes.
- Every current page's content stays reachable; every old page id (`today`, `orders`, `receiving`, `attention`, `vendors`, `overview`, `seasons`, `forecast`, `scorecard`, `brands`, `stuck`, `trends`, `monthend`, `inventory`, `guidelines`, plus `TAB_ALIAS` ids) still opens its content.
- Weeks of supply for a **category** = shelf stock at cost ÷ (next four months' forecast cost of shelf sales ÷ 17.3). Subcategories and brands keep the last 12 months' pace, labelled "at last year's pace".
- Left to buy leads with the full plan year; month views are a choice, not the default.
- Colour: green = room / fine, amber = waiting / watch, red = act. One verdict sentence per page, then at most three numbers, then detail; explanations behind ⓘ.
- Copy: plain English, the existing voice (short sentences, no jargon, "Jonas" for the POS).
- Desk first; phone width must not break (no horizontal page scroll at 390px).

## Review Focus

- **Before the first upload** (`BASE` null, no `ASSORT`): Home, the view bars and verdicts render a plain "after the first month-end upload" line, no exceptions. → test in Task 5.
- **A category with no forecast sales ahead** (e.g. Demo Clubs 220, or a category whose next four months forecast 0): weeks shows "—", never `Infinity`/`NaN`, and isn't graded. → test in Task 2.
- **Old links and saved pages** (`#receiving`, `#stuck`, `#inventory`, `#forecast`, `#attention`, `#vendors`, `orders:<poId>`): open the right view with the parent highlighted. → test in Task 1.
- **View-only and staff logins**: verdicts and view bars show no owner-only buttons; staff still open on Orders & receiving. → test in Task 5.
- **The partial current month** (`BASE.partial`): Home's "this year" Left to buy equals the Budget page's full-year figure. → test in Task 3.

---

### Task 1: Phase navigation with views

**Files:**
- Modify: `merchandise/app/src/05-nav.js`
- Modify: `merchandise/app/src/30-home.js` (`renderSide`, `TABHEAD`)
- Modify: `merchandise/app/src/90-io.js` (`goTab`, `render`, add the view bar)
- Modify: `merchandise/app/src/shell.html` (view-bar styles)
- Test: `lib/merch/nav.test.ts`

**Interfaces:**
- Produces (pure, in `05-nav.js`):
  - `NAV`: `[{key:'buy',label:'Buy',pages:[['budget','Budget'],['orders','Orders & receiving'],['seasons','Season plan']]}, {key:'sell',label:'Sell & stock',pages:[['scorecard','Scorecard'],['trends','Trends & rounds'],['brands','Brands'],['stuck','Markdowns']]}, {key:'close',label:'Month-end',pages:[['monthend','Upload & count']]}]`, with `home` (label `Home`) above the groups and `settings` (label `Settings`) in the foot.
  - `VIEWS`: `{orders:[['orders','Orders'],['receiving','Receiving'],['vendors','Vendors']], monthend:[['monthend','Upload & close'],['inventory','Stock & counts']], settings:[['guidelines','Guidelines'],['forecast','Forecast']]}`.
  - `navParent(id: string): string` — the sidebar page a page id belongs to (`'receiving'→'orders'`, `'inventory'→'monthend'`, `'forecast'→'settings'`, `'guidelines'→'settings'`, `'attention'→'home'`, `'today'→'home'`, `'overview'→'budget'`; a sidebar id → itself).
  - `resolveTab(id)` keeps old ids as themselves (they are views), maps `'home'→'today'`, `'budget'→'overview'`, `'settings'→'guidelines'`, and keeps `TAB_ALIAS`.
- Produces (page): `renderViewBar(tab: string): string` — segmented control of the parent's `VIEWS` with `data-tab` buttons, `''` for pages without views.

- [ ] **Step 1: Write the failing tests** in `lib/merch/nav.test.ts`:

```ts
it("groups pages by phase", () => {
  expect(N.NAV.map((g: {key: string}) => g.key)).toEqual(["buy", "sell", "close"]);
  expect(N.NAV[0].pages.map((p: string[]) => p[1])).toEqual(["Budget", "Orders & receiving", "Season plan"]);
});
it("every old page id still opens, under its parent", () => {
  for (const [id, parent] of [["receiving","orders"],["vendors","orders"],["inventory","monthend"],["forecast","settings"],["guidelines","settings"],["attention","home"],["today","home"],["overview","budget"],["stuck","stuck"]])
    expect(N.navParent(N.resolveTab(id))).toBe(parent);
  expect(N.resolveTab("home")).toBe("today");
  expect(N.resolveTab("budget")).toBe("overview");
  expect(N.resolveTab("summary")).toBe("today");   // TAB_ALIAS still works
  expect(N.parseGo("orders:po27-x")).toEqual({tab: "orders", key: "po27-x"});
});
```

- [ ] **Step 2: Run** `npx vitest run lib/merch/nav.test.ts` — Expected: FAIL (`navParent` not defined / NAV keys differ).
- [ ] **Step 3: Implement** the `05-nav.js` interfaces above. `pageLabel(id)` returns the sidebar label for sidebar ids and the view label for view ids.
- [ ] **Step 4: Wire the page.** `renderSide` marks `navParent(TAB)` as current, renders Home above the groups and Settings in the foot; the page header shows the parent's label as title and `renderViewBar(TAB)` under it; `TABHEAD` gets entries for `budget`, `orders`, `monthend`, `settings` and keeps the view ids' lines. `goTab` and the `hashchange` handler are unchanged apart from accepting the new ids.
- [ ] **Step 5: Run** `npx vitest run lib/merch` — Expected: all pass.
- [ ] **Step 6: Commit** `git commit -m "Merchandise: sidebar by phase, merged pages as views"`

### Task 2: One weeks-of-supply for categories

**Files:**
- Modify: `merchandise/app/src/20-engine.js` (add the functions; replace `wksNow`)
- Modify: `merchandise/app/src/35-analysis.js` (`anaNow`: category rows use the forward pace)
- Modify: `merchandise/app/src/30-home.js:185`, `40-lists.js:153`, `60-panels.js:38` (call `catWeeks`)
- Modify: `merchandise/app/src/73-subcats.js:57,231`, `74-brands.js:96` (column header "Weeks at last year's pace")
- Modify: `merchandise/app/src/17-metrics.js:247` (copy only, unchanged math)
- Test: `lib/merch/weeks.test.ts` (new)

**Interfaces:**
- Produces (`20-engine.js`):
  - `fwdWeeklyCost(code: string, m?: string): number` — `(Σ shelf sales of the four months after m × (1 − gm)) ÷ 17.3` from `ENG`; `m` defaults to `ENG.months[0]`; 0 when unknown.
  - `catWeeks(code: string, shelfCost: number): number | null` — `shelfCost ÷ fwdWeeklyCost(code)`; `null` when the weekly cost is 0 or the category isn't in `ENG`.
  - `wksNow` is removed; its three callers pass shelf cost (`cost − soOnHand`, floored at 0) to `catWeeks`.
- Produces (`35-analysis.js`): in `anaNow()`, each **category** row `M` gets `M.wksLY = M.wks`, `M.cogsWkLY = M.cogsWk`, then, when `catWeeks` returns a number, `M.wks = catWeeks(M.cat, M.oh)` and `M.cogsWk = fwdWeeklyCost(M.cat)`. Subcategory rows are untouched. (`stuckMoney`'s `targetWks` therefore uses the forward pace for categories.)

- [ ] **Step 1: Write the failing tests** in `lib/merch/weeks.test.ts`, loading `17-metrics.js`, `18-ops.js`, `19-guides.js`, `20-engine.js` with the helpers the parity test uses and `BASE = fixture.base` from `merchandise/pipeline/fixtures/engine_parity.json`:

```ts
it("a category's planned month-end stock reads as its target weeks", () => {
  // the engine's first month: eom = wos × weekly cost of the next four months
  for (const c of cats) {
    const r = ENG.cats[c][0];
    expect(catWeeks(c, r.eom)).toBeCloseTo(assumptions().wos[c] * ENG.scale, 6);
  }
});
it("no forecast sales ahead gives no weeks, never Infinity", () => {
  BASE.cats["220"].hist = {}; BASE.cats["220"].act = {}; derive();
  expect(catWeeks("220", 10000)).toBeNull();
  expect(catWeeks("zzz", 10000)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run lib/merch/weeks.test.ts` — Expected: FAIL (`catWeeks` not defined).
- [ ] **Step 3: Implement** `fwdWeeklyCost` and `catWeeks`, then switch the callers and `anaNow` as described. Display: `null` → "—" everywhere a weeks figure shows; graded only when a number.
- [ ] **Step 4: Run** `npx vitest run lib/merch` and `cd merchandise/pipeline && python3 -m pytest -q` — Expected: all pass, parity fixtures unchanged (`git diff --stat` shows no fixture change).
- [ ] **Step 5: Commit** `git commit -m "Merchandise: one weeks of supply for categories, at the budget's forward pace"`

### Task 3: Left to buy leads with the year; a cross-page check

**Files:**
- Modify: `merchandise/app/src/10-core.js` (`selMonth` default)
- Modify: `merchandise/app/src/31-today.js` (`todayRoom` returns the year first)
- Create: `lib/merch/page-harness.ts` (loads every `app/src` file except `90-io.js` with DOM stubs and a fixture; exported `loadPage(docs)` returning an evaluator)
- Create: `lib/merch/fixtures/page-docs.json` (small anonymized fixture: `base` = the parity fixture's base, three orders across two categories and months — one late, one partial with `receipts` — and an `assort` with rows for those categories)
- Test: `lib/merch/consistency.test.ts` (new)

**Interfaces:**
- Consumes: Task 2's `catWeeks`.
- Produces: `loadPage(docs: {base, assort?, inv?, guide?, pos?}): (expr: string) => unknown` in `lib/merch/page-harness.ts` (used again by stage 2 tests). `selMonth()` returns `'season'` unless a month was picked (`SEL`). `todayRoom()` returns `{fy, year, now, m, left, opens, chart}` with `year` = the Budget page's full-year Left to buy.

- [ ] **Step 1: Write the failing tests** in `lib/merch/consistency.test.ts`:

```ts
it("every Left to buy figure for the plan year agrees", () => {
  const R = loadPage(docs);
  const v = R(`(() => { SEL = 'season'; const s = stats(); const CM = committedMatrix(), w = WIN(), cats = otbCats();
    return [s.left, sum(cats, c => roomThrough(c, s.m) - s.cm(c, s.m)), sum(cats, c => sum(w, k => budgetAt(c, k) - num((CM[c] || {})[k]))),
            todayRoom().year, leftToBuyWith(assumptions())]; })()`) as number[];
  for (const x of v) expect(x).toBeCloseTo(v[0], 2);
});
it("the Budget page opens on the whole year", () => {
  expect(loadPage(docs)(`(SEL = null, selMonth())`)).toBe("season");
});
it("weeks of supply agrees on Budget, Stock & counts and Scorecard", () => {
  const R = loadPage(docs);
  const w = R(`(() => { const a = anaNow(); return otbCats().map(c => [catWeeks(c, Math.max(INV.cats[c].cost - num(BASE.cats[c].soOnHand), 0)), (a.cats.find(x => x.cat === c) || {}).wks]); })()`) as [number, number][];
  for (const [budget, scorecard] of w) if (budget != null && scorecard != null) expect(scorecard).toBeCloseTo(budget, 6);
});
```

- [ ] **Step 2: Run** `npx vitest run lib/merch/consistency.test.ts` — Expected: FAIL (`selMonth()` returns the month; harness missing).
- [ ] **Step 3: Implement** the harness, the fixture, `selMonth`'s default and `todayRoom`'s `year`.
- [ ] **Step 4: Run** `npx vitest run lib/merch` — Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: Left to buy leads with the year; cross-page consistency tests"`

### Task 4: Verdict lines and the visual rules

**Files:**
- Create: `merchandise/app/src/06-verdict.js` (pure)
- Modify: `merchandise/app/src/30-home.js` (`renderSide` shows the verdict under the title; `anaTile` puts its note behind ⓘ)
- Modify: `merchandise/app/src/31-today.js` (`todayTile`: note behind ⓘ)
- Modify: `merchandise/app/src/shell.html` (verdict styles; tone tokens `--ok`, `--watch`, `--act` mapped to the existing green / ochre / brick)
- Test: `lib/merch/verdict.test.ts` (new, uses Task 3's harness)

**Interfaces:**
- Produces: `PAGE_VERDICT: {[pageId: string]: (S) => {tone: 'ok'|'watch'|'act', text: string} | null}` in `06-verdict.js`, one entry per sidebar page and view (`today`, `overview`, `orders`, `receiving`, `vendors`, `seasons`, `scorecard`, `trends`, `brands`, `stuck`, `monthend`, `inventory`, `guidelines`, `forecast`, `attention`); `verdictHtml(v): string` (`''` for null). Each returns `null` when its data isn't loaded.
- Pinned verdicts (exact facts, wording the builder's):
  - `overview`: the year's Left to buy and the biggest room by category; tone `act` when the year is negative.
  - `orders`: open orders, how many late; tone `act` when any are late.
  - `stuck`: stock over the weeks target and aged stock in dollars; tone `watch`/`act` by the aged-stock guideline.
  - `monthend`: the date of the latest Jonas data and the next checklist due.

- [ ] **Step 1: Write the failing tests:**

```ts
it("Budget's verdict states the year's Left to buy", () => {
  const R = loadPage(docs);
  const v = R(`PAGE_VERDICT.overview(stats())`) as {tone: string; text: string};
  const year = R(`Math.round(leftToBuyWith(assumptions()))`) as number;
  expect(v.text).toContain(R(`money(${year})`) as string);
});
it("every page has a verdict or says why not", () => {
  const R = loadPage(docs);
  for (const id of ["today","overview","orders","receiving","vendors","seasons","scorecard","trends","brands","stuck","monthend","inventory","guidelines","forecast","attention"])
    expect(R(`typeof PAGE_VERDICT.${id}`)).toBe("function");
});
```

- [ ] **Step 2: Run** `npx vitest run lib/merch/verdict.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `06-verdict.js` and render the verdict under the page title. Tiles: label, the number, one short line; everything else moves behind an ⓘ (`data-tip`, the existing tip box in `10-core.js`). Pages keep their content below.
- [ ] **Step 4: Run** `npx vitest run lib/merch` — Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: a verdict on every page; notes behind ⓘ"`

### Task 5: Home

**Files:**
- Modify: `merchandise/app/src/31-today.js` (`renderToday` → Home layout)
- Modify: `merchandise/app/src/30-home.js` (`TABHEAD.today` → `Home`)
- Test: `lib/merch/home.test.ts` (new, harness)

**Interfaces:**
- Consumes: `todayRoom()` (Task 3), `PAGE_VERDICT` (Task 4), `topDecisions(S, n)` (existing, `30-home.js`), `rcvOf(p)` (existing, `77-receiving.js`).
- Produces: `homeLines(S): {buy: string, arriving: string, selling: string} | null` in `31-today.js`; `null` before the first upload.

Layout (top to bottom): the three lines from `homeLines` (Buy, Arriving, Selling), each a link to its page; "This week's decisions" — top 5 of `topDecisions` with "See all" → `attention`; then the existing sales and room charts and Late or due. The four tiles go; their numbers live in the lines.

- [ ] **Step 1: Write the failing tests:**

```ts
it("Home leads with the year's room to buy", () => {
  const R = loadPage(docs);
  const L = R(`homeLines(stats())`) as {buy: string};
  expect(L.buy).toContain(R(`money(todayRoom().year)`) as string);
});
it("Arriving counts late and due orders", () => {
  const L = loadPage(docs)(`homeLines(stats())`) as {arriving: string};
  expect(L.arriving).toMatch(/1 late/);
});
it("before the first upload Home renders without errors", () => {
  const R = loadPage({});
  expect(R(`homeLines(stats())`)).toBeNull();
  expect(() => R(`renderToday(stats())`)).not.toThrow();
});
it("a viewer sees no owner buttons on Home", () => {
  const R = loadPage(docs); R(`isAdmin = false; canWrite = false`);
  expect(R(`(renderToday(stats()), document.__html)`)).not.toMatch(/data-gd|New order/);
});
```

(`document.__html`: the harness's `#pane` stub records the last `innerHTML` set.)

- [ ] **Step 2: Run** `npx vitest run lib/merch/home.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `homeLines` and the Home layout.
- [ ] **Step 4: Run** `npx vitest run lib/merch` — Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: Home leads with buy, arriving and selling"`

### Task 6: Browser check, numbers audit, docs

**Files:**
- Modify: `merchandise/README.md` (Pages table, Navigation, the weeks definition under The model)
- Create: `docs/superpowers/plans/2026-11-22-merch-phase2-stage1-audit.md` (the audit: every figure that shared a label but not a calculation, what changed, and every category flag/action that changes on the day this ships, from the live data before vs after)

- [ ] **Step 1:** Build the page with `lib/merch/page.ts`'s `programHtml` and serve it with a stand-in `/merch/api/db` holding a read-only copy of the live documents (as done for PR #47). In Chromium at 1400px and 390px, open every sidebar page and view as owner, staff and viewer. Expected: no page errors; no horizontal scroll at 390px; each page shows a verdict.
- [ ] **Step 2:** Run the before/after comparison on the live copy (old `main` vs this branch): weeks of supply per category, Stuck money's over-target dollars, the Scorecard's suggestions and Home's decisions. Write the differences into the audit file.
- [ ] **Step 3:** Update the README sections listed above.
- [ ] **Step 4: Run** `npx vitest run`, `cd merchandise/pipeline && python3 -m pytest -q`, `npx eslint lib/merch`, `npx tsc --noEmit -p .` — Expected: all pass.
- [ ] **Step 5: Commit and push**; open the stage 1 PR with the audit summary.
