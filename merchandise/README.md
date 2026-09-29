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
| staff | orders, receipts, vendors, subcategories, counts, to-do states, month-end checklist |
| viewer | read only |

Roles are granted per app on the hub's **People & access** page (`/admin/people`, stored in `hub.access`; see `lib/hub/access.ts`). A super admin is an owner here. Everyone signs in once for all Pasatiempo apps.

## Setup (once)

1. Run `supabase/migration-merch-schema.sql` in the hub project. Then add `merch` under Settings → API → Exposed schemas.
2. For now the program is served by path at `pasatiempo-app.vercel.app/merch`. To give it its own domain later, add the domain to the Vercel project and list it under the `merch` entry in `lib/sections.ts`.
3. Sign in at that address. Open **More → Load month-end data** and load the latest data file. Add staff on `/admin/people`. After that, each month's reports are uploaded on the Month-end page.

## Pages

| Page | What it shows |
|---|---|
| Overview | Budget left by category for the chosen fiscal year and month; top to-dos |
| Forecast | Sales by month for this year and next. Growth, extra category growth and target weeks can be edited as a what-if, and the owner can save them as the plan (`plan/assumptions`) |
| Open-to-buy | Category × month grid (this FY, next FY, calendar year), the inherited-stock table, and the classic OTB worksheet |
| Orders | Purchase orders with sizes. Each order is checked against the budget of the fiscal year it arrives in |
| Brands | Scorecard by segment with a suggested call (Grow / Keep / Watch / Reduce / Drop). The owner can override a call in `brandCalls/{id}`. Orders link to brands by vendor name |
| To do | Order alerts plus item suggestions (`insights/current`) |
| Inventory & counts | On hand by category; quarterly counts |
| Month-end | Checklist (`checklist/{YYYY-MM}`), refresh history (`refreshes/{asOf}`), forecast vs actual |

## The model

Fiscal year: May 1 – Apr 30. Sales are at retail. Stock and budgets are at cost.

