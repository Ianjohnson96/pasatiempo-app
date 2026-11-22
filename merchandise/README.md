# Pro Shop Merchandise Program

The Pro Shop's forecast, open-to-buy (OTB), order book and brand scorecard. It runs as a section of this club app at `/merch` (its own domain can be added in `lib/sections.ts`). Staff sign in with an email and password the owner sets. Nobody needs a Claude account.

```
pipeline/     POS reports (PDF, Excel or CSV)  ->  month-end documents and a loadable data file (Python)
app/src/      the program page: plain HTML/JS, one file per area
app/host/     club-shim.js: backs the page's database and user with the club app
app/build.py  optional standalone single-file build of the page, with data embedded
../api/merch/reports.py   the pipeline as a Vercel Python function, for the Month-end page's upload
```

The page is served by `app/merch/route.ts`. It assembles `app/src` with the shim at request time (see `lib/merch/page.ts`). All data lives in the hub Supabase project's `merch` schema (`supabase/migration-merch-schema.sql`): one row per JSON document, addressed by path, e.g. `pos/{id}`, `vendors/{id}` or `base/current`. The browser reads and writes documents only through `/merch/api/db`. It polls every 15 seconds and again when the tab comes back into view. Every write is checked against the rules in `lib/merch/rules.ts`. POS reports and generated data are git-ignored.

## Who can do what

| Role | Can |
|---|---|
| owner | everything, including the forecast (`plan/…`), budget changes, brand calls and month-end data (the Month-end upload, or `/merch/admin`) |
| staff | orders, receipts, vendors, subcategories, counts, to-do states, month-end checklist, brand assignments and SKU sorting |
| viewer | read only |

Roles are granted per app on the hub's **People & access** page (`/admin/people`, stored in `hub.access`; see `lib/hub/access.ts`). A super admin is an owner here. Everyone signs in once for all Pasatiempo apps.

## Setup (once)

1. Run `supabase/migration-merch-schema.sql`, then `supabase/migration-merch-imports.sql` and `supabase/migration-merch-history.sql`, in the hub project. Then add `merch` under Settings → API → Exposed schemas.
2. For now the program is served by path at `pasatiempo-app.vercel.app/merch`. To give it its own domain later, add the domain to the Vercel project and list it under the `merch` entry in `lib/sections.ts`.
3. Sign in at that address. Open your name (top right) → **Load month-end data** and load the latest data file. Add staff on `/admin/people`. After that, each month's reports are uploaded on the Month-end page.

Staff can write only the collections listed in `STAFF_WRITABLE` (`lib/merch/rules.ts`); anything new is owner-only until it's added there. `docProblem()` rejects an order, budget change or assignment document whose numbers, dates or status the page couldn't use, and the page says what was wrong.

**Saving.** Every save sends the version it was read at (`ifVersion`). If someone saved the same document since, the page fetches theirs and merges field by field, two levels deep (`merge3` in `app/host/club-shim.js`): a field this person changed keeps their value, every other field keeps the other person's. That covers two people assigning different SKUs' brands, sorting SKUs, or ticking the same checklist. After three tries it gives up and says so.

**History.** `merch.doc_history` (`supabase/migration-merch-history.sql`) keeps what each hand-entered document held before every change or delete, for 400 days, so a deleted order can be found and put back (the query is in the migration).

## Category roles

Every category has a job in the shop (`ROLES` and `ROLE_OF` in `app/src/17-metrics.js`, mirrored in `pipeline/config.py`), and is judged by it:

| Role | Categories | Weeks of supply | Judged on |
|---|---|---|---|
| Fashion apparel | 400, 430, 470, 480, 490, 500 | 12–16 | sell-through, markdowns, GMROI |
| Accessories & hats | 440, 620, 660 | 12–20 | turns, the best styles in stock |
| Balls & gloves | 160, 320 | 8–16 | never running out (reorders are suggested even when the category is overbought) |
| Hard goods | 200, 300, 350 | 16–26 | margin dollars and a thin, current shelf that backs fittings and special orders |
| Demo fleet | 220 | not judged on weeks | a fitting tool: sell off demos older than a season |

