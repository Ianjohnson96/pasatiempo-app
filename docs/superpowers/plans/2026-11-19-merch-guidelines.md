# Merchandise Guidelines Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One owner-editable Guidelines page holding every rule the Merchandise Program grades and suggests by, each shown beside a suggested value and the shop's current figure, plus a merchandise-mix target and budget weeks-of-supply targets with a before/after preview.

**Architecture:** Defaults stay in code; a saved `guidelines/current` document is laid over them key by key by one pure function, and the program's existing rule constants are reassigned from the result, so every page follows a saved change and nothing changes when no document exists. Budget weeks of supply keep living in `plan/assumptions.wos`; the preview runs the existing engine (`runEngine`/`planFor`) with a local override instead of touching the Forecast page's `WHATIF`. The month-end upload sends the saved role map and member discount to the Python reader.

**Tech Stack:** Plain JS files `merchandise/app/src/*.js` joined in sorted filename order with `shell.html` (shared globals); Next.js API `app/merch/api/db`; validation `lib/merch/rules.ts`; Python `api/merch/reports.py` + `merchandise/pipeline`; vitest (`lib/merch/*.test.ts`, page files loaded with `node:vm`) and pytest.

**Spec:** `docs/superpowers/specs/2026-11-19-merch-guidelines-design.md`

## Global Constraints

- With no `guidelines/current` saved, every page behaves exactly as today: `lib/merch/engine-parity.test.ts`, `lib/merch/analysis.test.ts`, `merchandise/pipeline` pytest stay green with no fixture edits.
- No change to the budget engine's formulas (`20-engine.js` `runEngine`/`planFor`, `pipeline/engine.py`) or to `77-receiving.js` `matchArrivals`.
- `guidelines` is owner-only: in `OWNER_ONLY`, never in `STAFF_WRITABLE`. Viewers and staff see values but no editable state, no Save or Reset.
- Defaults (verbatim from code): margin apparel 0.45 / accessories 0.40 / equipment 0.25; GMROI apparel 2 / accessories 2 / equipment 1; markdowns under 0.15; aged under 0.10; turns 2, fast 3 (160, 320); role weeks `fashion [12,16,8,24] over 30`, `impulse [12,20,8,30] over 30`, `consumable [8,16,6,24] over 24`, `hardgoods [16,26,12,40] over 40`, `demo null`; member discount 0.25; seasons first months spring 1, summer 5, fall 8, holiday 11.
- Suggested mix range per role = 12-month sales share ± 5 points, floored at 0, rounded to whole points; suggested total = cost of 12-month sales ÷ midpoint of the turns target. Mix covers all five roles; 640 excluded.
- Seasons stay in calendar order within the year (no season crosses New Year).
- Look B tokens and existing components; charts SVG via `16-charts.js`; no new libraries; plain English, sentence case.
- The page says: "Month-end suggestions update at your next upload."
- `.superpowers/` is git-ignored; never stage it.

## Review Focus

- A saved document with only some keys (e.g. just `memberDiscount`) → every other rule keeps its default; nothing throws. (Task 1 test `partial document`.)
- A malformed saved value (string, negative, lo > hi) reaching the page from an older or hand-edited document → that key falls back to its default, not NaN on the Scorecard. (Task 1 test `bad values fall back`.)
- A category the saved role map doesn't mention, or a new category at upload → today's default role. (Task 1 and Task 3 pytest.)
- Total stock typed as "$700,000", "700k" or blank → parsed or refused with a message, never a zero total that makes every role "over". (Task 2 test `parseMoney`.)
- Discarding or navigating away from unsaved budget inputs → the budget on every other page is unchanged; the Forecast page's what-if is untouched. (Task 5 test and browser check.)

---

### Task 1: Effective guidelines (pure)

**Files:**
- Modify: `merchandise/app/src/17-metrics.js` (defaults become `BENCH_DEFAULT`, `ROLES_DEFAULT`, `ROLE_OF_DEFAULT`, `MEMBER_DISCOUNT_DEFAULT = 0.25`; `BENCH`, `ROLES`, `ROLE_OF`, `MEMBER_DISCOUNT` become `let`, reassigned by `applyGuides`; `BENCH.*.text` and role `aged` advice built from the values, so "25%" and "45%+" follow the saved numbers)
- Modify: `merchandise/app/src/18-ops.js` (`seasonOf(month, firsts?)`)
- Test: `lib/merch/guides.test.ts`

