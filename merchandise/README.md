# Pro Shop Merchandise Program

The Pro Shop's forecast, open-to-buy (OTB), order book and brand scorecard. It is published as one self-contained page (a claude.ai artifact). All data lives in that page's database: orders, vendors, counts, budget changes, brand calls and the month-end documents. This folder holds only code. POS reports and generated data are git-ignored.

```
pipeline/   POS report PDFs  ->  database documents (Python)
app/        the single-file page: src/*.js + src/shell.html, assembled by build.py
```

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
2. Read last month's documents from the artifact database into a prior folder: `base/current` → `base.json`; `skuhist/FY*`, `skuhist/meta` → `skuhist_FY2027.json`, `skuhist_meta.json`, …; and `plan/assumptions` → `assumptions.json` if it exists.
3. Run:
   ```
   pip install -r pipeline/requirements.txt
   python pipeline/refresh.py data/reports data/out --prior data/prior --note "October close"
   ```
   The report type is detected from each PDF's text, so file names don't matter. On a first build with no prior folder, include the full-year Sales by Category, Sales by Item and April SKU Analysis for last fiscal year.
4. Write `data/out/*.json` back to the database: `base/current`, `inventory/current`, `insights/current`, `brands/current`, `refreshes/{asOf}`, `skuhist/{FY…, meta}`. Items marked done or dismissed stay that way, because `istate` is keyed by item id.
5. Rebuild the page only if code changed: `python app/build.py data/out` writes `dist/merchandise-program.html` with the new data embedded as the offline fallback.

Database access rules: `plan`, `inventory`, `insights`, `base`, `brands`, `brandCalls`, `refreshes` and `skuhist` are readable by viewers and writable only by the owner. Orders, vendors, subcategories, counts, item states and the checklist are writable by anyone who can use the page.

## Planning constants

`pipeline/config.py` holds the category list, target weeks, markdown rates, default growth for both years, and the combined-SKU list. Brand aliases and segments are in `pipeline/brands.py`. Brand-call thresholds are in `model.call_for`. Equipment gets half the apparel return-on-inventory bars.
