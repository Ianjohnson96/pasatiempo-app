# Merchandise Phase 2, Stage 3: Categories and the Actions List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One page per category that answers "how is it doing and what should I do", and one list of actions ranked by
dollars at stake, with Home showing its top five.

**Architecture:** Plain page scripts in `merchandise/app/src/*.js`, assembled in file-name order. Navigation
(`05-nav.js`) gains a **Categories** sidebar entry. Its views are All categories (the Scorecard), Actions and
Trends & rounds, plus a per-category page reached as `category:<code>`. Actions builds on the sources that
`topDecisions` (`30-home.js`) already merges. Every number on the category page comes from functions that exist
today (`anaNow`, `stats`, `seasonBudget`, `stuckMoney`, `arrivalSplit`, `rcvOf`), so no number is recomputed a second
way.

**Tech Stack:** Vanilla JS page; vitest with `lib/merch/page-harness.ts` (`loadPage(docs)` runs the page in a vm).

**Spec:** `docs/superpowers/specs/2026-11-22-merch-phase2-design.md`, section "Stage 3: Categories and the actions list".

## Global Constraints

- Saved links keep working. Old page ids (`scorecard`, `trends`, `rounds`, `stuck`, `attention`, `subcats`) still open
  something sensible: `attention` opens Actions.
- Done and Not now work as today (`istate/{id}`). An item comes back if its dollars grow by more than a quarter
  (current > 1.25 × the dollars when it was set aside).
- Actions are worked out whenever the data changes (upload, orders, log, Settings). There is no fixed schedule.
- Home shows the top five actions.
- Plain copy: short sentences and no jargon in labels. A verdict sentence sits at the top of every page (`PAGE_VERDICT`).
- Brands and Markdowns stay as their own sidebar pages; their category rows click into the category page.
- A page view must never take the page down. Wrap new verdicts the way `verdictFor` does.

## Review Focus

1. **Before the first upload** (`BASE` and `anaNow()` null), the category page and Actions show a plain message, not an
   error. Test it in Tasks 3 and 4.
2. **A category with no analysis row**, for example a new code in the plan but not in ASSORT, or 640 Special Orders,
   still opens. Show the budget and orders; give "—" where there's no data. Test it in Task 4.
3. **An unknown or stale `#category:<code>`** in the address, for a code that no longer exists, opens All categories
   instead of a blank page. Test it in Task 1.
4. **An item set aside that grows by exactly 25%** stays hidden. Above 25% it returns, and the Done record is not lost.
   Test it in Task 2.
5. **Viewers (read-only)** see actions with no Done / Not now buttons. Test it in Task 3.

---

### Task 1: Navigation: Categories entry, category page route, keys in the address

**Files:**
- Modify: `merchandise/app/src/05-nav.js` (`NAV`, `VIEWS`, `PAGE_PARENT`, `TAB_ALIAS`, new `parseHash`)
- Modify: `merchandise/app/src/10-core.js:66` (initial `TAB` and a new `INIT_KEY` from `parseHash`)
- Modify: `merchandise/app/src/90-io.js` (`pageUrl` carries the category key; `popstate` and first render apply a key; `PAGES.category`, `PAGES.actions`)
- Test: `lib/merch/nav.test.ts`

**Interfaces:**
- Produces:
  - `parseHash(hash: string) → [tab: string, key: string|null]`, which resolves through `resolveTab`.
  - `let CATSEL: string|null`, the category the category page shows.
  - `goTab('category', code)`, which sets `CATSEL` and opens the page.
  - The page ids `category` and `actions`.
- `NAV` sell group becomes `[['categories', 'Categories'], ['brands', 'Brands'], ['stuck', 'Markdowns']]`.
- `VIEWS.categories = [['scorecard', 'All categories'], ['actions', 'Actions'], ['trends', 'Trends & rounds']]`.
- `PAGE_PARENT.category = 'categories'`.
- `TAB_ALIAS.attention = 'actions'`.
- `SIDE_OPENS.categories = 'scorecard'`.