The shop sells only logo soft goods, which can't go back to the vendor, and members get 25% off them (`MEMBER_DISCOUNT`), so markdown advice for soft goods says to go past the member discount. Equipment brands that sell slowly are carried thinner (*Reduce*) rather than dropped, since the shop carries stock clubs; one is dropped only when it has stopped selling or is too small. The Budget page's overbought advice, the To do wording, the Scorecard's role label and the Stuck money target all follow the role.

## Most important this week

The top of **Today** (and the To do page) lists the six decisions worth the most money (`topDecisions` in `app/src/30-home.js`): order problems, item to-dos and the scorecard's suggestions on one scale, dollars at stake at cost, at most two of each kind (cut, cancel, chase, push out, reorder, mark down, hold, fix). Done or Not now takes one off the list (`istate/{id}`); the full To do list below is unchanged.

## Pages

Fourteen pages in four groups, listed in the sidebar (`NAV` in `app/src/05-nav.js`). Everyone opens on **Today** the first time; after that the program opens on the last page used in that browser.

| Group | Page | What it shows |
|---|---|---|
| Every day | Today | Four headline tiles (sales, margin, room to buy, sales per round), the decisions worth the most money this week, sales and receiving room by month, checklists that are due, and orders due in. Charts click through to the detail. Prints on one page |
| | Orders | Purchase orders with sizes. Each order is checked against the budget of the fiscal year it arrives in. **On hold** marks an order that was placed but needs fixing (missing sizes or quantities, or held by the vendor); `fix` says what. It still counts against the budget, and can be saved with lines that have no quantities yet. Each order has an order date, which is required |
| | Receiving | What has arrived but is not in the POS yet, late orders, orders due this month and a backlog-by-vendor chart (see Receiving below) |
| | To do | Order alerts plus item suggestions (`insights/current`) |
| | Vendors | A page listing every vendor with its open orders, open cost and next delivery. **Edit** and **+ Add a vendor** open the vendor drawer |
| Plan & buy | Budget & open-to-buy | Budget left by category for the chosen fiscal year and month, the category × month open-to-buy grid (this FY, next FY, calendar year), the inherited-stock table and the classic OTB worksheet |
| | Season buys | Each season's buy, prebooked against reorders, with what is held back (see Season buys below) |
| | Forecast | Sales by month for this year and next. Growth, extra category growth and target weeks can be edited as a what-if, and the owner can save them as the plan (`plan/assumptions`) |
| Analyse | Scorecard | Every category, opening to its subcategories: sales, growth, share of sales against share of stock, margin, markdowns, turns, GMROI, weeks and aged stock, shaded against the rules of thumb; a growth-against-GMROI bubble chart. Subcategory calls, special orders and **Sort SKUs** are here |
| | Brands | Scorecard by segment with a suggested call (Grow / Keep / Watch / Reduce / Drop). The owner can override a call in `brandCalls/{id}`. Orders link to brands by vendor name |
| | Stuck money & markdowns | Stock over 16 weeks of sales, aged stock, the cash a 30% markdown would free, markdown candidates by subcategory, lines to reorder, and the oldest items |
| | Trends & rounds | Shop sales by month, seasonality, each category's two years, and spend per round: retail sales per round by month against a year earlier, and rounds by member, guest, public and other |
| Month-end | Upload & close | The upload, the checklists on the reporting calendar (`checklist/{key}`), refresh history (`refreshes/{asOf}`) with Undo last update, forecast vs actual, and How the program works |
| | Counts | On hand by category; quarterly counts |

Every chart has a hover readout and a table or readout of the numbers behind it, and most click through to the page that holds the detail. Charts are hand-built SVG (`app/src/16-charts.js`), with no chart library.

## Analysis

