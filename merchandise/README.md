# Pro Shop Merchandise Program

The Pro Shop's forecast, open-to-buy (OTB), order book and brand scorecard. It runs as a section of this club app: `/merch`, or its own domain from `lib/sections.ts`. Staff sign in with an email and password the owner sets. Nobody needs a Claude account.

```
pipeline/     POS report PDFs  ->  month-end documents and a loadable data file (Python)
app/src/      the program page: plain HTML/JS, one file per area
app/host/     club-shim.js: backs the page's database and user with the club app
app/build.py  optional standalone single-file build of the page, with data embedded
```

The page is served by `app/merch/route.ts`. It assembles `app/src` with the shim at request time (see `lib/merch/page.ts`). All data lives in the hub Supabase project's `merch` schema (`supabase/migration-merch-schema.sql`): one row per JSON document, addressed by path, e.g. `pos/{id}`, `vendors/{id}` or `base/current`. The browser reads and writes documents only through `/merch/api/db`. It polls every 15 seconds and again when the tab comes back into view. Every write is checked against the rules in `lib/merch/rules.ts`. POS reports and generated data are git-ignored.

## Who can do what

| Role | Can |
|---|---|
| owner | everything, including the forecast (`plan/…`), budget changes, brand calls, month-end data, and **People & data** (`/merch/admin`) |
| staff | orders, receipts, vendors, subcategories, counts, to-do states, month-end checklist |
| viewer | read only |

People are managed on `/merch/admin`, stored in `merch.members`. Adding someone with a password creates their Supabase Auth login, flagged `app_metadata.merch_only`. The proxy and `lib/events/auth.ts` keep those accounts out of the events admin area.

## Setup (once)

1. Run `supabase/migration-merch-schema.sql` in the hub project. Then add `merch` under Settings → API → Exposed schemas.
2. Add the section's domain (`pasatiempo-merch.vercel.app`, or a custom one) to the Vercel project. List it in `lib/sections.ts`.
3. Sign in at that address. Open **More → People & data** and load the latest data file.

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
- **Cost of sales** = sales × (1 − realized margin from the cost & margin report).
- **Target end-of-month stock** = target weeks × (next four months' cost of sales) ÷ 17.3.
- **OTB for a month** = target EOM − opening stock + cost of sales. In the current month, cost of sales covers only the part not yet sold.
- **Next year's opening stock** = this year's April target + carry. Carry = max(this year's budget with changes, committed, 0) − this year's plan budget.
- Special Orders (640) count in sales but never get a budget.

`pipeline/engine.py` and `app/src/20-engine.js` implement the same model. They must agree. With the Sep 11, 2026 reports, the FY2027 remaining budget comes to $717,316 with default FY2028 growth, or $702,037 with FY2028 growth set to 0. The second figure is the original published plan's $701,996, give or take rounding in SKU prices.

## Month-end refresh

1. Pull the five month-end reports (see the Month-end page): SKU Analysis, Daily Sales Report by Item, Sales by Category (FYTD), Sales by Item (FYTD), BEST 100 cost & margin (FYTD). Also pull the Yearly Rounds Summary when it's available.
2. Export last month's documents from `merch.docs` into a prior folder: `base/current` → `base.json`; `skuhist/FY…`, `skuhist/meta` → `skuhist_FY2027.json`, `skuhist_meta.json`, …; and `plan/assumptions` → `assumptions.json` if it exists.
3. Run:
   ```
   pip install -r pipeline/requirements.txt
   python pipeline/refresh.py data/reports data/out --prior data/prior --note "October close"
   ```
   The report type is detected from each PDF's text, so file names don't matter. On a first build with no prior folder, include the full-year Sales by Category, Sales by Item and April SKU Analysis for last fiscal year.
4. Load `data/out/Merchandise_Program_Data_<asOf>.json` on **People & data → Load month-end data**. A data file can only replace `base`, `inventory`, `insights`, `brands`, `refreshes` and `skuhist`. Orders, vendors, counts, budget changes and brand calls are never touched. Items marked done or dismissed stay that way, because `istate` is keyed by item id.

## Planning constants

`pipeline/config.py` holds the category list, target weeks, markdown rates, default growth for both years, and the combined-SKU list. Brand aliases and segments are in `pipeline/brands.py`. Brand-call thresholds are in `model.call_for`. Equipment gets half the apparel return-on-inventory bars.