- [ ] **Step 1: Write the failing tests** (`nav.test.ts`, new `describe("categories")`)
  - `parseHash('#category:620')` → `['category', '620']`.
  - `parseHash('#orders:v-fj')` → `['orders', 'v-fj']`.
  - `parseHash('#bogus')` → `['today', null]`.
  - `parseHash('#attention')` → `['actions', null]`.
  - `navParent('category') === 'categories'`, `navParent('actions') === 'categories'`, `navParent('scorecard') === 'categories'`.
  - `sideTarget('categories') === 'scorecard'`.
  - Page harness: `goTab('category', '620')` gives `TAB === 'category'` and `CATSEL === '620'`.
  - Page harness: `goTab('category', '999')`, a code not in the plan, gives `TAB === 'scorecard'`.
- [ ] **Step 2: Run** `npx vitest run lib/merch/nav.test.ts`. Expected: FAIL, `parseHash` is not defined.
- [ ] **Step 3: Implement the navigation changes**
  - `parseHash` splits on the first `:`.
  - The initial load does `[TAB, INIT_KEY] = parseHash(location.hash)`. After the first render with data, if `INIT_KEY` is set, call `goTab(TAB, INIT_KEY)` once.
  - `pageUrl(TAB)` adds `:` + `CATSEL` when `TAB === 'category'`.
  - `popstate` uses `parseHash`.
  - In `goTab`: `id === 'category'` with a code in `PLAN.cats` or `anaNow().cats` sets `CATSEL`; any other code falls back to `scorecard`. The existing "a category code opens its drawer" branch must not fire for `category`.
- [ ] **Step 4: Run** `npx vitest run lib/merch/nav.test.ts`, then `npx vitest run`. Expected: PASS. Existing nav tests updated only where the sell group's entries changed.
- [ ] **Step 5: Commit** with the message `Merchandise: a Categories entry with its views, and a page per category in the address`.

### Task 2: One ranked list of actions, with the "comes back if it grows" rule

**Files:**
- Modify: `merchandise/app/src/30-home.js` (`topDecisions` builds on a new `allActions`; `DECIDE` gains `review`)
- Modify: `merchandise/app/src/90-io.js:290-291` (the `data-istate` handler saves `usd` from `data-usd`)
- Test: `lib/merch/actions.test.ts` (new)

**Interfaces:**
- Consumes: `openAttention(S)`, `suggest(a)`, `ISTATE`, as today.
- Produces:
  - `allActions(S) → Action[]`, sorted by `usd` descending. Items without a dollar figure come last, by severity.
  - `Action = {id, verb, usd, title, detail, action, sev, cat?, po?, page?, sku?, desc?, state: null|{status, usd?}, back: boolean}`.
  - `back` is true when an item set aside has grown past the rule. It is then listed as open, with a "Back: up from $X" note.
  - `actionsFor(S, cat) → Action[]`, the open actions whose `cat === cat`.
  - `topDecisions(S, n = 5)` keeps today's rule: at most two per verb, taken from `allActions(S)` open items with `usd >= 250`.
  - `decisionHtml(d, k)` renders `data-usd="${Math.round(d.usd)}"` on its Done / Not now buttons.
- Every item `openAttention` returns today is in `allActions`. Kinds with no verb get `verb: 'review'`, and `usd` from `i.usd`, otherwise 0.

- [ ] **Step 1: Write the failing tests** (`actions.test.ts`, page harness with `page-docs.json`)
  - `allActions(stats())` holds every `openAttention` id plus every `suggest` id. The usd values are non-increasing until the first 0.
  - `topDecisions(stats())` has length ≤ 5, and no verb appears more than twice.
  - Set `ISTATE[x.id] = {status: 'dismissed', usd: x.usd}`: `x` is not open.
  - With `usd: x.usd / 1.25`, so the item grew by exactly 25%: still not open.
  - With `usd: x.usd / 1.3`: open, `back === true`, and `ISTATE[x.id]` is untouched.
  - `ISTATE[x.id] = {status: 'done'}` with no `usd` (an old record): not open.
  - `actionsFor(stats(), x.cat)` contains only `x.cat` items.