**Interfaces:**
- Produces: `guideValues(doc: object|null) -> {bench, roles, roleOf, memberDiscount, seasons: {spring, summer, fall, holiday}, mix: {total: number|null, ranges: {role: [lo, hi]}}}` — defaults with valid saved keys on top; invalid keys ignored.
- Produces: `applyGuides(doc)` — reassigns `BENCH`, `ROLES`, `ROLE_OF`, `MEMBER_DISCOUNT`, `SEASON_FIRSTS` from `guideValues(doc)`.
- Produces: `seasonOf(month, firsts = SEASON_FIRSTS)` — same return shape as today; `firsts` = `{spring:1, summer:5, fall:8, holiday:11}` by default.

- [ ] **Step 1: Write the failing tests** in `lib/merch/guides.test.ts` (load 17-metrics.js and 18-ops.js via `node:vm` as `ops.test.ts` does):
  - `defaults when no document`: `guideValues(null).bench.gm.apparel === 0.45`, `.roles.fashion.wks` deep-equals `[12,16,8,24]`, `.memberDiscount === 0.25`, `.seasons` deep-equals `{spring:1,summer:5,fall:8,holiday:11}`.
  - `partial document`: `guideValues({memberDiscount: 0.3})` → discount 0.3, `bench.gm.apparel` still 0.45.
  - `bad values fall back`: `{bench:{gm:{apparel:'x'}}, roles:{fashion:{wks:[16,12,8,24]}}, memberDiscount:-1}` → apparel 0.45, fashion wks `[12,16,8,24]`, discount 0.25.
  - `role map override`: `{roleOf:{'480':'impulse'}}` then `applyGuides(...)`; `roleKey('480') === 'impulse'`, `roleKey('999') === 'fashion'`; `applyGuides(null)` restores `'fashion'` for 480.
  - `advice follows discount`: after `applyGuides({memberDiscount:0.3})`, `ROLES.fashion.aged` contains `30%` and not `25%`; `BENCH.gm.text` contains `48%+` after `applyGuides({bench:{gm:{apparel:0.48}}})`.
  - `seasons`: `seasonOf('2027-04').key === 'spring'`; `seasonOf('2027-04', {spring:1,summer:4,fall:8,holiday:11}).key === 'summer'` with `first === '2027-04'`.
- [ ] **Step 2: Run** `npx vitest run lib/merch/guides.test.ts` — Expected: FAIL (`guideValues` not defined).
- [ ] **Step 3: Implement** in `17-metrics.js` and `18-ops.js`. Valid = finite number in range (fractions 0–0.9, weeks 1–104, `lo ≤ hi`, `nearLo ≤ lo`, `hi ≤ nearHi`), known role keys only, season firsts integers 1–12 strictly increasing with spring 1.
- [ ] **Step 4: Run** `npx vitest run lib/merch` — Expected: all pass, including the unchanged `analysis.test.ts` and `engine-parity.test.ts`.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: guideline values with saved overrides on the code defaults"`

### Task 2: Mix and suggested values (pure)

**Files:**
- Create: `merchandise/app/src/19-guides.js`
- Test: `lib/merch/guides.test.ts` (add)

**Interfaces:**
- Consumes: `ROLE_OF`, `roleKey`, `ROLES` (Task 1).
- Produces:
  - `parseMoney(s) -> number|null` (accepts "$700,000", "700000", "700k", "1.2m"; blank/garbage/≤0 → null).
  - `salesShareByRole(rows) -> {role: share}` from assort rows (`t12`, `cat`, 640 excluded).
  - `suggestedRanges(shares) -> {role: [lo, hi]}` (points, ±5, floor 0, rounded).
  - `suggestedTotal(rows, turnsMid) -> number` (Σ t12 × (1 − gm) ÷ turnsMid).
  - `mixRows(onHandByRole, salesShares, ranges, total) -> [{role, name, onHand, share, salesShare, lo, hi, loDollar, hiDollar, status: 'in'|'short'|'over', gap}]` in role order fashion, impulse, hardgoods, consumable, demo.
  - `rangeSum(ranges) -> {lo, hi}`.

