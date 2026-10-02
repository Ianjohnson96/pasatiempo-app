# Lesson Book Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Lesson Book front page into a phone-first dashboard (next up, this week, money, follow-ups, volume, sync), add a Schedule tab, per-package lesson dates, and standard prices with a price backlog.

**Architecture:** One SQL view (`lesson_numbered`) numbers every lesson within its package; one `security invoker` function (`lesson_dashboard()`) returns the whole dashboard as `jsonb` in a single round trip. Pages stay server-rendered; pure date/scale helpers live in `lib/lessons/calc.ts` and are unit tested. Charts are hand-written SVG.

**Tech Stack:** Next.js 16 (app router, server actions), React 19, Supabase Postgres + RLS, vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-lesson-book-dashboard-design.md`
(Deviation: the spec's `lesson_schedule(from, to)` function is dropped — the
schedule reads the `lesson_numbered` view with a range filter, which is one
round trip already.)

## Global Constraints

- Phone first: no horizontal page scroll at 375px; tap targets ≥ 44px under 560px.
- All dates/times in `America/Los_Angeles` (`COURSE_TZ`), including week/month/season boundaries.
- Money is integer cents; unpriced is `null` and is never shown as `$0`.
- Lesson book data is read as the signed-in user (`lessonBookClient()`), never service_role; new tables get the owner policy `using ((select public.lesson_is_owner()))`.
- No new npm dependencies. Layout classes are `lb-*` in `app/lessons/lessons.css`; do not use the global `.row`.
- "Season" = calendar year to date. Counted lesson = status `completed` or `scheduled`.
- No git commits unless Ian asks (the tree holds his uncommitted rework).

## Review Focus

1. A lesson at 11:30pm Pacific (06:30Z next day) or across a DST change must land on its Pacific day — `calc.test.ts` pins both.
2. A package with more counted lessons than its size shows "6 of 5" and an over-package chip, never crashes or hides the lesson — `seqLabel` test.
3. Empty data (no prices, no paid dates, nothing booked) renders empty states, and a chart whose values are all 0 draws no NaN heights — `scaleBars` test.
4. Garbage schedule URLs (`?d=nonsense&view=year`) fall back to this week — `parseScheduleParams` test.
5. "Apply standard to all" only fills packages whose price is still `null` and never overwrites a recorded price — SQL guard `price_cents is null` in the update, checked in Task 6 Step 3.

---

### Task 1: Database — numbering view, settings table, dashboard function

**Files:**
- Create: `supabase/migration-lessons-dashboard.sql` (apply with Supabase `apply_migration`, project `whzelknnxvooguvbajap`)

**Interfaces:**
- Produces:
  - view `public.lesson_numbered` (security_invoker) columns: `id, client_id, client_name, is_member, package_id, package_size, package_label, payment_status, price_cents, seq, starts_at, ends_at, status, title_raw, calendar_uid`. `seq` = `count(*) filter (where status in ('completed','scheduled')) over (partition by package_id order by starts_at, id)` when the row is in a package and counted, else `null`.
  - table `public.lesson_settings (id int pk default 1 check (id = 1), standard_prices jsonb not null default '{}', updated_at timestamptz not null default now())`, one row seeded, owner RLS, `grant select, insert, update to authenticated`. `standard_prices` maps size text → cents, e.g. `{"5": 50000}`.
  - function `public.lesson_dashboard() returns jsonb`, `language sql stable security invoker`, keys:
    `now, next (lesson_numbered row|null), week (rows, today 00:00 → +7 days, not cancelled), money {owed_cents, pending_cents, unpaid_count, pending_count, collected_month_cents, collected_season_cents, unpriced}, running_out (lesson_package_status rows: not is_complete and lessons_remaining <= 1), unpaid (lesson_package_status rows, payment_status='unpaid', sold_on asc nulls last), not_seen ([{id,name,last_lesson_at}] active clients, last completed lesson between 30 and 180 days ago, nothing scheduled ahead), months ([{month:'YYYY-MM', lessons, revenue_cents}] 13 months ending this month, gaps filled with 0), split {member, guest} (counted lessons this season), top_clients ([{id,name,lessons}] top 5 this season), sync {last_synced_at, last_status}|null, review_count, standard_prices`.

- [ ] **Step 1:** Write the migration file with the three objects above; Pacific day start is `((now() at time zone 'America/Los_Angeles')::date)::timestamp at time zone 'America/Los_Angeles'`.
- [ ] **Step 2:** Apply it.
- [ ] **Step 3: Verify against live data**

```sql
-- numbering agrees with lesson_package_status.used for every package
select count(*) from lesson_package_status s
 where s.lessons_used <> (select count(*) from lesson_numbered n
   where n.package_id = s.package_id and n.status = 'completed');   -- expect 0
