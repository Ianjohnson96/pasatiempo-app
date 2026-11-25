# The bi-weekly merchandise report — design

Stage 4 of `docs/superpowers/specs/2026-11-22-merch-phase2-design.md` ("the performance report email"), worked out
with Ian on 2026-11-25. This document replaces that section's content decisions; sending (recipients, schedule,
the send itself) stays out of scope until Ian takes it up.

## Why

Ian wants the people who make managerial decisions about the Pro Shop (the GM, the Director of Golf and others he
picks) to get a regular, well-packaged picture of the merchandise program without opening the app: sales against last
year and plan, where the budget stands, orders, what to restock, what is hot and what is not moving, brands, and the
issues with a recommended fix for each. It replaces a printout. A manager should get the story in ten seconds and
the detail if they want it, then click into the app for anything they want to act on.

## Goals

- A report every **two weeks**, built from the app's own numbers, readable as an **email** (on a phone first) and as
  a **page in the app** with the same content.
- **As much useful information as possible, well organised**: a written summary and a four-box scorecard first, then
  eight sections, each opening with one plain sentence and saying how fresh its numbers are.
- **Links to the app** at the top, in the sections, and at the foot: each goes to the page that acts on it.
- **Item lists that are current**: Ian will upload the SKU Analysis (and the Daily Sales Report) every two weeks, so
  restock, hot and cold are never more than two weeks old.

## Non-goals (for now)

- Sending: who gets it, when, the mailer, a note from Ian, holding a report back. The report must be built so sending
  can be added without reworking it (one function in, one HTML document out).
- Editing the report's content per reader.
- New analysis the app doesn't have; the report packages what the app already works out, plus the two-week sales
  figures and the item lists below.

## Anti-goals

- A figure in the email that disagrees with the same figure in the app.
- Item lists presented as current when the SKU Analysis behind them is old.
- A layout that breaks in email clients or makes a phone zoom out.
- A budget that jumps every two weeks because of a mid-month upload (see Constraints).

## The report (approved mockup: v2, 2026-11-25)

Order and content as Ian approved them. Numbers are at cost for stock and buying, at retail before tax for sales.

**Header.** "Pasatiempo Pro Shop · Merchandise report"; the period ("Two weeks ending Sunday, March 8, 2027"); a line
on freshness ("Weeks 44–45 of FY2027 · sales through Mar 8 · stock from the Mar 8 SKU Analysis"); a button **Open the
Merchandise Program**.

**Summary.** Two short paragraphs, written from the figures by rules (not free text): how sales went against last year
and plan and which categories led or lagged; where the budget stands and anything over; late orders and what arrives
next; how many items need restocking and how much stock isn't moving.

**Scorecard.** Four boxes, each green / amber / red: **Sales** (two weeks vs last year), **Budget** (left to buy, on
pace or not), **Orders** (late count and dollars, else "none late"), **Stock** (weeks of supply against target).
Then a row of links to the eight sections.

1. **Sales.** Table: these two weeks, month to date, year to date (fiscal, May–April), last 12 months — this year,
   last year, change, and against plan (except the last 12 months). A bar chart of the last 12 weeks against the same
   weeks last year. Each category for the two weeks, the month and the year to date with change on last year; a shop
   total. Sales per round for the two weeks against last year.
2. **Budget.** The year's budget, committed (received + on order) and left to buy; each category's committed bar
   against a line for how far through the year we are; over-budget categories in red, nearly-spent in amber; a link to
   the Budget page.
3. **Orders.** Tiles: arrived in the two weeks, late, due in the next two weeks. Lists: late orders (PO, vendor, days
   late, still to come); arriving in the next two weeks (top few by value, then "and N more"); arrived in the two
   weeks (from the receiving log).
4. **Restock now.** Items selling well that are out of stock or running low: item, sold in the last 3 months, on hand,
   weeks left at the recent pace, suggested reorder (8 weeks at the current pace less what's on order, or "on order").
   Link: start the orders.
5. **Hot & cold.** Hot: top sellers by units over the last 3 months with change on last year. Cold: items not moving,
   largest dollars on hand first, with when each last sold; a line totalling stock unsold 6+ and 12+ months. Link: the
   Markdowns page.
6. **Brands.** Top and bottom brands: sales over 12 months, change, margin, and the Brands page's call (Grow, Keep,
   Watch, Reduce, Drop).
