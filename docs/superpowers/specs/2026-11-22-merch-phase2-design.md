# Merchandise Program, phase 2: one clear program, live receiving, actions and a report email

Date: 2026-11-22 · Owner: Ian (Pro Shop) · Status: design, awaiting approval
Builds on: `2026-11-18-merch-redesign-design.md` (which left the receiving log out) and
`2026-11-19-merch-guidelines-design.md`.

## Why

The Merchandise Program (`/merch`, `merchandise/`) works and its numbers now reconcile (PR #47), but it is hard to
follow: 14 pages grouped by kind of data, every page opening with four tiles of fine print, and the same label showing
different numbers on different pages. Ian is the only person who has learned it so far, and there is time before staff
(Chris, CJ) start using it, so a full reorganization costs nobody any relearning.

The shop's buying runs in three phases, and the program should be organized around them:

1. **Buy**: plan the budget, place orders and record them in the app.
2. **Receive**: confirm orders have arrived. Arrivals are recorded by the people who pay the invoices, in a Google
   Sheet (the receiving log). The app should read it live, so nobody reconciles by hand.
3. **Sell & stock**: analysis of inventory and sales that leads to actions, plus a performance report that goes to
   upper management by email.

**Jonas (the POS) is the official record.** Stock, sales, budgets and Left to buy change only when Ian uploads Jonas
reports. The receiving log never changes a number; it only says whether an order has arrived.

## Goals

- Sidebar and pages organized by the three phases; every page opens with a one-line verdict.
- One meaning per number across the whole program (see "Numbers that agree").
- An **Orders & receiving** page that follows each order from placed → arrived (log) → in Jonas (upload), with
  suggested log matches a person confirms.
- The receiving log read automatically, read-only, current whenever someone opens Orders & receiving.
- A **Categories** page that tells one category's whole story; analysis pages become views of it.
- One ranked **actions** list (top five on Home).
- An automated **performance report email** built from the same calculations as the screen.
- Ready before spring prebooks start arriving in **January 2027**: stages 1 and 2 must be live by then.

## Non-goals

- No change to the budget or forecast math (`20-engine.js`, `pipeline/engine.py`) or the month-end reader beyond
  what a stage below names. Parity tests (`lib/merch/engine-parity.test.ts`, `pipeline/test_parity.py`) stay green
  with no fixture changes.
- No rewrite into React/Next: the program stays plain JS assembled from `merchandise/app/src/*.js` + `shell.html`.
- No mobile-first design (phones must not break; desk use is the target).
- The receiving log does not feed inventory, budget, Left to buy or the forecast.
- Email recipients and cadence are **not decided** (Ian: "we can work that out later"); stage 4 builds the email with
  a configurable recipient list and a send rule, and asks before turning it on.

## Anti-goals (failure even if it works)

- **Anything written to the receiving log or any Google file.** The app has read-only access and never asks for more.
  (Ian: "do not make changes to the file without permission.")
- The app checking an order off by itself. Every match is confirmed by a person (Ian: "we can be the final match").
- A budget, Left to buy or stock figure changing because of a log row.
- The report email and the screen disagreeing, or the email going out on stale or failed data.
- A feature lost in the regroup: every current page's content must be reachable (mapping below).

## Constraints and facts

- **Users**: Ian (owner, desk); Chris and CJ (staff: orders, receiving, vendors, sorting); Ken and Steve (view-only:
  GM / Director of Golf). Roles from `hub.access`; rules in `lib/merch/rules.ts` (`STAFF_WRITABLE`, `docProblem`).
- **Data**: merch documents in Supabase (`merch.docs`), read and written through `/merch/api/db`; the page polls every
  15 s. Orders are `pos/{id}` with `invoicesIn` entries (`source: 'hand' | 'log'`), already designed for the log
  (`77-receiving.js`, `storeRoomValue` in `18-ops.js`, README "Receiving").
- **Email**: `lib/mail.ts` (SMTP: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) and the daily cron `app/api/cron/merch`
  (Vercel cron, once a day at 15:00 UTC) already send checklist reminders to `merchPeople()`.
- **PR #42** (open, based before the Nov 18 redesign) built weekly Daily Sales Report numbers (`pulse/{date}`) and a
  one-page management report (`36-weekly.js`, `37-mgmt.js`). Stage 4 ports it onto the current code rather than
  merging it as is.

### The receiving log (read on 2026-11-22)

- Google Sheet **"Receiving File '23-'26"**, id `1L2H5NaP_6nV1FwyYE5ThjKv8GenbvdtFulW6gYsCkSs`, owned by
  `pasatiemposhop@gmail.com`, shared view-only with Ian. Edited by the people who pay invoices.
- One tab per calendar year: `SHEET 1 - 1/1-12/31/2023`, `SHEET 2 - 1/1-12/31/2024`, `Sheet 3 - 1/1-12/31/2025`,
  `SHEET 4 1/1-12-31/2026` (names are inconsistent; a 2027 tab will be added by hand), plus a **`Credits`** tab.
- Year tabs: header `REC. DATE | ITEM DECRIPTION | INVOICE # | PRICE | DEL. DATE`. `REC. DATE` is filled only on the
  first row of each day (carry it down). `DEL. DATE` has never been used. `PRICE` is cost, text like `$1,891.62`.
- Credits tab: `DATE | ITEM DESCRIPTION | INVOICE # | PRICE` with negative prices (returns, credits, misorders).
- 2026 tab: 1,101 rows Jan 2 – Nov 19, $1.76M; every row has an invoice # and a price; two invoice "numbers" are text
  (`CJ Paid W/ CC`, `512 Corp Crd`); 3 invoice #s appear on more than one row.
- **No PO number and no vendor column.** The description reads `<what> <brand> <(Customer) | Mens/Ladies Stock>`,
  e.g. `Shirts/Sweaters Peter Millar Mens Stock`, `Woods Titleist GTS (Capurro)`. Brands are abbreviated: FootJoy is
  always `FJ`, Holderness & Bourne is `H&B`. 38% of rows are special orders (a name in brackets).
- Log totals track the POS-derived deliveries (`arrivals/{asOf}`) within ~5–10% per month (timing differences).
- **No overlap yet**: every order in the app is a spring 2027 prebook (deliveries Jan–Oct 2027); this fall's log rows
  are reorders and special orders that were never entered in the app. Matching starts to matter in January.

## Approaches (decided by Ian: A, A, A)

**Connecting the log: A, the app reads the sheet.** The shop account shares the sheet, view-only, with a Google
service account the app owns; the server reads it with the Sheets API (`spreadsheets.readonly`) when someone opens
Orders & receiving and once a day from the existing cron. Rejected: B, an Apps Script inside the sheet pushing rows to
the app: instant, but it puts our code in accounting's file where it can be deleted or confused with theirs.

**The pages: A, reorganize within the current program.** Rejected: B, rewrite in Next/React: weeks more work and risk
to the budget math for nothing a user would see.

**The email: A, the server runs the page's own calculation code** in Node, the way the tests already load `app/src`
files with `vm`, so the email can never disagree with the screen. Rejected: B, the month-end reader writes a report
document (a second copy of the math that drifts); C, rendering the page in a headless browser (heavy and fragile on
Vercel).

## Build order

Each stage ships on its own and leaves every existing number unchanged except where a stage says so.

1. Numbers that agree, the new sidebar and Home.
2. Orders & receiving, with the receiving log connected. **Live before January 2027.**
3. Categories and the actions list.
4. The performance report email (porting PR #42).

## Stage 1: numbers that agree, the sidebar, Home

### Sidebar (14 pages → 9)

```
Home
BUY            Budget · Orders & receiving · Season plan
SELL & STOCK   Categories · Brands · Markdowns
MONTH-END      Upload & count
Settings       (Guidelines, Forecast assumptions)
```

Mapping (nothing lost): Today → Home · Budget & open-to-buy → Budget · Orders + Receiving + Vendors → Orders &
receiving (vendors as a filter and the vendor drawer) · Season buys → Season plan · To do → actions list on Home and in
Categories (stage 3; until then Home links to the existing list) · Scorecard + Trends & rounds → Categories (stage 3;
until then they stay reachable under Sell & stock) · Brands → Brands · Stuck money & markdowns → Markdowns · Upload &
close + Stock & counts → Upload & count · Forecast + Guidelines → Settings. Old page ids keep working through
`TAB_ALIAS` (`05-nav.js`).

### Every page

- Opens with a **verdict line** in plain English (one sentence: the state and what to do), then at most three
  numbers, then the detail. Explanations move behind an ⓘ; no grey paragraphs under tiles.
- Colour means one thing everywhere: green = room / fine, amber = waiting / watch, red = act.
- Larger type for the verdict; fewer cards.

### Numbers that agree

- **Weeks of supply, for a category**, has one definition everywhere: shelf stock at cost ÷ (the next four months'
  forecast cost of shelf sales ÷ 17.3), the same basis the budget sets its target stock on (`20-engine.js`), so a
  category budgeted to 16 weeks reads 16 weeks. *(Claude's call.)* Today the Budget page uses this year's plan pace
  (`wksNow`), the Scorecard and Stuck money the last 12 months (`17-metrics.js`), giving e.g. Ladies Apparel 62 vs 49.
- **Subcategories and brands** have no forecast, so they keep the last 12 months' pace, labelled "at last year's pace"
  wherever shown (`73-subcats.js`, `74-brands.js`, the reorder and buy-deeper suggestions in `17-metrics.js`).
  *(Claude's call.)*
- Role ranges and "too much stock" thresholds are unchanged. Moving categories to a forward pace changes which
  categories are flagged (seasonal categories read heavier in winter); the stage 1 PR lists every flag and action that
  changes on the day it ships.
- **Left to buy** leads with the full plan year everywhere (Home, Budget); the month-by-month view is a toggle, not
  the default. Home's "Room to buy −$109k" (November only) becomes "You can still buy $450k this year", with the
  month shown second.
- Audit every page for other figures that share a label but not a calculation; list them in the PR and fix them the
  same way. The cross-page check from PR #47 (every Left to buy figure equal) becomes a test.

### Home

```
Home
  You can still buy $450k this year. Biggest room: General Accessories $222k (opens Dec).
  Arriving: 6 orders due this month · 3 log rows to match
  Selling: $2.70M last 12 months, +34% · margin 41% ✓
  ─ 5 decisions this week ─
```

## Stage 2: Orders & receiving, with the log connected

### The page

```
Orders & receiving                                   [+ New order]
  Match from the log (3)   Due this month (6)   Late (2)
  Arrived, not in Jonas (4 · $14,320)   All orders
──────────────────────────────────────────────────────────────
  PO 27-IMP-3  Imperial  Hats   due Jan   $6,400
    ● Placed ── ● Arrived Nov 18 (inv 1405604, $5,228) ── ○ In Jonas
```

- Each order shows its trail: placed → arrived (log invoices, or a hand "Invoice in") → received into Jonas (month-end
  matching, as today).
- **Match from the log**: each unmatched log row with its suggested order. Actions: **Confirm** (adds an
  `invoicesIn` entry `{date, amount, invoice, source: 'log', logKey, by, at}`), **Pick another order**, **Not an
  order** (reorders, special orders, anything outside the order book; stays listed for reference under a filter).
  Every match can be undone. Anyone who can enter orders (owner, staff) can confirm or undo.
- **Rows with no candidate order** go straight to the "Not from an order" list without a click; only rows with at
  least one candidate wait in "Match from the log", and only those count on Home and in the sidebar. Filing a row with
  no candidate checks nothing off, so it keeps the "a person confirms every match" rule. If a later order makes such a
  row a candidate, it moves back to the match list. *(Claude's call.)*
- **One way to record an arrival once the log is live.** The hand "Invoice in" button is hidden for staff; the owner
  keeps it as an override for a shipment the log hasn't caught up with. Confirming a log row whose invoice # equals an
  existing hand entry's invoice # on the same order replaces that entry instead of adding to it; a hand entry with no
  invoice # is offered for replacement on confirm. A log row dated on or before an order's `invoicesClearedAt` does not
  bring the order back onto the store-room list. *(Claude's calls.)*
- Partial shipments add up on the order until it is complete. A Credits-tab row offers a match the same way and, when
  confirmed, adds a negative entry.
- **Budget effect: none.** Arrived goods stay committed until month-end records them as received, as Invoice in does
  now (`storeRoomValue` and README "Receiving" unchanged).

### Reading the log

- Server route under `/merch/api/` reads the sheet with a Google service account
  (`GOOGLE_SERVICE_ACCOUNT_JSON` env var; scope `spreadsheets.readonly`) and writes the parsed rows to merch
  documents. Triggered when Orders & receiving opens (at most once every 2 minutes) and by the daily cron.
- **Finding tabs**: every tab whose first row has headers matching `REC. DATE`/`DATE`, `ITEM DESCRIPTION` (any
  spelling incl. `DECRIPTION`), `INVOICE #`, `PRICE`; the Credits tab by name. Tab names are not relied on, so a hand-
  made 2027 tab is picked up.
- **Which rows**: rows dated on or after the go-live date (a setting), plus Credits rows in that window. Older rows
  are not imported. *(Claude's call: go-live date = the day stage 2 ships.)*
- **Parsing**: carry `REC. DATE` down; price text → number; keep invoice text as is; derive brand (vendor alias list,
  below), a category word (Shirts, Hats, Balls…), stock vs special order (a name in brackets, the same rule as
  `config.SO_*`).
- **Row identity**: tab + invoice # + price + description, with a counter for exact repeats. Row numbers are not used,
  because rows get inserted. A row whose text changes after a match shows as "changed in the log" for a person to
  re-check; a matched row that disappears shows as "removed from the log". *(Claude's call.)*
- **Storage** *(Claude's call; builder may refine)*: `receivinglog/current` (parsed rows, read time, problems) written
  only by the server route; decisions in `logmatch/{key}` (staff-writable, added to `STAFF_WRITABLE`, shape checked in
  `docProblem`).
- **Setup** (owner, once; the page shows these steps): create the service account; the shop account
  (`pasatiemposhop@gmail.com`) shares the sheet with its email as **Viewer**. Nothing is added to the sheet.
- Failures (no access, sheet renamed, headers changed) show on the page as one plain line with what to fix; the rest
  of the program is unaffected.

### Suggesting a match

- Candidate orders: open, not Received or Cancelled, whose vendor matches the row's brand, delivery month within
  one month either side of the row's date, and open balance ≥ the row's price (or within 2% above it).
- Brand matching uses a **vendor alias list**: vendor name ↔ the words the log uses (`FJ` → FootJoy, `H&B` →
  Holderness & Bourne, `Peter Millar`, `RLX`/`Ralph Lauren`…), seeded from `pipeline/brands.py` and editable by the
  owner in Settings. Titleist and FootJoy invoices share Acushnet numbering (`9000…`), so invoice prefixes are not used.
- Ranking: one candidate → suggested; several → ordered by delivery month closeness then amount closeness, all shown.
  Nothing is confirmed automatically.

## Stage 3: Categories and the actions list

- **Categories**: a list of categories (the Scorecard's table, with the stage 1 verdict and weeks definition); click
  one for its page: sales by month against last year, stock and weeks of supply, margin and GMROI, aged stock,
  budget and Left to buy, open orders and arrivals, subcategories and brands, markdown candidates, and its actions.
  Scorecard, Trends & rounds and the per-category parts of Stuck money become views of this. Brands and Markdowns stay
  as cross-category pages that click into it.
- **Actions**: one ranked list by dollars at stake, from today's sources (order alerts, `insights/current`, the
  Scorecard's suggestions, mix alerts, `topDecisions` in `30-home.js`). Each item: verdict, one-line why, and a button
  that does the next step (open the order to trim, list the styles to mark down…). Home shows the top five; the full
  list sits on Categories (and per category). Done / Not now as today (`istate/{id}`); an item comes back if its
  dollars grow by more than a quarter. *(Claude's call.)* Updated whenever data changes (upload, orders, log, Settings);
  no fixed schedule (Ian: "adjustments don't have a time table").

## Stage 4: the performance report email

- Port PR #42's management report (`37-mgmt.js`) and weekly numbers (`36-weekly.js`, `pulse/{date}`, the Daily Sales
  Report upload) onto the current code and stage 1's numbers. Add arrivals (in / late) from stage 2 and the top five
  actions from stage 3.
- The email body is the report (readable on a phone), with a link to the live report in the app. View-only logins open
  on the report.
- Built server-side by loading the page's calculation files in Node (as the tests do) against the stored documents,
  so email and screen match.
- **Guard**: not sent if the Jonas data is older than expected for the send date or any check fails; Ian gets a note
  saying why instead.
- **Note from Ian**: an optional note added at the top before it goes.
- **Recipients and cadence: undecided.** Build with an owner-editable recipient list (empty by default) and a send rule
  setting; default proposal to put to Ian when stage 4 starts: the morning after the month-end upload is finished, with
  a one-day window to add a note or hold it. Nothing is sent until Ian turns it on.

## Open question for Ian

- **In-season reorders**: about $125k a month of reorders and special orders never enters the app today. Should they
  be entered as orders from now on (matched to the log, counted as committed before they arrive), or stay outside the
  app? The design works either way (rows with no order file themselves); the answer changes matching volume and how
  complete the order book and Left to buy are between uploads.

## Left to the builder

File layout inside `app/src`, component and CSS structure, exact verdict wording (plain, short, consistent with
the current copy style), the parsing heuristics' details beyond the rules above, test structure, and how stage 1's
numbers audit is recorded. Each stage gets its own plan and PR.