select jsonb_array_length(lesson_dashboard()->'months');            -- expect 13
select (lesson_dashboard()->'money'->>'unpriced')::int;             -- expect 43
```
Run as the owner (`set local role authenticated` + `request.jwt.claims` with the `lesson_owners.user_id`) inside `begin … rollback`, and as an anonymous `authenticated` user expect empty arrays. Re-run the security advisors; expect no new lesson findings.

### Task 2: Pure helpers — `lib/lessons/calc.ts`

**Files:**
- Create: `lib/lessons/calc.ts`, `lib/lessons/calc.test.ts`

**Interfaces:**
- Produces:
  - `courseDay(iso: string): string` — `YYYY-MM-DD` in Pacific.
  - `courseMidnightIso(day: string): string` — UTC ISO of Pacific midnight. Algorithm: take `Date.UTC(y,m-1,d,12)`, read its Pacific wall time via `Intl.DateTimeFormat(...).formatToParts`, offset = wall − utc in minutes; return `Date.UTC(y,m-1,d) − offset`.
  - `addDays(day: string, n: number): string`
  - `weekRange(day: string): { from: string; to: string; days: string[] }` — Monday-start, `to` exclusive.
  - `monthRange(day: string): { from: string; to: string }` — first of month → first of next.
  - `shiftAnchor(day: string, view: "week" | "month", dir: -1 | 1): string`
  - `parseScheduleParams(p: { view?: string; d?: string }, today: string): { view: "week" | "month"; day: string }`
  - `groupByDay<T extends { startsAt: string }>(items: T[]): { day: string; items: T[] }[]` — ascending.
  - `seqLabel(l: { seq: number | null; packageSize: number | null; packageId: string | null; status: string }): string` — `"3 of 5"`, `"one-off"`, or `""` for cancelled/no_show.
  - `scaleBars(values: number[], height: number): number[]`
  - `delta(cur: number, prev: number): { diff: number; pct: number | null }`

- [ ] **Step 1: Write the failing tests**

```ts
expect(courseDay("2026-10-01T06:30:00Z")).toBe("2026-09-30");
expect(courseMidnightIso("2026-10-01")).toBe("2026-10-01T07:00:00.000Z");
expect(courseMidnightIso("2026-12-01")).toBe("2026-12-01T08:00:00.000Z");
expect(courseMidnightIso("2026-11-01")).toBe("2026-11-01T07:00:00.000Z"); // DST ends 2am that day
expect(weekRange("2026-10-01").from).toBe("2026-09-28");
expect(weekRange("2026-10-01").to).toBe("2026-10-05");
expect(weekRange("2026-10-01").days).toHaveLength(7);
expect(monthRange("2026-10-15")).toEqual({ from: "2026-10-01", to: "2026-11-01" });
expect(shiftAnchor("2026-01-31", "month", 1)).toBe("2026-02-01");
expect(shiftAnchor("2026-10-01", "week", -1)).toBe("2026-09-24");
expect(parseScheduleParams({ view: "year", d: "nonsense" }, "2026-10-01")).toEqual({ view: "week", day: "2026-10-01" });
expect(groupByDay([{ startsAt: "2026-10-02T06:30:00Z" }, { startsAt: "2026-10-01T17:00:00Z" }]).map((g) => g.day)).toEqual(["2026-10-01"]);
expect(seqLabel({ seq: 6, packageSize: 5, packageId: "p", status: "completed" })).toBe("6 of 5");
expect(seqLabel({ seq: null, packageSize: null, packageId: null, status: "completed" })).toBe("one-off");
expect(seqLabel({ seq: null, packageSize: 5, packageId: "p", status: "cancelled" })).toBe("");
expect(scaleBars([0, 0], 100)).toEqual([0, 0]);
expect(scaleBars([5, 10], 100)).toEqual([50, 100]);
expect(delta(16, 9)).toEqual({ diff: 7, pct: 78 });
expect(delta(5, 0)).toEqual({ diff: 5, pct: null });
```
- [ ] **Step 2:** `npx vitest run lib/lessons/calc.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `calc.ts`.
- [ ] **Step 4:** Same command → PASS.