Today and the Analyse pages are worked out in the browser from `assort/current` (`app/src/17-metrics.js`, tested in `lib/merch/analysis.test.ts`); charts are `app/src/16-charts.js`. Special orders are left out. Growth compares only months that have a year-earlier month in the data, so until there are 24 months it covers fewer than 12 (the page says which). Suggestions are rules, one per line, ranked by the dollars involved: stock heavier than sales, aged stock over 10%, markdowns over 15%, more than 30 weeks of supply, fast growth with under 8 weeks, GMROI under the guideline, and sales falling 25% with stock behind them.

The rules of thumb (`BENCH` in `17-metrics.js`) are general guidelines for a private-club pro shop, not the club's own targets: aged stock under 10%, markdowns under 15%, 12–16 weeks of supply, GMROI above 2 for apparel and accessories and above 1 for equipment, 2–3 turns (3–4 for balls and gloves), and margins of 45% for apparel, 40% for accessories and 25% for equipment. The Scorecard shades by them, and the subcategory section of the Scorecard and the Brands table mark a figure red on the same cut-offs (`offBench`): weeks of supply outside 8–24, GMROI under three-quarters of its guideline, aged stock over 15%.

## The model

Fiscal year: May 1 – Apr 30. Sales are at retail. Stock and budgets are at cost.

- **Plan year:** the fiscal year of the first month not yet closed (`engine.plan_fy`, `curFY()` in `20-engine.js`). After the April close that is the next year even though the data still belongs to the closing one; "last year" for a month is then this data's actual for it (`last_year` / `lastYear`), not the older history.
- **Growth by fiscal year:** `config.GROWTH_DEFAULT` and the saved plan (`plan/assumptions`) hold `growth: {"YYYY": {months: {YYYY-MM: g}, cats: {cat: g}}}`, each year against the one before. `engine.resolve` / `assumptions()` read the plan year's months and categories (`g27`, `g27cat`) and the next year's categories (`g28`), defaults first, the saved plan over them key by key, then the viewer's what-if. Nothing is re-keyed when the year turns: the FY2028 category growth set in FY2027 becomes the current year's category growth after May. A year with no growth set repeats the year before, and the upload says so. Older saved plans (`g27`, `g27cat`, `g28` with no year) are read as belonging to the year of their `g27` months. Add the coming year's defaults to `GROWTH_DEFAULT` at each year-end.

