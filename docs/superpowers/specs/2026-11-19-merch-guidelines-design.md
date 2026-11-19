# Merchandise Program: a Guidelines page

## Intent

The program grades the shop and makes suggestions by rules of thumb written into the code: margin, GMROI, markdown,
aged-stock and turns targets; weeks-of-supply ranges and advice by category role; which role each category plays; the
member discount; the season months; and the target weeks of supply that drive open-to-buy. Ian (the owner) wants one
place to see every rule and change it to fit Pasatiempo, plus a new **merchandise mix** target, so the program's flags,
To do items, Season buys and budget follow the shop's own targets rather than general ones. Staff (CJ, Chris) and
viewers (Ken, Steve) read the page to understand why something is flagged; only the owner changes it.

## Decisions made with Ian

- **Both kinds of rule are editable, and budget-moving ones preview first** (Ian: "Both, with a preview").
- **Approach A — two stores** (Ian picked A):
  - Budget inputs (target weeks of supply per category) are saved where the budget already reads them:
    `plan/assumptions.wos`, the same document the Forecast page saves growth to. The unsaved preview uses the existing
    what-if layer (`WHATIF.wos`), so no budget math changes.
  - Everything advisory goes in a new owner-only document, `guidelines/current`.
- **Merchandise mix = target share of stock dollars** (Ian: "Share of stock $"), by category role.
- **Ian types the total stock to plan for**; each role's dollar target = total × its percentage range, and changing the
  total re-computes every role's dollars (Ian: "i want to adjust the total and it adjusting the rest based on
  percentages"; "I type it"). The page shows today's on-hand next to it and a "Use what's on hand now" button.
- **Month-end suggestions catch up at the next upload** (Ian: "Next upload is fine"). Pages the program judges itself
  (Scorecard, flags, weeks-of-supply, Season buys, mix) follow a saved change at once; To do items and advice written
  by the month-end upload keep their wording until the next upload. The page says so: "Month-end suggestions update at
  your next upload."
- Mockup reviewed in the browser: `.superpowers/brainstorm/guidelines-mockup.html` (look B, six tabs).

## Approaches considered

- **A. Two stores (chosen).** Budget targets in `plan/assumptions` (already read by `20-engine.js` and
  `pipeline/engine.py`, with what-if preview); advisory rules in `guidelines/current`. No budget-engine change.
- **B. One settings document.** One place for everything, but the budget engine and its parity test would have to read
  a new source — a change to budget math every earlier step avoided.
- **C. Edit the constants in code on request.** No page; rejected because Ian wants to change them himself.

## Goals

1. A **Guidelines** page, linked at the bottom of the sidebar above Tools (page id `guidelines`), with tabs:
   **Targets**, **Category roles**, **Budget inputs**, **Merchandise mix**, **Seasons & discount**, **Change history**.
2. Every rule shows three reference columns before Pasatiempo's value, so a change is made against something (Ian: "I
   want the suggested settings/data points to be there so we can reference when we change it"):
   - **Suggested** — the program's recommended value and, under it, where it comes from in plain words ("rule of thumb
     for club apparel", "AGM private-club average 2.65", "share of 12-month sales ± 5 points", "cost of 12-month sales ÷
     2.5 turns"). Suggested values are the code defaults, or computed from the shop's own data where the rule is
     data-driven (mix ranges, total stock).
   - **Your shop now** — the shop's actual figure for that rule from the latest month-end data (e.g. apparel margin,
     shop GMROI 1.53, aged stock %, turns, each category's current weeks of supply), red when it misses Pasatiempo's
     value.
   - **Pasatiempo** — the editable value. A changed value is marked (brass dot, field tint) with "Reset to suggested".
     Each tab has "Reset this tab".
3. **Targets:** margin by segment (apparel 45%, accessories 40%, equipment 25%), GMROI (apparel/accessories 2.0,
   equipment 1.0), markdowns under 15% of sales, aged stock under 10% of stock, turns 2–3 (fast-turn 3), and the "near"
   tolerances — the values in `BENCH` (`17-metrics.js`).