### Task 3: Types, data layer, actions

**Files:**
- Modify: `lib/lessons/types.ts`, `lib/lessons/data.ts`, `lib/lessons/actions.ts`

**Interfaces:**
- Consumes: Task 1 view/function/table.
- Produces:
  - `interface NumberedLesson extends LessonRec { isMember: boolean; packageSize: number | null; packageLabel: string | null; paymentStatus: PaymentStatus | null; seq: number | null }`
  - `interface MonthPoint { month: string; lessons: number; revenueCents: number }`
  - `interface DashboardData { now: string; next: NumberedLesson | null; week: NumberedLesson[]; money: { owedCents: number; pendingCents: number; unpaidCount: number; pendingCount: number; collectedMonthCents: number; collectedSeasonCents: number; unpriced: number }; runningOut: PackageRec[]; unpaid: PackageRec[]; notSeen: { id: string; name: string; lastLessonAt: string }[]; months: MonthPoint[]; split: { member: number; guest: number }; topClients: { id: string; name: string; lessons: number }[]; sync: { lastSyncedAt: string | null; lastStatus: string | null } | null; reviewCount: number; standardPrices: Record<number, number> }`
  - data: `dashboardData(): Promise<DashboardData>` (rpc), `scheduleLessons(fromIso: string, toIso: string): Promise<NumberedLesson[]>`, `clientLessons(clientId): Promise<NumberedLesson[]>` (now from `lesson_numbered`), `standardPrices(): Promise<Record<number, number>>`. Remove `dashboard()` / `Dashboard`.
  - actions: `setStandardPrices(prices: Record<number, number | null>): Promise<Result>` (dollars in, cents stored, nulls dropped); `applyStandardPrices(packageIds: string[]): Promise<Result<number>>` (count filled); `createPackage` prefills the standard price for its size when `dollars` is null/undefined. All revalidate `/lessons`, `/lessons/prices`, `/lessons/schedule` too.

- [ ] **Step 1:** Add the types and a `toNumbered(r: Row): NumberedLesson` mapper; reuse `toPackage` for `running_out` / `unpaid` rows (same column names as `lesson_package_status`).
- [ ] **Step 2:** Implement the data functions and actions. `applyStandardPrices` updates per size with `.in("id", ids).eq("size", size).is("price_cents", null)`.
- [ ] **Step 3:** `npx tsc --noEmit -p .` → errors only in callers of the removed `dashboard()` (fixed in Task 4).

### Task 4: Dashboard page and Schedule tab in the header

**Files:**
- Create: `components/lessons/Agenda.tsx`, `components/lessons/BarChart.tsx`
- Modify: `app/lessons/page.tsx`, `components/lessons/LessonsHeader.tsx`, `app/lessons/lessons.css`