- [ ] **Step 2: Run** `npx vitest run lib/merch/actions.test.ts`. Expected: FAIL, `allActions` is not defined.
- [ ] **Step 3: Implement `allActions`, `actionsFor`, the rule, and `usd` on `istate` writes**
  - Move `topDecisions`' per-item verb and usd logic into `allActions`, with no cap.
  - `topDecisions` slices from it.
  - The handler writes `{status, by, at, usd: num(ds.usd)}`.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS, including the existing Home tests.
- [ ] **Step 5: Commit** with the message `Merchandise: one ranked list of actions; a set-aside item comes back when its dollars grow by a quarter`.

### Task 3: The Actions view

**Files:**
- Modify: `merchandise/app/src/40-lists.js` (`renderAttention` replaced by `renderActions`; `itemHtml` and `attnGroups` stay for the category-filtered list)
- Modify: `merchandise/app/src/06-verdict.js` (`PAGE_VERDICT.actions`, replacing `attention`)
- Modify: `merchandise/app/src/30-home.js` (`TABHEAD.actions`)
- Test: `lib/merch/actions.test.ts`

**Interfaces:**
- Consumes: `allActions`, `decisionHtml` (Task 2).
- Produces: `renderActions(S)` on `PAGES.actions`.
- **Layout**, top to bottom:
  1. The verdict.
  2. Filters: verb chips (`DECIDE` labels with counts), a category select, and "Show done". These reuse `afilt.kind`, which now holds a verb or `'all'`.
  3. One `<ul class="items">` of `decisionHtml`, numbered 1..n, biggest dollars first.
  4. Items marked done or dismissed (shown only with "Show done") have an Undo button and sit after the open ones.
- **Verdict:**
  - with open actions: `watch`, "N actions, $X at stake. Start with the first."
  - with none: `ok`, "Nothing needs doing."

- [ ] **Step 1: Write the failing tests**
  - `renderActions(stats())` HTML contains every open action's title in `allActions` order, and the first `data-usd` is the largest.
  - With `afilt.cat = '620'`, only 620 items show.
  - `readOnly = true` gives no `data-istate`.
  - Before the first upload (no `BASE`), the view renders "The actions appear after the first month-end upload." and throws nothing.
  - `PAGE_VERDICT.actions(stats()).text` matches `/^\d+ actions?, \$[\d,]+ at stake/`.