- [ ] **Step 1: Write the failing tests:**
  - `parseMoney`: `'$700,000'→700000`, `'700k'→700000`, `''→null`, `'abc'→null`, `'-5'→null`.
  - `suggestedRanges({fashion:0.432, demo:0.003})` → `{fashion:[38,48], demo:[0,5]}`.
  - `mixRows` with onHand fashion 223463, total 685352, range [38,48] → `status 'short'`, `gap ≈ 36971` (±1), `loDollar ≈ 260434`.
  - `mixRows` at total 750000 → fashion gap ≈ 61537; hardgoods 111568 with [5,15] → `'in'`.
  - `suggestedTotal([{cat:'480',t12:1000,gm:0.4}], 2.5) === 240`; rows with cat 640 ignored.
- [ ] **Step 2: Run** `npx vitest run lib/merch/guides.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `19-guides.js` (pure; no page globals read at load time).
- [ ] **Step 4: Run** `npx vitest run lib/merch` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: mix targets and suggested values, tested on their own"`

### Task 3: Saving, rules and the month-end reader

**Files:**
- Modify: `lib/merch/rules.ts` (`guidelines` in `OWNER_ONLY`; `docProblem` case `guidelines`), `lib/merch/rules.test.ts`
- Modify: `merchandise/app/src/90-io.js` (subscribe `guidelines/current` → `GUIDE`; `applyGuides(GUIDE)` before render)
- Modify: `merchandise/app/src/76-monthend.js` (upload body adds `guidelines: {roleOf, memberDiscount}` from `guideValues(GUIDE)`)
- Modify: `api/merch/reports.py`, `merchandise/pipeline/refresh.py`, `merchandise/pipeline/model.py`, `merchandise/pipeline/config.py`
- Test: `merchandise/pipeline/test_guidelines.py`

**Interfaces:**
- Consumes: `guideValues`, `applyGuides` (Task 1).
- Produces: global `GUIDE` (saved document or null); document shape `{bench, roles, roleOf, mix:{total, ranges}, seasons, memberDiscount, history:[{at, by, what, from, to, note?, budget?}], at, by}`.
- Produces (Python): `config.guided(g: dict|None) -> (role_of: dict, member_discount: float)` — defaults with valid values on top; `refresh.build_bundle(reports, prior, notes, guidelines=None)` threads them to the model code that reads `ROLE_OF` and `_MD`.

- [ ] **Step 1: Write the failing tests:**
  - `rules.test.ts`: `canWrite('staff','guidelines/current') === false`, owner true; `docProblem('guidelines/current', {memberDiscount: 2})` matches `/memberDiscount/`; `{roles:{fashion:{wks:[16,12,8,24]}}}` matches `/weeks/`; `{mix:{total:-1}}` matches `/total/`; `{mix:{ranges:{fashion:[50,40]}}}` matches `/range/`; `{seasons:{spring:1,summer:9,fall:8,holiday:11}}` matches `/season/`; `{history:'x'}` matches `/history/`; a full valid document → null.
  - `test_guidelines.py`: `guided(None) == (ROLE_OF, 0.25)`; `guided({'roleOf': {'480': 'impulse'}, 'memberDiscount': 0.3})` gives 480 impulse, 400 fashion, 0.3; `guided({'memberDiscount': 'x', 'roleOf': {'480': 'bogus'}})` falls back; a bundle built with `guidelines={'memberDiscount':0.3}` has advice text containing `30%` and not `25%`; a bundle built with `guidelines=None` equals today's (existing fixture tests unchanged).
