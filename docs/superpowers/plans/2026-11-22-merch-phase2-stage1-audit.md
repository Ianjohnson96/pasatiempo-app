# Stage 1 numbers audit (live data as of the Nov 15, 2026 upload)

Old `main` (012aaf9) against this branch, on a read-only copy of the live documents, with the saved $632,720 stock plan.

## Figures that shared a label but not a calculation

| Label | Before | After |
|---|---|---|
| Weeks of supply (category) | Budget and Stock & counts: this year's plan pace (`wksNow`); Scorecard and Stuck money: last 12 months (`17-metrics.js`). Ladies Apparel 62 vs 49, Golf Clubs 62 vs 72 | One figure everywhere: next four months' forecast pace (`catWeeks`), the budget's own basis |
| Weeks of supply (subcategory, brand) | Last 12 months, sometimes unlabelled | Unchanged figure, labelled "at last year's pace" |
| Left to buy / room to buy | Home led with the selected month (Nov: −$108,687); Budget opened on the current month | Home and Budget lead with the plan year ($449,966); a month is a choice. Tested equal on every page (`lib/merch/consistency.test.ts`) |

## What changes on the day this ships

| Category | Weeks (Budget) old → new | Weeks (Scorecard) old → new | Weeks flag | Over weeks target |
|---|---|---|---|---|
| 160 Golf Balls | 18 → 19 | 20 → 19 | near | $5,371 → $4,943 |
| 200 Golf Clubs | 62 → 69 | 72 → 70 | bad | $35,968 → $35,370 |
| 220 Demo Clubs | 0 → — | 427 → — | not judged | — |
| 300 Shoes | 91 → 90 | 102 → 90 | bad | $24,086 → $22,996 |
| 320 Gloves | 22 → 23 | 22 → 23 | near | $2,908 → $3,057 |
| 350 Golf Bags | 33 → 35 | 36 → 35 | near | $6,328 → $5,714 |
| 400 Solid Shirts | 17 → 19 | 15 → 19 | **good → near** | $0 → $3,828 |
| 430 Pants/Shorts | 52 → 56 | 75 → 56 | bad | $8,372 → $7,614 |
| 440 Clothing Accessories | 33 → 34 | 30 → 34 | bad | $40,551 → $48,286 |
| 470 Jackets | 25 → 26 | 26 → 26 | bad | $14,366 → $14,772 |
| 480 Fancy Shirts | 13 → 15 | 10 → 15 | **near → good** | $0 |
| 490 Sweaters | 9 → 9 | 10 → 9 | near | $0 |
| 500 Ladies Apparel | 62 → 67 | 49 → 67 | bad | $56,179 → $63,407 |
| 620 General Accessories | 27 → 27 | 24 → 27 | near | $26,645 → $43,966 |
| 660 Yardage Books | 73 → 67 | 74 → 67 | bad | $6,437 → $6,203 |

- Stock over the weeks target (Markdowns): **$227,212 → $260,157**: winter's forward pace is slower than the trailing year.
- Scorecard suggestions: unchanged (they are per subcategory, which keeps last year's pace).
- Home's decisions: unchanged (same six, same order).
- Budget, Left to buy and every money figure: unchanged.