- [ ] **Step 2: Run** `npx vitest run lib/merch/actions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `renderActions(S)`** and delete `renderAttention` and its now-unused code. `KIND_NOTE` and the `afilt.kind` values change to verbs.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS. Update tests that read `renderAttention` to use `renderActions`.
- [ ] **Step 5: Commit** with the message `Merchandise: Actions, every decision on one list by dollars at stake`.

### Task 4: The category page

**Files:**
- Create: `merchandise/app/src/36-category.js` (one page, one file)
- Modify: `merchandise/app/src/06-verdict.js` (`PAGE_VERDICT.category`)
- Test: `lib/merch/category-page.test.ts` (new)

**Interfaces:**
- Consumes:
  - `CATSEL` (Task 1) and `actionsFor`, `decisionHtml` (Task 2).
  - Unchanged existing functions: `anaNow()` (`cats[].{cat, name, t12, growth, trend3, gm, md, turns, gmroi, wks, agedPct, aged, oh, series, subs, seg}`), `anaRow`, `grade`, `stats()`, `seasonBudget`, `LAST`, `INV.cats`, `stuckMoney(a)`, `POS`, `arrivalBarHtml`, `rcvOf`, `roleOf`, `chLine`, `chLegend`, `anaTile`.
- Produces:
  - `renderCategory(S)` on `PAGES.category`.
  - `catPageData(code, S) → {name, role, sales: {t12, growth, ty: number[12], ly: number[12], labels: string[12]}|null, stock: {oh, wks, wksTarget, aged, agedPct}, margin: {gm, gmroi}|null, budget: {left, budget, committed}|null, orders: PO[], markdown: {sub, aged, cashAt30}[], actions: Action[]}`.
- **Sections**, in order:
  1. A header with the name, the role pill and the verdict.
  2. Tiles:
     - Sales, 12 months, with growth.
     - Weeks of supply against target.
     - Margin and GMROI.
     - Aged stock.
     - Left to buy, as `seasonBudget(code) − S.cm(code, LAST())`, the same figure the Budget page shows.
  3. Sales by month: this year against a year earlier, from the last 24 entries of `c.series`.
  4. Actions for this category, from `actionsFor`. When there are none: "Nothing to do in <name>."
  5. Subcategories: `anaRow(s, true)` rows.
  6. Open orders: PO, vendor, delivery, `arrivalBarHtml`, and a "Late" pill when `rcvOf === 'late'`. Rows open the order.
  7. Markdown candidates: `stuckMoney(a).markdown` filtered to this category, top 10.
  8. Links:
     - "Budget details" (`data-cat`) opens the existing drawer.
     - "Brands in <segment>" (`data-tab="brands"`). Brand figures are per segment, not per category, so this is a link.
- **Verdict:**
  - Left to buy < 0: `act`, "<name> is $X over budget."
  - Otherwise, with one or more `badOf` grades: `watch`, "<name> is outside its guideline on <list>."
  - Otherwise: `ok`, "<name> is within its guidelines, with $X left to buy."

- [ ] **Step 1: Write the failing tests** (`category-page.test.ts`)
  - For a fixture category with analysis, for example `620`:
    - `catPageData('620', S).budget.left` equals the Budget page's figure for 620 (compute it the way `consistency.test.ts` does).
    - `sales.ty.length === 12`.
    - `orders` holds exactly the open POs with `cat` or a line in 620.
  - The rendered page contains the five tile labels and "Sales by month".
  - A code with no analysis row (`640`) renders with `sales === null` and "—" in the sales tile, and throws nothing.
  - No `BASE` renders the plain empty message.
  - `PAGE_VERDICT.category(S)` has `CATSEL = '620'`, and its text names the category.
- [ ] **Step 2: Run** `npx vitest run lib/merch/category-page.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `catPageData` and `renderCategory`** in `36-category.js`.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Merchandise: a page per category: sales, stock, margin, budget, orders, markdowns and its actions`.

### Task 5: Click-throughs into the category page, and Home's top five

**Files:**
- Modify: `merchandise/app/src/35-analysis.js`:
  - In the Scorecard row, the category name becomes a `data-go="category:<code>"` link, and the caret still opens the subcategories.
  - `data-anaopen` goes to `category:<code>` instead of scrolling the Scorecard. This covers the Trends tiles, Markdowns rows and the scatter chart.
- Modify: `merchandise/app/src/30-home.js` (`decisionHtml`'s "Open category" uses `data-go="category:<code>"`)
- Modify: `merchandise/app/src/31-today.js` (Home's "See all" link goes to `actions`)
- Test: `lib/merch/category-page.test.ts`

**Interfaces:**
- Consumes: `goTab('category', code)` (Task 1).

- [ ] **Step 1: Write the failing tests**
  - Scorecard HTML contains `data-go="category:620"`.
  - `renderStuck` and `renderTrends` HTML contain `data-anaopen="620"`, and `goTab` with that click target lands on `category`. Call the handler's logic through a small exported `anaOpen(code)` wrapper.
  - `decisionHtml` for an item with `cat` contains `data-go="category:`.
  - Home renders at most five decisions and a link to `actions`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the links.**
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .`. Expected: PASS and clean.
- [ ] **Step 5: Render the Categories, Actions and category pages with the fixture data, screenshot them at 1200px and at 390px, and check the layout.**
- [ ] **Step 6: Commit** with the message `Merchandise: every category row and action opens its category page`.