- [ ] **Step 2: Run** `npx vitest run lib/merch/rules.test.ts` and `cd merchandise/pipeline && python -m pytest -q test_guidelines.py` — Expected: FAIL.
- [ ] **Step 3: Implement.** In `model.py`, replace the module-level `_MD` and `ROLE_OF` reads in the advice/flag functions with values passed down from `build_bundle` (default: config). `reports.run` reads `req.get('guidelines')` and passes it through. `docProblem` refuses a `history` longer than 200 entries.
- [ ] **Step 4: Run** `npx vitest run lib/merch` and `cd merchandise/pipeline && python -m pytest -q` — Expected: PASS, no fixture edits.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: owner-only guidelines document, read live and sent with the month-end upload"`

### Task 4: The Guidelines page — Targets, Category roles, Seasons & discount, Change history

**Files:**
- Create: `merchandise/app/src/82-guidelines.js` (`renderGuidelines(S)`, tab state in localStorage `mp.guideTab`)
- Modify: `merchandise/app/src/05-nav.js` (`FOOT_PAGES = [['guidelines','Guidelines']]`; `resolveTab`, `pageLabel` know it), `lib/merch/nav.test.ts`
- Modify: `merchandise/app/src/30-home.js` (sidebar foot link above Tools; TABHEAD for `guidelines`), `merchandise/app/src/90-io.js` (`PAGES.guidelines`, handlers), `merchandise/app/src/shell.html` (styles only, keep `<div class="wrap">`)

**Interfaces:**
- Consumes: `guideValues`, `applyGuides`, `GUIDE`, `write()`, the owner check used for owner-only controls (`ownerHere()`), the Scorecard's analysis result (`analyze(...)` in 17-metrics.js, as 35-analysis.js calls it) for "Your shop now".
- Produces: `saveGuides(patch: object, entries: [{what, from, to}], note?: string) -> Promise<boolean>` — merges `patch` into `GUIDE`, appends history entries (`at`, `by: myId`), keeps the newest 200, writes `guidelines/current`; used by Tasks 5 and 6. `goTab('guidelines', tab)` opens a tab (`targets|roles|budget|mix|seasons|history`).