4. **Category roles:** each category's role (`ROLE_OF`), and per role its weeks-of-supply range `[lo, hi, nearLo,
   nearHi]` and "too much stock" weeks (`ROLES[*].wks`, `.over`). Role names and advice text stay fixed.
5. **Budget inputs:** target weeks of supply per category (defaults `BASE.defaults.wos`). Editing puts the value into
   `WHATIF.wos` and opens a pinned preview panel: Left to buy by month for the plan year, before and after, for each
   changed category and in total. **Save to the budget** merges into `plan/assumptions` (keeping growth); **Discard**
   clears the what-if. Leaving the page with an unsaved change asks first.
6. **Merchandise mix:** a typed total (default: current on hand at cost, 640 excluded), shown beside a **suggested
   total** (cost of the last 12 months' sales ÷ the midpoint of the turns target — about $637,000 today) and today's on
   hand, each with a "Use" button; and per role a percentage range
   (defaults: the role's share of 12-month sales ± 5 points, floored at 0, rounded to whole points). Each role row shows
   on hand $, target $ range at the typed total, a range bar (target band, stock-share dot, sales-share tick), and
   "In range" / "$X short" / "$X over". A line shows what the ranges add up to. Opening a role lists its categories'
   on hand (read-only).
7. **Seasons & discount:** the member discount (25%) and each season's months (Spring Jan–Apr, Summer May–Jul,
   Fall Aug–Oct, Holiday Nov–Dec), edited as the first month of each season; the four must cover the year in order.
8. **Change history:** every saved change on this page — who, when, what, old → new, and an optional reason note typed
   at save. Budget-input saves also record the change in Left to buy through the plan year.
9. **The program uses the saved values everywhere:** Scorecard grading and shading, Brands/subcategory flags, To do
   suggestions and advice, weeks-of-supply judgements, Stuck money, Season buys (season months), markdown advice
   (member discount), and the month-end upload's suggestions (the Python pipeline gets the saved role map and member
   discount with each upload).
10. **"Why is this red?" links:** where a guideline turns something red or raises a To do item, a small
    "Guideline: <rule>" link opens the matching tab of the Guidelines page.
11. **Mix flag:** a role outside its mix range at the typed total adds a To do item ("Fashion apparel is $36,971 short
    of its mix range") linking to the mix tab.

## Non-goals

- Growth assumptions stay on the Forecast page.
- Planned markdown rates per category (`MARKDOWN` in `pipeline/config.py`) are not editable here.
- No brand budgets; mix is by role only, not by category.
- Role names and advice wording are not editable.
- No change to `matchArrivals` or the budget engine's formulas.

## Anti-goals (would make it a failure)

- A budget number changes without the owner seeing the effect first.
- Staff or viewers can change a rule.
- Two pages disagree because one reads the saved rule and another the code default.
- With no `guidelines/current` saved, anything differs from today: every page must behave exactly as now.

## Constraints

- Owner-only writes: add `guidelines` to `OWNER_ONLY` in `lib/merch/rules.ts` (not `STAFF_WRITABLE`), and have
  `docProblem` validate it: percentages 0–100, weeks 1–104, `lo ≤ hi`, member discount 0–0.9, season months 1–12 in
  order, total > 0, history entries well-formed. `plan/*` is already owner-only.
- The page reads `guidelines/current` live like other documents (add to the subscriptions in `90-io.js`).
- Defaults stay in code (`BENCH`, `ROLES`, `ROLE_OF`, `seasonOf`, `MEMBER_DISCOUNT`); effective value = default with the
  saved document on top, key by key, so a missing or partial document falls back cleanly. Existing tests
  (`engine-parity`, `analysis`, pipeline pytest) stay green with no fixture edits; new tests cover overrides.
- `seasonOf(month)` stays pure; it gains an optional season-definition argument defaulting to today's months.
- Look B tokens and existing components (cards, tabs, inputs, `16-charts.js` SVG). No new libraries. Plain English.
- Desktop first; under 900px the page stacks. Viewers see values but no inputs' edit state, no Save/Reset buttons.

## Claude's calls (from the builder check; Ian can overrule)

- **Pipeline scope:** the month-end pipeline reads only the role map and member discount from the guidelines. Its own
  reorder thresholds (under 6 weeks, 9-week cover) stay as they are; the role weeks-of-supply ranges apply in the app.
- **Budget inputs:** "before" in the preview is the budget as it stands (defaults with the saved plan on top). Save
  writes only the categories changed on this page into `plan/assumptions.wos` and leaves growth untouched; this page
  keeps its own unsaved state, separate from the Forecast page's what-if. The preview covers the plan year's months.
  Reset to default removes the category's saved value. The history entry stores the Left to buy change computed at save.
- **Mix:** covers all five roles, including the demo fleet (it is stock at cost); 640 is excluded. The "adds up to"
  line warns (no blocking) when the low ends total over 100% or the high ends under 100%. Defaults are computed live
  from sales share until Ian saves a range; a saved range stays put, and Reset returns it to the live default.
- **Roles and segments:** reassigning a category's role changes its weeks-of-supply range and advice, not its margin
  and GMROI segment (apparel / accessories / equipment stays as now). A category with no role keeps today's default
  (fashion).
- **Upload:** month-end uploads are owner-only already, so the browser sends the saved role map and discount with the
  upload request; the server doesn't read the guidelines itself.
- **History:** "Reset this tab" is one entry; the log keeps the newest 200 entries and drops the oldest.
- **Seasons:** the four seasons stay in calendar order within the year (no season crosses New Year). Changing them
  re-labels orders, since an order's season always comes from its delivery month.

## Calls left to the builder

- Exact storage shape inside `guidelines/current` (suggested: `{bench, roles: {fashion: {wks, over}}, roleOf, mix:
  {total, ranges: {fashion: [lo, hi]}}, seasons: {spring: 1, summer: 5, fall: 8, holiday: 11}, memberDiscount,
  history: [...]}`), and capping history (e.g. last 200 entries) to stay under the 256 KB document limit.
- How the upload passes the role map and discount to `api/merch/reports.py`.
- Input styling details and keyboard behaviour, following the mockup.