- **Sales, this (plan) year:** closed months are actual. Each open month = the same month last year × (1 + month growth + category extra growth).
- **Sales, next year:** this year × (1 + next-year growth for the category). Beyond that, next year repeats.
- **Shelf sales** = sales less special orders. Budgets count shelf sales and shelf stock only (see Special orders below).
- **Cost of sales** = shelf sales × (1 − realized margin from the cost & margin report).
- **Target end-of-month stock** = target weeks × (next four months' cost of shelf sales) ÷ 17.3. Opening stock is on hand less special-order stock.
- **Linked to the mix total.** While the owner has a total stock to plan for saved (Guidelines → Merchandise mix, `guidelines/current` `mix.total`), every budgeted category's target weeks are multiplied by one factor so that target month-end stock, averaged over the first 12 months the engine plans, equals that total (`mixScale` in `20-engine.js`, `mix_scale` in `engine.py`). Turns are a year's cost of sales over average stock and the suggested total is that cost over the turns target, so the budget and the mix then agree. Typed weeks set how the total splits between categories. With no total saved the factor is 1. Unsaved edits don't move the budget; the month-end upload sends the saved total (`config.mix_total`), and Update brands reads it from `guidelines/current`.
- **OTB for a month** = target EOM − opening stock + cost of sales. In the current month, cost of sales covers only the part not yet sold.
- **Next year's opening stock** = this year's April target + carry. Carry = max(this year's budget with changes, committed, 0) − this year's plan budget.
- Special Orders (640) count in sales but never get a budget.

`pipeline/engine.py` and `app/src/20-engine.js` implement the same model. They must agree. With the Sep 11, 2026 reports, before special orders were left out, the FY2027 remaining budget came to $717,316 with default FY2028 growth, or $702,037 with FY2028 growth set to 0. The second figure matched the original published plan's $701,996, give or take rounding in SKU prices. With the Sep 30, 2026 data, leaving special orders out takes the FY2027 budget from $670,381 to $556,232 and Golf Clubs from $64,485 to −$15,266.

## Brands

A SKU's brand comes from its description (`pipeline/brands.py`, a list of brand names and their spellings) unless someone has assigned it. On the Brands tab, **Assign brands** lists every SKU with stock or sales (`brandskus/current`, written at each upload), starting with the ones with no brand. Anyone who can log orders can:

- give a SKU its brand, including a new brand the list doesn't know yet (typing an existing brand in any case uses its spelling);
- split a SKU that carries several brands by percentage (e.g. a towel SKU shared by PRG and Winston). Each brand gets that share of the SKU's sales, stock, margin and deliveries;
- put a SKU back to its description.

Assignments are kept in `brandmap/current` (`{sku: [{b: brand, s: percent}]}`, not replaced by data files). The reader applies them at the next month-end upload (`brand_split()`), in the brand scorecard, the SKU list and delivery matching.

**Edit brands** (owner) changes the brand list itself, kept in the same document:

- `words: {brand: [word or phrase]}` — words that find a brand in item descriptions (whole words, any case). They're checked before the built-in list in `brands.py`, so they can add a brand or correct one. A word belongs to one brand; giving it to another moves it.
- `rename: {old: new}` — a brand's new name wherever it comes from (the built-in list, words or assignments). Renaming into an existing brand merges the two; Undo takes a rename back out. The owner's call on the old name is copied to the new one.

The page shows new names and words at once (brand labels, the SKU list's "no brand" count).

**Update brands** (owner) rebuilds the scorecard (`brands/current`) and the SKU list (`brandskus/current`) with the latest assignments and brand list, without new reports. Each upload saves what that needs beyond the stored history and prices in `brandin/current` (`model.brand_inputs()`: per SKU its price, on-hand, cost, last sale, SKU Analysis description and cost & margin figures). The button gets the same pass and documents as an upload (`/merch/api/refresh`), sends them to the reader with `"rebuild": "brands"` (`refresh.rebuild_brands()`, which puts the stored documents back into the context `build_brands()` takes), and saves the result through `/merch/api/import`. It gives exactly what an upload of the same reports would; the button is highlighted when brand changes are newer than the scorecard (`brands/current.at`).

**Reused SKU numbers.** A SKU number reused for a new product carries the old product's sales in the POS. Assign brands marks it (`brandmap/current` `recycled: {sku: {from: "YYYY-MM", brand, cat, desc}}`): `split_recycled()` moves the months before `from` to a retired key (`sku~YYYY-MM`) that keeps the old product's category, description, price and brand (`brand_assignments()`), so the number starts fresh. Special orders (640) are off the scorecard either way; there the split keeps delivery matching and the category's history right.

**New descriptions.** Each upload compares every SKU's SKU Analysis description with the last upload's (`desc_changes()`, against `brandin/current`). A change is flagged in `brandskus/current.changed` and `brandin/current.changed`, counted in the upload preview, and listed under Assign brands → New description until someone answers: reused (marks it as above, with the old description and category) or same product (`checked: {sku: description}`).

## Subcategories

Inside each category, the subcategory section of the **Scorecard** shows where the sales and the stock are, with the brand scorecard's measures: 12-month sales and share of the category, trend, on hand, weeks of supply, margin, GMROI, aged stock, what the Order Book has committed this year, and a call. Special orders show in the category they sell as, flagged (see below). It is reporting only: budgets stay by category.

- The subcategory list is the program's own (`subcats/{id}`, the same list order lines use).
- A SKU's subcategory comes from its description (`config.SUB_RULES`, checked in order; `model.sub_auto`), unless someone sets it under **Sort SKUs** (`submap/current`: `{skus: {sku: subcat id}}`, where `""` means not sorted). Choosing the one the description gives removes the override. A rule for a subcategory that was removed is skipped. Tick several SKUs (shift-click ticks a run) to change their category, subcategory or special-order mark at once; the list keeps its place after each change.
- The report is `assort/current` (`model.build_subcats`), built at every month-end upload and by **Update brands** / **Update subcategories** (both rebuild the scorecard and the report). The category panel on Budget & open-to-buy shows the same split.

## Special orders

Items bought for one member (custom clubs, a named order, imprinted balls) or one group (an invitational, member-guest, an outside group's logo order) sell as ordinary categorized items. They are not a category of their own:

- **Reports** show them in the category they sell as, with a *Special order* tag and their share of sales (the subcategory section of the Scorecard, the brand scorecard, the Forecast's by-category table). Weeks of supply, GMROI and the call count shelf sales against shelf stock; a line that is nearly all special orders with nothing on the shelf gets the call *Special orders*.
- **Budgets** count shelf sales and shelf stock only. `model.special_budget` stores each category's special-order sales by month (`base/current` `cats[c].so`, the category's own figures split the way its SKUs' sales split) and its special-order stock (`soOnHand`); the engine leaves out the month's own share, or the same month's a year earlier for a month that hasn't happened.
- **Which SKUs** come from the description (`config.SO_*`, `model.so_auto`): a customer's name in brackets, a group or event word, the custom-fitting and custom-imprint subcategories, and everything rung to Special Orders (640), except rentals, repairs and fees there, which are *Not retail* and left out of the reports. Fitting stock stays shelf stock.
- **Special Orders (640) items** report in the category their description names (`config.SELLS_AS`, `model.sells_auto`); the ones it doesn't (Sip-N-Shop and logo orders) wait under **Needs a category**. 640 itself stays outside the budgets.
- **Sort SKUs** corrects any of it (`submap/current` `so: {sku: "member" | "group" | "notretail" | "shelf"}`, `cat: {sku: category}` for 640 items, or a SKU rung to the wrong category; that one reports in the category set, while its budget stays with the POS category until the SKU is moved in the POS). **Update subcategories** (or **Update brands**, or a month-end upload) puts the changes into the reports and the budgets (`refresh.rebuild_brands` also rewrites `base/current`'s `so`, `soOnHand` and category calls).

## Navigation

The four groups sit in a sidebar, each listing its pages (`NAV` in `app/src/05-nav.js`). The open page is remembered in the browser (`ob.tab2`). Old page ids still work, from a saved browser, an emailed link or an older button, and `TAB_ALIAS` sends them to where they live now: `summary` to Today, `otb` to Budget & open-to-buy, `subcats` to Scorecard, `rounds` to Trends & rounds, and `reports` and `help` to Upload & close. A link can name a spot on a page as `page:key` (for example `overview:2027-03`).

## Receiving

Boxes go to the store room, the invoice goes to Chris or CJ, and the goods are received into the POS when time allows. Until then neither the POS nor the program knows they are in the building, so the **Receiving** page lists, oldest first, every order with goods that have arrived but are not in the POS yet, with the dollars waiting in the store room. Below that it lists **Late** orders (past their delivery month) and orders **Due this month**, with a **Backlog by vendor** chart (store room plus late, at cost) whose bars open that vendor's orders. There is no box-by-box check-off.

- **Invoice in** on an order adds one entry to its `invoicesIn` list: `{date, by, at, rcvd, amount?, invoice?, note?, source}`. The amount is optional; with no amount the whole open balance counts as arrived. `rcvd` is what the order showed received when the entry was made (`makeInvoiceEntry`), so a second shipment of a partly received order counts from there. `source` says where the entry came from (`'hand'` for the button).
- **Store room** dollars for an order (`storeRoomValue` in `app/src/18-ops.js`) count from base, the smallest `rcvd` among the live entries (an entry without `rcvd` counts as 0, as entries made before it existed did). The entries add up to what arrived since base (an entry without an amount is the whole open balance at its entry, total − its `rcvd`), capped at total − base; the store room is that less what has been received since base (received − base), never below zero. The order is listed as arrived while that is above zero and it isn't Received or Cancelled. It is a reminder only. Budget, open-to-buy and the order's own status never change because of an invoice entry.
- **Clear** takes an order off the list once its goods are in the POS. It sets `invoicesClearedAt`, hides the entries made before that (entries with no `at` count as cleared; the receiving log's entries will need one), and never sets received or receipts. Clear only takes an order off the store-room list: with nothing newer arrived, an order that still has an open balance goes back to Late, Due this month or later by its delivery month, on Receiving, Today and the sidebar count. An invoice entered after a Clear brings the order back.
- Month-end matching (see Deliveries) still records the deliveries from the POS. When it does, the order's `received` rises and the store-room figure falls by the same amount.
- Orders are marked late when the delivery month has passed and nothing is waiting in the store room.

The receiving log, an Excel spreadsheet, will later write the same `invoicesIn` entries with `source: 'log'`, so nothing on this page needs to change when it is linked.

## Season buys

**Season buys** shows what is committed to each season, by delivery month. Seasons: Spring is January to April, Summer May to July, Fall August to October, and Holiday November and December (`seasonOf` in `app/src/18-ops.js`). Pick a season with the chips at the top.

- **Committed** is the cost of what is on order for delivery in the season plus goods already received. It comes from the same ledger as the Budget page, and a received delivery counts in the month it arrived.
- **Prebooked** is an order placed before the season began. **Reorders** are orders placed during or after the season. **Order date unknown** is an order whose order date the program cannot read; open it on Orders and fix it.
- **Held back** is the Budget page's Month by month grid's Left to buy summed over the season's months, so it matches that page. The season under way is always listed, even with nothing on order, so the seasons' held back adds up to the year's Left to buy. If the season runs past the end of the budget, only the months inside it count, and the page says so.
- Special Orders (640) are left out. Anything outside the budget categories shows on an Other row.
- A chart shows committed by month (prebooked, reorders, unknown), with tables by category and by brand. Clicking a month opens that month on Budget & open-to-buy.

The page is read only and adds no budget math. The order date is stored as `YYYY-MM-DD`: the page writes it that way on every save of a `pos/` document, and `docProblem` in `lib/merch/rules.ts` rejects any other non-blank form. A blank order date is allowed, and on Season buys it counts as a Reorder; only a non-blank date the program can't read shows as **Order date unknown**.

## Guidelines

The **Guidelines** page (bottom of the sidebar) holds every rule the program grades and suggests by. Each line shows
**Suggested** (the program's default and where it comes from), **Your shop now** (the latest month-end figure, red when
it misses) and **Pasatiempo** (the owner's value). Only the owner changes them; everyone else reads. Tabs:

- **Targets** — margin, GMROI, markdowns, aged stock, turns, and how close counts as "near".
- **Category roles** — each category's role, and each role's weeks-of-supply range and "too much stock" weeks.
- **Budget inputs** — target weeks of supply per category. An edit shows Left to buy by month now and with the change
  (the budget engine run twice, `wosPreview` in `19-guides.js`); **Save to the budget** writes only the changed
  categories into `plan/assumptions.wos`, the same document the Forecast page saves growth to.
- **Merchandise mix** — a total stock to plan for (typed, the suggested cost of 12-month shelf sales ÷ the turns target,
  or today's shelf stock) and each role's target range in percent; each role shows its dollars short or over. A role out
  of range adds a To do item. Stock here is shelf stock at cost, as the budget counts it (special orders left out). A
  saved total links the budget to it (see The model): the tab shows the factor on target weeks, the average target
  stock and the year's Left to buy, and Budget inputs shows each category's weeks as the budget uses them.
- **Seasons & discount** — the season months (saved as one set, in calendar order from January) and the member discount.
- **Change history** — who changed what and why (newest 200).

Everything except the weeks of supply is saved in `guidelines/current` (owner-only, checked by `docProblem`). The code
defaults stay in `17-metrics.js` (`BENCH_DEFAULT`, `ROLES_DEFAULT`, `ROLE_OF_DEFAULT`, `MEMBER_DISCOUNT_DEFAULT`) and
`18-ops.js` (`SEASON_FIRSTS`); `guideValues` lays the saved values over them key by key and ignores anything invalid,
and `applyGuides` makes them the values every page uses. With nothing saved, everything behaves as before. The month-end
upload sends the saved role map and member discount to the reader (`config.guided`, `model.use_guidelines`), so
suggestions written at month-end follow them from the next upload on.

## Deliveries

Boxes are received into the POS without purchase orders, so nobody logs deliveries in the program. Each month-end upload works them out instead (`pipeline/receipts.py`):

1. Every refresh saves a stock snapshot, `skusnap/current`: on-hand, cost, and the month's unit sales by SKU.
2. The next refresh works out, for every SKU, **arrived = on-hand now − on-hand then + units sold in between**. It values that at cost (capped at the average selling price, because some special orders carry the whole order's cost as their unit cost), totals it by category and brand, and saves it as `arrivals/{asOf}`. Stock that fell by more than it sold (counts, shrink, returns) is reported separately.
3. The upload preview matches those totals to open orders for the same brand (through the vendor name) and category, oldest expected delivery first (`app/src/77-receiving.js`). Orders expected more than two months after the upload, or written after it, aren't matched. Arrivals with no open order are listed.
4. The owner unticks or changes anything that's wrong, and **Update the program** records each delivery on its order (`receipts: [{date, amount, byCat, source: "pos"}]`). An order within 3% or $25 of its total is marked Received; otherwise it's Partly received and the rest stays on order.

In the budget (`ledger()` in `app/src/10-core.js`), each delivery counts in the month it arrived, and not at all once it's in the on-hand stock (on or before the SKU Analysis date). Only what's still to come counts in the order's expected month, or in the current month once it's late. A delivery can still be recorded by hand on the order for anything the matching can't see.

## Reports calendar and reminders

The checklist on **Upload & close** lists every report and task on the Pro Shop reporting calendar, with tick boxes everyone shares (`checklist/{key}`):

| Checklist | Shows | Due | Overdue from | Reminder emails |
|---|---|---|---|---|
| Weekly | Monday–Sunday | Monday | Wednesday | Monday, Wednesday |
| Month-end | 3 days before the last day | Last day | The 4th of the next month | 3 days before, last day, the 4th |
| Quarterly count (Jul, Oct, Jan, Apr) | Quarter's last day | 10 days later | 11 days later | Quarter end, the day it's late |
| Buying review (Aug, Nov, Feb) | The 1st | The 15th | The 16th | The 1st, the 16th |
| Year-end | Apr 23 | Apr 30 | May 11 | Apr 23, Apr 30, May 11 |

The items and dates live in `lib/merch/schedule.ts`; the Month-end page shows the same month-end checklist. While anything is due or overdue, a banner shows on every page of the program, and the hub dashboard's Merchandise row says so.

On reminder days, `/api/cron/merch` (Vercel Cron, 15:00 UTC, about 8 am Pacific) emails everyone with the Merchandise Program, and the super admins, listing what's still unticked. Nothing is sent once a checklist is finished. It needs `CRON_SECRET` and an SMTP mailbox in the Vercel environment (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`; see `.env.local.example`). Without the mailbox, the reminders show in the app only. Each send is logged on the Activity page.

## Month-end refresh

1. Pull the month-end reports (see the Month-end page): SKU Analysis, Daily Sales Report by Item (the same day) and BEST 100 cost & margin (FYTD). The Daily Sales Report gives sales by category and each SKU's average selling price (fiscal-year-to-date sales over units), so Sales by Item and Sales by Category aren't needed during the year; a Sales by Item still wins for prices if one is uploaded, and only a full-year Sales by Category changes the forecast. BEST 100 stays: it's the only report with markdowns and the cost of what actually sold. Add the Yearly Rounds Summary when it's available. Excel exports read in seconds; PDFs take up to a minute.
2. As the owner, open **Month-end → Update from this month's reports** and choose all the files at once. The report type is detected from each file's contents, so file names don't matter.
3. The page shows how each file was read, any warnings (a missing report, or data older than what's loaded), and the new numbers next to the current ones. Nothing changes until **Update the program**, which loads the new data file through `/merch/api/import`.

How it runs: the page gets a 15-minute pass from `/merch/api/refresh?prior=0` and posts it with the files to `/api/merch/reports`, a Python function that reads last month's documents (`base/current`, `skuhist/…`, `plan/assumptions`, …) from the database itself and runs `pipeline/refresh.py`. The pass is signed with a key derived from `SUPABASE_SERVICE_ROLE_KEY` (`lib/merch/ticket.ts`), so no other secret is needed. Uploads are limited to 3.2 MB of files per batch; last month's documents don't count against it.

**Update the program** sends the data file to `/merch/api/import`, which writes every document in one transaction (`merch.put_docs`, `supabase/migration-merch-imports.sql`): all of it is saved or none of it. What each document held before is kept (`merch.imports`, the last 12 loads), so **Refresh history → Undo last update** (`/merch/api/import/undo`, `merch.undo_import`) puts the program back to before the latest load. Deliveries the load recorded on orders stay; they're changed on the order. A month-end upload (one that closes its month) ticks its reports and *Upload the reports* off that month's checklist. While a month-end checklist is due and not uploaded, the banner and the Reports page show the owner an **Upload reports** button. `next dev` doesn't serve the Python function; use `vercel dev` to try the upload locally.

The spreadsheet reader turns each row into a tab-separated line with numbers and dates written as the printout shows them, so one set of parsers reads PDF, Excel and CSV. It was checked against Excel, `.xls` and CSV copies of the September 2026 PDFs. If the POS's own exports are laid out differently, a file is reported as "no rows could be read" and the PDF still works. The POS's "data only" exports, with no title or headings, are read by their columns (`pipeline/exports.py`): the SKU Analysis's months run newest first, ending in the month of the latest sale, and a sales report's period is the run of months whose SKU Analysis units add up to its own. A file with the same rows as another is left out (a "Top 100" export that is really Sales by Item, for one); the cost & margin report has to be the BEST 100 ("Top 100 Hottest items"), with its cost and margin columns. Its export stops at 100 SKUs per category; the upload says which categories were cut off while still selling. The Daily Sales Report by Item export (today, month to date and fiscal year to date per SKU, green fees and gift cards included) has no date or categories: each SKU's category comes from the SKU Analysis, only merchandise counts, and its date is the SKU Analysis's, so the two have to be run the same day (its month-to-date units must match the SKU Analysis's newest month, or it's left out). The Rounds of golf export keeps its headings but has no year or total rows: the program adds up all classifications (Report Totals) and the Member, Guest and Public Rounds groups, and takes the year from a 20xx in the file name or else from the SKU Analysis.

To run the refresh by hand instead:

1. Export last month's documents from `merch.docs` into a prior folder: `base/current` → `base.json`; `skuhist/FY…`, `skuhist/meta` → `skuhist_FY2027.json`, `skuhist_meta.json`, …; and `plan/assumptions` → `assumptions.json` if it exists.
2. Run:
   ```
   pip install -r pipeline/requirements.txt
   python pipeline/refresh.py data/reports data/out --prior data/prior --note "October close"
   ```
   On a first build with no prior folder, include the full-year Sales by Category, Sales by Item and April SKU Analysis for last fiscal year.
3. Load `data/out/Merchandise_Program_Data_<asOf>.json` on your name (top right) → **Load month-end data** (`/merch/admin`).

Either way, a data file can only replace the month-end documents (`IMPORTABLE` in `lib/merch/rules.ts`: `base`, `inventory`, `insights`, `brands`, `refreshes`, `skuhist`, `skusnap`, `arrivals`, `brandskus`, `brandin`, `assort`). Orders, vendors, counts, budget changes and brand calls are never touched. Items marked done or dismissed stay that way, because `istate` is keyed by item id.

## Planning constants

`pipeline/config.py` holds the category list, target weeks, markdown rates, default growth for both years, and the combined-SKU list. Brand aliases and segments are in `pipeline/brands.py`. Brand-call thresholds are in `model.call_for`. Equipment gets half the apparel return-on-inventory bars.
