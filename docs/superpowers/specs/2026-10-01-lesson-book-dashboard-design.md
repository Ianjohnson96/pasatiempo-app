# Lesson Book: dashboard, schedule, lesson dates, prices, fixes

Date: 2026-10-01 · Status: approved in chat, awaiting spec review

## Intent

Ian uses the Lesson Book mostly **on his phone, on the lesson tee**. Opening it
should answer, in this order: who is next and what is this week; what money is
owed / pending / collected; who needs a follow-up; how much he is teaching.
He also wants to see the dates of the lessons in any package ("which lesson of
the series are we on"), and the pages must be fast and not overflow.

Said by Ian: all four dashboard areas; lesson dates both on packages and as a
schedule view; phone first; DB fixes may be applied live; "most prices are the
same but some are different".
Assumed: "season" = calendar year to date; "not seen" = 30 days with nothing
booked; revenue is cash basis (by `paid_on`).

## Facts that shape the design (live data, 2026-10-01)

- 86 clients, 43 packages, 283 lessons (Jan 2025 → Oct 2026), 6 booked ahead,
  149 lessons in no package.
- **0 of 43 packages have a price; 0 have a paid date.** Money views must work
  from empty and push the price backlog, not pretend $0.

## 1. Fixes

Database (applied, `supabase/migration-lessons-fixes.sql`):
- `lessons.calendar_uid` partial unique index → plain unique constraint. Fixes
  "no unique or exclusion constraint matching the ON CONFLICT specification"
  in the sync and in Review → "It's a lesson".
- `lesson_client_summary` fan-out (lessons × packages) fixed; counts and owed
  were multiplied.
- RLS policies call `(select lesson_is_owner())` so it is evaluated once.

App:
- `.segbtn` gets a button reset (border, background, font). Lesson screens use
  their own `lb-*` layout classes so the global `.row > * {min-width:160px}`
  stops stretching controls. Tap targets ≥ 44px; the payment control is a
  full-width three-way bar under 560px. Stat tiles use `.n` / `.l`.
- Speed: each screen loads with one RPC; the Review badge count comes from the
  same call (header takes it as a prop instead of querying after render).
  Payment / price / size changes are optimistic (`useOptimistic`). Every tab
  gets a `loading.tsx` skeleton.

## 2. Dashboard (`/lessons`), top to bottom

1. **Next up** — the next scheduled lesson: client, time, "lesson 3 of 5",
   payment badge.
2. **This week** — today through the next 6 days, grouped by day. Row: time,
   client, `N of M` (or "one-off"), chips: Unpaid, "Last one — sell the next".
3. **Money** tiles — Owed (unpaid, priced), Pending, Collected this month,
   Collected this season. Banner "N packages need a price" → price backlog.
4. **Follow up** — Running out (≤1 left, not complete); Unpaid oldest first;
   Not seen 30+ days (active, last completed > 30 days, nothing booked).
   Each list capped at 6 with a "show all".
5. **Teaching volume** — SVG bar chart, lessons per month, last 12 months,
   current month highlighted; this month vs last month and vs same month last
   year; member vs non-member split; top 5 clients this season. Revenue-by-month
   bars (paid_on) with an empty state until payments are dated.
6. **Sync line** — "Calendar synced 6h ago · ok" from `lesson_calendar_sync`;
   red if `last_status` is not ok.

## 3. Lesson dates

- **Package card → "Show dates"** disclosure: numbered lessons in the package,
  `1 · Tue Sep 3 · 2:00 ✓`, booked ones marked "booked", cancelled / no-show
  struck through and unnumbered.
- **Schedule tab** (`/lessons/schedule`): agenda grouped by day. Week | Month
  toggle, prev / next, Today. Defaults to this week. Each row: time, client
  (links to client), `N of M`, status. URL carries `?view=week&d=YYYY-MM-DD`.

Numbering: within a package, non-cancelled lessons ordered by `starts_at`,
`row_number()`; `M` = package size. Computed once in SQL (view
`lesson_numbered`) so every screen agrees.

## 4. Standard prices

- New table `lesson_settings` (single row `id = 1`, `standard_prices jsonb`
  map size → cents), owner-only RLS like the other lesson tables.
- Editor on the dashboard ("Standard prices"): one row per size, add / remove.
- New packages prefill the standard price for their size.
- **Price backlog** (`/lessons/prices`): every unpriced package with a
  "Use $X" button (if a standard exists for its size) and a custom price box;
  "Apply standard to all N" with a confirm step.

## 5. Architecture

- SQL: `lesson_numbered` view; `lesson_dashboard()` and
  `lesson_schedule(from_ts, to_ts)` functions, `security invoker`, returning
  `jsonb`; times bucketed in `America/Los_Angeles`.
- `lib/lessons/data.ts` gains `dashboardData()`, `scheduleData()`,
  `packageLessons()`; parsing to plain types in `types.ts`.
- Pure helpers in `lib/lessons/calc.ts` (week range, day grouping, month
  series filling, deltas) — unit tested with vitest.
- Components: `Dashboard*` sections, `Agenda`, `BarChart` (SVG, no library),
  `PriceBacklog`, `StandardPrices`; `PackageCard` gains the dates disclosure.

## Testing

- vitest for `calc.ts`.
- SQL checks against live data: numbering matches package `used` counts;
  dashboard totals match direct queries.
- Browser at 375px and desktop: no horizontal scroll, controls tappable, each
  tab loads, payment toggle responds instantly.

## Out of scope

The old `lessons.*` schema tables (students, payments, pending…) left from the
previous model; group clinics; per-lesson money.