- **Sales, this year:** closed months are actual. Each open month = the same month last year × (1 + month growth + category extra growth).
- **Sales, next year:** this year × (1 + next-year growth for the category). Beyond that, next year repeats.
- **Shelf sales** = sales less special orders. Budgets count shelf sales and shelf stock only (see Special orders below).
- **Cost of sales** = shelf sales × (1 − realized margin from the cost & margin report).
- **Target end-of-month stock** = target weeks × (next four months' cost of shelf sales) ÷ 17.3. Opening stock is on hand less special-order stock.
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

Inside each category, the **Subcategories** page shows where the sales and the stock are, with the brand scorecard's measures: 12-month sales and share of the category, trend, on hand, weeks of supply, margin, GMROI, aged stock, what the Order Book has committed this year, and a call. Special orders show in the category they sell as, flagged (see below). It is reporting only: budgets stay by category.

- The subcategory list is the program's own (`subcats/{id}`, the same list order lines use).
- A SKU's subcategory comes from its description (`config.SUB_RULES`, checked in order; `model.sub_auto`), unless someone sets it under **Sort SKUs** (`submap/current`: `{skus: {sku: subcat id}}`, where `""` means not sorted). Choosing the one the description gives removes the override. A rule for a subcategory that was removed is skipped.
- The report is `assort/current` (`model.build_subcats`), built at every month-end upload and by **Update brands** / **Update subcategories** (both rebuild the scorecard and the report). The category panel on the Overview shows the same split.

## Special orders

Items bought for one member (custom clubs, a named order, imprinted balls) or one group (an invitational, member-guest, an outside group's logo order) sell as ordinary categorized items. They are not a category of their own:

- **Reports** show them in the category they sell as, with a *Special order* tag and their share of sales (Subcategories, the brand scorecard, the Forecast's by-category table). Weeks of supply, GMROI and the call count shelf sales against shelf stock; a line that is nearly all special orders with nothing on the shelf gets the call *Special orders*.
- **Budgets** count shelf sales and shelf stock only. `model.special_budget` stores each category's special-order sales by month (`base/current` `cats[c].so`, the category's own figures split the way its SKUs' sales split) and its special-order stock (`soOnHand`); the engine leaves out the month's own share, or the same month's a year earlier for a month that hasn't happened.
- **Which SKUs** come from the description (`config.SO_*`, `model.so_auto`): a customer's name in brackets, a group or event word, the custom-fitting and custom-imprint subcategories, and everything rung to Special Orders (640), except rentals, repairs and fees there, which are *Not retail* and left out of the reports. Fitting stock stays shelf stock.
- **Special Orders (640) items** report in the category their description names (`config.SELLS_AS`, `model.sells_auto`); the ones it doesn't (Sip-N-Shop and logo orders) wait under **Needs a category**. 640 itself stays outside the budgets.
- **Sort SKUs** corrects any of it (`submap/current` `so: {sku: "member" | "group" | "notretail" | "shelf"}`, `cat: {sku: category}` for 640 items, or a SKU rung to the wrong category; that one reports in the category set, while its budget stays with the POS category until the SKU is moved in the POS). **Update subcategories** (or **Update brands**, or a month-end upload) puts the changes into the reports and the budgets (`refresh.rebuild_brands` also rewrites `base/current`'s `so`, `soOnHand` and category calls).

## Navigation

The tabs are grouped the way a buying month runs, **Plan** (Overview, Forecast, Open-to-buy), **Buy** (Orders, Vendors), **Assortment** (Brands, Subcategories, Inventory & counts, To do) and **Close the month** (Month-end, Reports), and stay pinned at the top as the page scrolls.

## Deliveries

Boxes are received into the POS without purchase orders, so nobody logs deliveries in the program. Each month-end upload works them out instead (`pipeline/receipts.py`):

1. Every refresh saves a stock snapshot, `skusnap/current`: on-hand, cost, and the month's unit sales by SKU.
2. The next refresh works out, for every SKU, **arrived = on-hand now − on-hand then + units sold in between**. It values that at cost (capped at the average selling price, because some special orders carry the whole order's cost as their unit cost), totals it by category and brand, and saves it as `arrivals/{asOf}`. Stock that fell by more than it sold (counts, shrink, returns) is reported separately.
3. The upload preview matches those totals to open orders for the same brand (through the vendor name) and category, oldest expected delivery first (`app/src/77-receiving.js`). Orders expected more than two months after the upload, or written after it, aren't matched. Arrivals with no open order are listed.
4. The owner unticks or changes anything that's wrong, and **Update the program** records each delivery on its order (`receipts: [{date, amount, byCat, source: "pos"}]`). An order within 3% or $25 of its total is marked Received; otherwise it's Partly received and the rest stays on order.

In the budget (`ledger()` in `app/src/10-core.js`), each delivery counts in the month it arrived, and not at all once it's in the on-hand stock (on or before the SKU Analysis date). Only what's still to come counts in the order's expected month, or in the current month once it's late. A delivery can still be recorded by hand on the order for anything the matching can't see.

## Reports calendar and reminders

The **Reports** tab lists every report and task on the Pro Shop reporting calendar, with tick boxes everyone shares (`checklist/{key}`):

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

1. Pull the month-end reports (see the Month-end page): SKU Analysis, Daily Sales Report by Item, Sales by Item (FYTD) and BEST 100 cost & margin (FYTD). The checklist also lists Sales by Category (FYTD), which is kept for the record; only a full-year Sales by Category changes the forecast. Add the Yearly Rounds Summary when it's available. Excel exports read in seconds; PDFs take up to a minute.
2. As the owner, open **Month-end → Update from this month's reports** and choose all the files at once. The report type is detected from each file's contents, so file names don't matter.
3. The page shows how each file was read, any warnings (a missing report, or data older than what's loaded), and the new numbers next to the current ones. Nothing changes until **Update the program**, which loads the new data file through `/merch/api/import`.

How it runs: the page gets a 15-minute pass and last month's documents (`base/current`, `skuhist/…`, `plan/assumptions`) from `/merch/api/refresh`. It posts them with the files to `/api/merch/reports`, a Python function that runs `pipeline/refresh.py`. The pass is signed with a key derived from `SUPABASE_SERVICE_ROLE_KEY` (`lib/merch/ticket.ts`), so no other secret is needed. Uploads are limited to 3.2 MB per batch. `next dev` doesn't serve the Python function; use `vercel dev` to try the upload locally.

The spreadsheet reader turns each row into a tab-separated line with numbers and dates written as the printout shows them, so one set of parsers reads PDF, Excel and CSV. It was checked against Excel, `.xls` and CSV copies of the September 2026 PDFs. If the POS's own exports are laid out differently, a file is reported as "no rows could be read" and the PDF still works.

To run the refresh by hand instead:

1. Export last month's documents from `merch.docs` into a prior folder: `base/current` → `base.json`; `skuhist/FY…`, `skuhist/meta` → `skuhist_FY2027.json`, `skuhist_meta.json`, …; and `plan/assumptions` → `assumptions.json` if it exists.
2. Run:
   ```
   pip install -r pipeline/requirements.txt
   python pipeline/refresh.py data/reports data/out --prior data/prior --note "October close"
   ```
   On a first build with no prior folder, include the full-year Sales by Category, Sales by Item and April SKU Analysis for last fiscal year.
3. Load `data/out/Merchandise_Program_Data_<asOf>.json` on **More → Load month-end data** (`/merch/admin`).

Either way, a data file can only replace `base`, `inventory`, `insights`, `brands`, `refreshes` and `skuhist`. Orders, vendors, counts, budget changes and brand calls are never touched. Items marked done or dismissed stay that way, because `istate` is keyed by item id.

## Planning constants

`pipeline/config.py` holds the category list, target weeks, markdown rates, default growth for both years, and the combined-SKU list. Brand aliases and segments are in `pipeline/brands.py`. Brand-call thresholds are in `model.call_for`. Equipment gets half the apparel return-on-inventory bars.