7. **Issues & recommended fixes.** The top five open actions from the Actions list (stage 3), biggest dollars first,
   each with its dollars, a line of detail and the fix. Link: every action in the app.
8. **Stock health.** On hand, weeks of supply against target, aged 12+ months, margin, GMROI, turns — each against its
   guideline.

**Foot.** The button again; one line on sources and dates; "You're getting this because you're on the Pro Shop's
report list."

Each section header carries its freshness ("Through Mar 8", "Mar 8 SKU Analysis", "Today", "From the receiving log").

## Constraints

- **The figures come from the app's own calculations** (approach 1, below). Left to buy, weeks of supply, actions,
  brand calls and aged stock must equal what the app's pages show for the same data.
- **Email-safe.** One column, about 600–640px; tables and inline styles; no script, no web fonts that must load, no
  images from other sites. Bars and the 12-week chart are drawn with table cells or inline blocks. It must read on a
  phone without sideways scrolling, and survive Gmail and Outlook (which strip `<style>` blocks or parts of them).
- **Freshness is honest.** Where a section's source is older than the report period (no SKU Analysis uploaded this
  cycle, no Daily Sales Report), the section says so in its header and the summary does not describe it as current.
- **A mid-month SKU Analysis upload doesn't move the budget.** Today any upload with a SKU Analysis runs the full
  month-end refresh (`merchandise/pipeline/refresh.py` `build_bundle`), which rebuilds `base/current` and the budget.
  The bi-weekly upload refreshes stock, items, insights, brands, the SKU snapshot and subcategories, and saves the
  two-week sales figures; the budget (`base/current`, the plan) is rebuilt only by the month-end upload, as now.
  *(Claude's call, offered to Ian on 2026-11-25; he didn't object.)*
- **Two-week sales come from the Daily Sales Report.** PR #42 (never merged, on an old base) read it into
  `pulse/{date}`: month to date and fiscal year to date by category against plan and last year. The report needs the
  same, reworked onto today's code. Two weeks' sales = month/year-to-date difference between two consecutive
  uploads, or the report's own week figures if it gives them.
- Jonas is the official record; the receiving log only says what arrived (from the receiving work).

## Approaches

1. **Built from the app's own numbers (chosen).** A report function in the page's own code (`merchandise/app/src`)
   turns the stored documents into one data object, and a renderer turns that into email-safe HTML. The app shows it
   as a page (a **Report** view, reached from Home and the email's links); the server can later build the same HTML in
   Node by loading the page's calculation files against the stored documents, as the tests already do
   (`lib/merch/page-harness.ts`). Every figure matches the app. Costs: the page's code must run on the server, so the
   report code must not touch the page's DOM except through the renderer's output.
2. *Built during the upload* (Python pipeline writes a report document). Simpler to send, but a second copy of every
   calculation that drifts from the app; a guideline change after the upload would make the report and the app
   disagree. Rejected.
3. *A short email pointing to an app page.* Least work, but against "as much useful information as we can" in the
   email. Rejected.

Ian picked 1.

## Decided by Ian

- Audience: people who make managerial decisions; recipients chosen by Ian (later).
- Cadence: every two weeks; Ian uploads the SKU Analysis (and the Daily Sales Report) every two weeks.
- Look: mockup v2 — mockup B's written opening and scorecard, mockup A's sections, expanded as listed above.
- Links into the app; built as an email.
- Approach 1.

## Left to the builder

- The exact rules that write the summary sentences and pick each scorecard colour (green within guideline / on pace /
  none late; amber near; red outside or late), following the app's existing grades and verdicts.
- How many rows each list shows before "and N more" (the mockup: late all, arriving 3, arrived 2, restock up to 8,
  hot 5, cold 5, brands 5, fixes 5).
- Where the bi-weekly upload lives on the Month-end page and how it's labelled.
- Whether the in-app Report page is a view of Home or its own sidebar entry.
- The two-week period: the two weeks ending on the Sunday of the latest Daily Sales Report.