**Interfaces:**
- Consumes: `dashboardData()`, `seqLabel`, `groupByDay`, `scaleBars`, `delta`, `courseDay`.
- Produces:
  - `Agenda({ lessons: NumberedLesson[]; empty: string; today: string })` — server component; day headers ("Today", "Tomorrow", else `Thu, Oct 2`); row = time · client link · seq chip · Unpaid chip (`paymentStatus === "unpaid"`) · "Last one — sell the next" chip (`seq === packageSize`) · "Over package" chip (`seq > packageSize`); cancelled rows struck through.
  - `BarChart({ points: { label: string; value: number; highlight?: boolean }[]; ariaLabel: string; format?: (n: number) => string })` — SVG with `viewBox`, width 100%, value labels on bars > 0, baseline always drawn.
  - `LessonsHeader` tabs: Dashboard, Schedule (`/lessons/schedule`, key `schedule`), Clients, Review.

- [ ] **Step 1:** Load the `dataviz` skill before writing `BarChart`.
- [ ] **Step 2:** Build the page in spec order (Next up, This week, Money + price banner linking `/lessons/prices`, Follow up with each list capped at 6 and the rest in `<details>`, Teaching volume, Sync line).
- [ ] **Step 3:** `npx tsc --noEmit -p .` and `npx eslint app/lessons components/lessons lib/lessons` → clean.

### Task 5: Schedule page

**Files:**
- Create: `app/lessons/schedule/page.tsx`

**Interfaces:**
- Consumes: `parseScheduleParams`, `weekRange`, `monthRange`, `shiftAnchor`, `courseMidnightIso`, `courseDay`, `scheduleLessons`, `reviewCount`, `Agenda`.

- [ ] **Step 1:** Page reads `searchParams` (Promise), builds the range, fetches in one `Promise.all` with the gate and `reviewCount()`. Controls: Week | Month `seg` links, ‹ / Today / › links, a title ("Sep 28 – Oct 4" / "October 2026"), a count line ("14 lessons · 3 booked").
- [ ] **Step 2:** tsc + eslint clean.

### Task 6: Lesson dates on packages, standard prices, price backlog

**Files:**
- Modify: `components/lessons/PackageCard.tsx`, `components/lessons/ClientDetail.tsx`
- Create: `components/lessons/StandardPrices.tsx`, `components/lessons/PriceBacklog.tsx`, `app/lessons/prices/page.tsx`

**Interfaces:**
- Consumes: `NumberedLesson`, `standardPrices()`, `setStandardPrices`, `applyStandardPrices`, `setPackagePrice`, `listPackages()`.
- Produces:
  - `PackageCard` prop `lessons?: NumberedLesson[]` → `<details>` "Show dates (n)" listing `seq · formatWhen(startsAt)` with ✓ for completed, "booked" for scheduled, struck-through unnumbered for cancelled/no_show. Omitted when the prop is absent (dashboard).
  - `StandardPrices({ prices: Record<number, number> })` — client editor, rows of size + dollars, add/remove, Save.
  - `PriceBacklog({ packages: PackageRec[]; prices: Record<number, number> })` — per package "Use $X" (only when a standard exists for its size) or custom box; "Apply standard to all N" behind a confirm step.

- [ ] **Step 1:** ClientDetail passes `lessons.filter((l) => l.packageId === p.id)` to each card.
- [ ] **Step 2:** Prices page: `StandardPrices` on top, `PriceBacklog` of `listPackages()` where `priceCents === null`.
- [ ] **Step 3: Verify the guard** — in `begin … rollback`, set one package's price, run the apply-all update for its size, confirm the recorded price is unchanged.
- [ ] **Step 4:** tsc + eslint + `npx vitest run` clean.

### Task 7: Browser verification and review

- [ ] **Step 1:** With Ian signed in, open `/lessons`, `/lessons/schedule`, `/lessons/clients/<id>`, `/lessons/prices`, `/lessons/review` at 375×812 and desktop. Check `document.documentElement.scrollWidth <= innerWidth` on each, read console errors, tap a payment button and confirm it highlights immediately.
- [ ] **Step 2:** Screenshot the dashboard at phone width for Ian.
- [ ] **Step 3:** Whole-change review and fix findings.