- [ ] **Step 1: Write the failing test** in `nav.test.ts`: `resolveTab('guidelines') === 'guidelines'`, `pageLabel('guidelines') === 'Guidelines'`.
- [ ] **Step 2: Run** `npx vitest run lib/merch/nav.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the page from the mockup (`.superpowers/brainstorm/guidelines-mockup.html`): intro line, tab row with a "N changed" count per tab, rows of Guideline | Suggested (value + one-line source) | Your shop now (red when it misses Pasatiempo's value) | Pasatiempo (input) | Reset to suggested. Owner edits; each changed field shows a brass dot; a sticky "Save changes" bar with an optional reason field appears when anything is unsaved; "Reset this tab" is one history entry. Category roles: one row per category with a role select; each role's weeks range (lo–hi, near lo–near hi, over) edited on the role. Seasons: first month of Summer, Fall, Holiday as selects (Spring fixed at January). History: newest first, who/when/what/old → new/reason. Staff and viewers: same values as plain text, no inputs, no buttons. Under the header: "Month-end suggestions update at your next upload."
- [ ] **Step 4: Run** `npx vitest run lib/merch` and `node --check` on each changed file and on the sorted join of `merchandise/app/src/*.js` — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: Guidelines page for targets, roles, seasons and the member discount"`

### Task 5: Budget inputs with a before/after preview

**Files:**
- Modify: `merchandise/app/src/82-guidelines.js` (Budget inputs tab), `merchandise/app/src/70-forecast.js` (`saveAssumptions` writes only saved overrides for `wos`: `{...(SAVED||{}).wos, ...(WHATIF||{}).wos}`, not the merged defaults)
- Modify: `merchandise/app/src/19-guides.js` (pure helper below), `lib/merch/guides.test.ts`

**Interfaces:**
- Consumes: `assumptions()`, `runEngine(base, a, carry)`, `planFor(E, fy, a, carry)`, `curFY()` from 20-engine.js; `wksNow(code, cost)`; `saveGuides` (Task 4) for the history entry.
- Produces: `wosPreview(base, a, changes: {code: weeks}, fy, carry) -> {months: [YYYY-MM], before: {code|'total': [leftToBuy]}, after: {...}}` computed by running the engine twice (`a` and `{...a, wos: {...a.wos, ...changes}}`); the page keeps unsaved state in its own `GW = {}`, never `WHATIF`.

- [ ] **Step 1: Write the failing test:** `wosPreview` with the engine-parity fixture's base and `{480: a.wos['480'] + 2}` → `after['480']` ≥ `before['480']` in every month, and `before` equals the engine's Left to buy for 480 without changes; `{}` → `before` deep-equals `after`.
- [ ] **Step 2: Run** `npx vitest run lib/merch/guides.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the tab: one row per category (Suggested = `BASE.defaults.wos`, Your shop now = `wksNow(code, onHand)`, Pasatiempo = saved or suggested). An edit puts the value in `GW` and shows the pinned panel "Effect on <categories> before you save": Left to buy by month for the plan year, now vs with the change, per changed category and total, green when higher, red when lower. **Save to the budget** writes `plan/assumptions` = `{...SAVED, wos: {...SAVED.wos, ...GW}}` (a Reset removes the key), then `saveGuides({}, entries, note)` with `budget: {through: '<last plan month>', change: <total Left to buy change>}`; **Discard** clears `GW`. Leaving the page with `GW` non-empty asks "Discard unsaved budget changes?".
- [ ] **Step 4: Run** `npx vitest run lib/merch` — Expected: PASS (engine-parity unchanged).
- [ ] **Step 5: Commit** `git commit -m "Merchandise: budget weeks of supply on the Guidelines page, previewed before saving"`

### Task 6: Merchandise mix, To do flag, "why is this red?" links, README

**Files:**
- Modify: `merchandise/app/src/82-guidelines.js` (Merchandise mix tab), `merchandise/app/src/30-home.js` (To do item `kind:'mix'`), `merchandise/app/src/35-analysis.js` and `merchandise/app/src/40-lists.js` (guideline links), `merchandise/README.md`

**Interfaces:**
- Consumes: `parseMoney`, `salesShareByRole`, `suggestedRanges`, `suggestedTotal`, `mixRows`, `rangeSum` (Task 2); `saveGuides` (Task 4); `BASE.cats[*].onHand`, `ASSORT.rows`.

- [ ] **Step 1: Implement the mix tab** from the mockup: "Total stock to plan for" input (parsed with `parseMoney`; invalid → inline "Type an amount like $700,000"), beside Suggested (`suggestedTotal`, with "cost of 12-month sales ÷ N turns") and Now on hand, each with a "Use" button; "Targets add up to lo–hi% of the total", in red when lo > 100 or hi < 100; one row per role: name, $ on hand, lo–hi % inputs = $ range at the total, range bar (band, stock dot red when out, sales tick), "In range" / "$X short" / "$X over"; expanding a role lists its categories' on hand. Saved via `saveGuides({mix})`.
- [ ] **Step 2: Add the To do item** for each role out of range at the saved (or on-hand) total: title "<Role> is $X short of its mix range" / "$X over", low severity, `data-go="guidelines:mix"`.
- [ ] **Step 3: Add guideline links:** each red cell on the Scorecard and each guideline-driven To do item gets "Guideline: <rule>" opening `goTab('guidelines', <tab>)`; the Scorecard's "Rules of thumb" box reads the effective `BENCH.*.text`.
- [ ] **Step 4: Update** `merchandise/README.md`: the Guidelines page, the two stores, owner-only, next-upload rule.
- [ ] **Step 5: Run** `npx vitest run lib/merch`, `cd merchandise/pipeline && python -m pytest -q`, `node --check` on the sorted join — Expected: PASS.
- [ ] **Step 6: Browser check (signed in, controller):** Guidelines opens from the sidebar; with nothing saved, Scorecard, Budget and To do read exactly as before (baseline: room −$330,232, on hand $710,647); mix shows fashion apparel $36,971 short at $685,352; typing $750,000 shows $61,537 short; a budget-input change previews, then Discard leaves Budget unchanged; as a viewer (`readOnly = true`) no inputs or buttons. Remove any test save.
- [ ] **Step 7: Commit** `git commit -m "Merchandise: merchandise mix targets, a To do flag and links from red flags to their guideline"`
