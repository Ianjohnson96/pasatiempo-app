# Tournament Team Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tournament event type to the Event Planner. A member enters a two-player team (Member + Guest) with email, GHIN and Ian's own per-player or per-team questions, all required where marked. The work also covers duplicate blocking, confirmation emails to both players, full admin editing, a per-player CSV, a "← Club Hub" link and a visual refresh.

**Architecture:** Tournament is one more `EventType` in the existing planner (approach A).
- A registration row is one team.
- A new `players` jsonb column holds both players.
- The top-level `name`/`email`/`phone` stay the member's, so lookup, edit and cancel by email keep working.
- All rules (required answers, GHIN, duplicates, team-count capacity, CSV rows, email bodies) live in **pure modules** with Vitest tests. Server actions and components call them.

**Tech Stack:** Next.js (App Router, server actions), React client components, TypeScript, Supabase (`events` schema, service-role client), nodemailer via `lib/mail.ts`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-tournament-registration-design.md`. Read it first; this plan argues from it.

## Global Constraints

- Work on a new branch `event-planner-tournament` cut from `main`, in a separate worktree. The main checkout has an unrelated uncommitted `components/lessons/LessonLedger.tsx` change that must not be touched or committed.
- Migrations are hand-run SQL in `supabase/`, idempotent (`add column if not exists`). Header comment: "Run once in the HUB Supabase SQL Editor, in the `events` schema." **Never apply a migration without Ian's explicit OK.** Browser checks that need the new columns wait until he has run it.
- Dinners, clinics and general events, and their existing registrations, must behave exactly as before. The only intended changes are the server-side Required check on **new** sign-ups and the confirmation-screen wording.
- Players: exactly 2, roles `"member"` then `"guest"`. Name, email and GHIN are required for both. Emails are trimmed and lower-cased. GHIN is digits only after stripping spaces and dashes.
- A tournament's `capacity` = number of **teams**. A saved tournament forces `scheduleMode: "single"`, `slots: []`, `rosterLimit: null`, `allowGuests: true`, `maxGuests: 1`, `collectGuestNames: true`.
- Public page: never show emails, GHINs or answers. The public tournament roster is names only (per `rosterStyle`); `count_only` reads "N teams".
- Duplicate copy, which must not reveal whose team it is:
  - guest: `"That guest is already entered on another team. Questions? Contact the golf shop."`
  - member: `"You're already entered on another team. Questions? Contact the golf shop."`
  - same person: `"The member and guest can't be the same person."`
- A player's confirmation email must not contain the other player's email or GHIN.
- Email is best-effort: a failed or unconfigured send never fails the registration. It sets `email_failed = true`.
- Admin edits and admin-added teams skip Required and capacity, but still run the duplicate check and name/email/GHIN validity.
- Player labels are hard-coded "Member" and "Guest" (no `team_labels` column).
- Styling: extend `app/globals.css` with new classes using the existing tokens (`--green-*`, `--ink`, `--line`, `--warn`). Don't restyle public dinner and clinic pages beyond shared components.
- No entry-fee work; `FinancialsPanel` and `lib/events/finance*` are untouched.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Same person typed with different case or spacing** (`Bob@X.com ` vs `bob@x.com`; GHIN `123-4567` vs `1234567`): the duplicate check must still match. Tested in Task 2.
2. **Editing your own team** must not clash with itself, and a cancelled team must not block a re-entry. Tested in Task 2 (`excludeRegId`, cancelled rows).
3. **A required "Checkboxes" question with nothing ticked** (`[]`) or a whitespace-only answer counts as unanswered. Tested in Task 2 (`isAnswered`).
4. **A question deleted or switched between player and team scope after teams entered**: stale answer keys are ignored and missing ones are blank, never a crash. Tested in Task 2 (`cleanTeam`) and Task 3 (CSV).
5. **CSV cells with commas, quotes or newlines** (`No nuts, "severe"`) stay one cell. Tested in Task 3 (`csvCell`).

---

### Task 1: Data model, migration and mapping

**Files:**
- Modify: `lib/events/types.ts`, `lib/events/map.ts`, `lib/events/format.ts`
- Create: `supabase/migration-tournament.sql`
- Test: `lib/events/map.test.ts`

**Interfaces:**
- Produces:
  - `EventType = "dinner" | "clinic" | "general" | "tournament"`
  - `FieldType` adds `"radio" | "multi"`
  - `type FieldScope = "player" | "team"`; `CustomField.scope: FieldScope`
  - `type Answer = string | string[]`; `type Answers = Record<string, Answer>`
  - `type PlayerRole = "member" | "guest"`
  - `interface Player { role: PlayerRole; name: string; email: string; ghin: string; answers: Answers }`
  - `Registration` gains `players: Player[] | null` and `emailFailed: boolean`; `Registration.answers: Answers`
  - `TYPE_LABEL.tournament = "Tournament"`
  - `answerText(a: Answer | undefined): string` in `format.ts` (arrays joined with `", "`)

- [ ] **Step 1: Write the failing test** `lib/events/map.test.ts`:
  - `rowToEvent` on a row whose `custom_fields` lack `scope` gives every field `scope: "team"`.
  - A field stored with `scope: "player"` keeps it.
  - `rowToReg` with `players: [member, guest]` and `email_failed: true` gives `players.length === 2` and `emailFailed === true`.
  - `rowToReg` with neither gives `players === null` and `emailFailed === false`.
  - `answerText(["S","M"]) === "S, M"`; `answerText(undefined) === ""`.
- [ ] **Step 2: Run** `npx vitest run lib/events/map.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, the `scope ?? "team"` default in `rowToEvent`, `players`/`emailFailed` in `rowToReg`, `TYPE_LABEL.tournament` and `answerText`. Then `npx tsc --noEmit` and fix each place the widened `answers` type breaks (`EventManager.tsx`, `RegistrationForm.tsx`, `RegistrationEditor.tsx`, `ManageRegistration.tsx`, `app/events/e/[slug]/page.tsx`) with `answerText(...)`, with no change in behaviour.
- [ ] **Step 4: Write `supabase/migration-tournament.sql`:**
  - `alter table events.registrations add column if not exists players jsonb;`
  - `alter table events.registrations add column if not exists email_failed boolean not null default false;`
  - Check the live DB for a check constraint on `events.events.type` with a read-only `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'events.events'::regclass;` (Supabase MCP `execute_sql`). If one exists, add a concrete `drop constraint … ; add constraint … check (type in ('dinner','clinic','general','tournament'))` to the file.
  - Don't apply it.
- [ ] **Step 5: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 6: Commit** `Event Planner: tournament type, players column, per-player question scope`.

### Task 2: Pure rules: seats, answers, GHIN, team validation, duplicates

**Files:**
- Create: `lib/events/seats.ts` (pure seat math moved out of `data.ts`)
- Modify: `lib/events/data.ts` (re-export everything moved, so existing imports work), `lib/events/actions.ts` (import from `./seats`)
- Create: `lib/events/tournament.ts`
- Test: `lib/events/seats.test.ts`, `lib/events/tournament.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces in `seats.ts`:
  - `regWeight(event: Pick<EventRec,"type">, r: Registration): number`: 1 for tournaments, else `max(1, partySize)`.
  - `takenSeats(regs, slotId = null, event?: Pick<EventRec,"type">)`: uses `regWeight` when `event` is given.
  - `availability(event, regs, slotId?)` passes `event` to `takenSeats`, so tournaments count teams.
  - `rosterCount`, `rosterAvailability`, `onRoster` and their types move unchanged.
- Produces in `tournament.ts`:
  - `normalizeGhin(s: string): string`: strips spaces and dashes, trims.
  - `isValidGhin(s: string): boolean`: non-empty and all digits after normalising.
  - `isAnswered(a: Answer | undefined): boolean`
  - `missingRequired(fields: CustomField[], answers: Answers, scope: FieldScope | "all"): CustomField | null`
  - `interface TeamInput { players: Player[]; teamAnswers: Answers }`
  - `cleanTeam(input: TeamInput, fields: CustomField[]): TeamInput`: trims, lower-cases emails, normalises GHIN, forces roles `[member, guest]`, keeps only answer keys of current fields with the matching scope, and trims string answers or drops empty items in arrays.
  - `validateTeam(event: EventRec, team: TeamInput, opts: { enforceRequired: boolean }): string | null`: the first error, prefixed `"Member: "` / `"Guest: "` for player errors:
    - `"please enter a name."`
    - `"please enter a valid email."`
    - `"please enter a GHIN number."`
    - `"GHIN numbers are digits only."`
    - `` `please answer ${label}.` ``
    - team questions: `` `Please answer ${label}.` ``
    - same person (email or GHIN): the same-person copy.

    Question answers are checked only when `enforceRequired`.
  - `findDuplicate(regs: Registration[], team: TeamInput, excludeRegId?: string): PlayerRole | null`: the first incoming player (member first) whose email OR GHIN matches any player on another `confirmed`/`waitlist` registration with `players != null`. Both sides are normalised.
  - `duplicateMessage(role: PlayerRole): string`

- [ ] **Step 1: Write failing tests.**
  - `seats.test.ts`:
    - A tournament with `capacity: 2` and two confirmed regs of `partySize: 2` → `availability(...)` has `taken === 2` and `full === true`.
    - The same regs on a dinner with `capacity: 4` → `taken === 4`.
    - Waitlisted and cancelled regs aren't counted.
  - `tournament.test.ts`:
    - `normalizeGhin(" 123-4567 ") === "1234567"`; `isValidGhin("12a4") === false`.
    - `isAnswered([]) === false`; `isAnswered("  ") === false`; `isAnswered(["M"]) === true`.
    - Guest email empty → `"Guest: please enter a valid email."`.
    - A required player question blank for the guest → `"Guest: please answer Shirt size."`; the same input with `enforceRequired:false` → `null`.
    - Required team question blank → `"Please answer Team name."`.
    - Member `A@x.com`, guest `a@X.com` → the same-person copy.
    - `findDuplicate`:
      - incoming guest `" Bob@X.com"` vs an existing member `bob@x.com` → `"guest"`
      - incoming member GHIN `"123-4567"` vs an existing guest `"1234567"` → `"member"`
      - the clashing reg `cancelled` → `null`
      - `excludeRegId` = the clashing reg → `null`
      - a reg with `players: null` (dinner) is ignored
    - `cleanTeam` drops the key of a deleted field and a team-scope key found in player answers.
- [ ] **Step 2: Run** `npx vitest run lib/events/seats.test.ts lib/events/tournament.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `seats.ts`, the re-exports in `data.ts`, the import switch in `actions.ts`, and `tournament.ts`.
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `Event Planner: tournament rules — team validation, duplicates, team-count capacity`.

### Task 3: CSV export builder

**Files:**
- Create: `lib/events/csv.ts`
- Modify: `components/events/EventManager.tsx` (`exportCsv` uses the builder; local `csvCell` removed)
- Test: `lib/events/csv.test.ts`

**Interfaces:**
- Consumes: `answerText`; Task 1 types.
- Produces:
  - `csvCell(v: string): string`: quotes when there's a comma, quote or newline; doubles quotes.
  - `toCsv(rows: string[][]): string`: `\r\n` line endings.
  - `signupRows(event: EventRec, regs: Registration[]): string[][]`: today's columns and behaviour, moved verbatim (`slotLabels` moves too).
  - `tournamentRows(event: EventRec, regs: Registration[]): string[][]`:
    - Header: `Team #, Role, Name, Email, GHIN, Phone, <player-scope labels…>, <team-scope labels…>, Status, Registered at`.
    - One row per player.
    - Team # counts 1… over non-cancelled teams in `createdAt` order; cancelled teams go last with Team # blank.
    - The member's row carries the phone; the guest's phone is blank.
    - Team answers repeat on both rows.
    - Role is `"Member"` / `"Guest"`.
  - `csvFilename(event: EventRec): string`: `<slug-of-title>-teams.csv` for tournaments, else `-signups.csv`.

- [ ] **Step 1: Write failing tests:**
  - `csvCell('No nuts, "severe"') === '"No nuts, ""severe"""'`.
  - Two teams → 1 header + 4 rows; row 1 starts `["1","Member"]`, row 2 `["1","Guest"]`.
  - `["S","M"]` → `"S, M"`.
  - A stale answer key produces no column; a missing answer is `""`.
  - A cancelled team sorts last with Team # `""`.
- [ ] **Step 2: Run** `npx vitest run lib/events/csv.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, and switch `EventManager.exportCsv` to pick `tournamentRows` or `signupRows` by type.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `Event Planner: per-player CSV export for tournaments`.

### Task 4: Confirmation email builder

**Files:**
- Create: `lib/events/tournament-email.ts`
- Test: `lib/events/tournament-email.test.ts`

**Interfaces:**
- Consumes: `Mail` (`lib/mail.ts`), `formatWhen`, `answerText`; Task 1 types.
- Produces: `teamEmails(event: EventRec, players: Player[], teamAnswers: Answers, status: "confirmed" | "waitlist"): Mail[]`, which returns `[toMember, toGuest]`.
  - Subject: `` `${event.title}: your team entry` ``; waitlist: `` `${event.title}: you're on the waitlist` ``.
  - Body:
    - title, `formatWhen(startsAt, endsAt)`, location
    - `Team: <member> & <guest>`
    - the recipient's own player answers as `label: value`
    - team answers
    - a status line ("Your team is confirmed." / "Your team is on the waitlist; we'll be in touch if a spot opens.")
  - The guest's body adds `` `${memberName} entered this team for you.` ``
  - Both end `"Questions? Contact the golf shop."`
  - `html` escapes names and answers.

- [ ] **Step 1: Write failing tests:**
  - `to` = member email, then guest email.
  - The member mail's `text` and `html` contain neither the guest's email nor the guest's GHIN, and vice versa.
  - The guest text contains `"entered this team for you"`.
  - The name `<b>x</b>` appears as `&lt;b&gt;x&lt;/b&gt;` in `html`.
- [ ] **Step 2: Run** `npx vitest run lib/events/tournament-email.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `Event Planner: tournament confirmation emails`.

### Task 5: Server actions

**Files:**
- Modify: `lib/events/actions.ts`

**Interfaces:**
- Consumes: Tasks 1, 2 and 4; `sendMail` from `lib/mail.ts`.
- Produces:
  - `RegisterInput.team?: TeamInput`. For tournaments, `name`/`email` are taken from the member player and `phone` from `input.phone`.
  - `MyRegistration.players: Player[] | null`; `MyRegistrationEdit.team?: TeamInput`; `RegistrationEdit.team?: TeamInput`.
  - `adminAddTeam(eventId: string, team: TeamInput, phone: string, sendEmails: boolean): Promise<{ ok: boolean; error?: string }>`
  - Private `sendTeamConfirmation(regId: string, event: EventRec, team: TeamInput, status: "confirmed" | "waitlist"): Promise<void>`: sends each of `teamEmails(...)` via `sendMail`; on any non-null result, `console.error` it and set `email_failed = true` on the row.

- [ ] **Step 1: `register()`:**
  - Non-tournament: after the invite check, add `missingRequired(ev.customFields, input.answers, "all")` → `` `Please answer: ${label}` ``.
  - Tournament:
    - `cleanTeam` → `validateTeam(…, {enforceRequired: true})` → `findDuplicate(regs, team)` → `duplicateMessage`.
    - Skip the roster-cap block. Capacity and waitlist use `availability` (team-counted).
    - Insert `party_size: 2`, `guest_names: [guest.name]`, `players`, `answers: team.teamAnswers`, `name`/`email` = member, with `.select("id").single()`.
    - Then `await sendTeamConfirmation`.
- [ ] **Step 2: `lookupMyRegistrations`** returns `players`. **`updateMyRegistration`** for tournaments:
  - `cleanTeam` → `validateTeam(enforceRequired: true)`.
  - If the member email differs from the stored one → `"To change the member's email, contact the golf shop."`
  - `findDuplicate(all, team, regId)`.
  - Update `name`, `phone`, `players`, `answers`, `guest_names`. No emails are re-sent.
- [ ] **Step 3: `updateRegistration` (admin)** for tournaments:
  - Load the event's regs, then `cleanTeam` → `validateTeam(enforceRequired: false)` → `findDuplicate(regs, team, id)`.
  - Write `players`, `answers`, `status`, `phone`, and derive `name`/`email`/`guest_names`/`party_size: 2`.
- [ ] **Step 4: `adminAddTeam`:**
  - `assertCanManageEvent(eventId)` → `cleanTeam` → `validateTeam(enforceRequired: false)` → `findDuplicate`.
  - Insert with `status: "confirmed"`, ignoring capacity.
  - Call `sendTeamConfirmation` if `sendEmails`.
  - Revalidate `/admin/events/${eventId}` and its `/roster`.
- [ ] **Step 5: `saveEventInner`:** keep `scope: f.scope ?? "team"` in `cleanFields`, and apply the tournament forcing from Global Constraints.
- [ ] **Step 6: Run** `npx tsc --noEmit` and `npx vitest run`. Expected: PASS.
- [ ] **Step 7: Commit** `Event Planner: register, edit and add tournament teams on the server`.

### Task 6: Shared question input + public team entry form

**Files:**
- Create: `components/events/QuestionInput.tsx`, `components/events/TeamEntryForm.tsx`
- Modify: `components/events/RegistrationForm.tsx`, `app/globals.css` (`.team-grid`, `.player-card`, `.field-err`, `.choice-chips`, `.review-team`)

**Interfaces:**
- Consumes: Task 1 types; `validateTeam`, `isAnswered`; `register` with `team`; `SeatInfo`.
- Produces:
  - `QuestionInput({ field, value, onChange, error }: { field: CustomField; value: Answer | undefined; onChange: (v: Answer) => void; error?: string })`. It renders every `FieldType`: `radio` as single-select chips, `multi` as multi-select chips (`string[]`).
  - `TeamEntryForm(props: { event: EventRec; seats: SeatInfo; mode: "public" | "preview" | "admin"; initial?: { team: TeamInput; phone: string }; lockMemberEmail?: boolean; onSubmit?: (team: TeamInput, phone: string, sendEmails: boolean) => Promise<string | null> })`
    - `"preview"` is read-only with no submit.
    - `"admin"` skips the client required check and shows "Send confirmation emails" (default checked).
    - `onSubmit` returns an error string or `null`.
    - When `onSubmit` is absent in `"public"` mode, it calls `register` itself.

- [ ] **Step 1: `QuestionInput`:** use it for `RegistrationForm`'s custom fields. Existing types must look unchanged. Non-tournament confirmation copy drops "A confirmation will be sent to …" and keeps "Thanks, <first name>. We've got you down for <title>.".
- [ ] **Step 2: `TeamEntryForm`**, per the spec's sign-up form section:
  - Two `.player-card`s ("Member", "Guest"), side by side, stacking below 720px.
  - Each card: name, email, GHIN # (`inputMode="numeric"`, hint "Usually 7–8 digits", no hard length limit), and phone (member only, optional), then that card's player-scope questions.
  - Team questions below.
  - Inline `.field-err` errors, routing the `"Member: "`/`"Guest: "` prefix to the card.
  - "Review your team →" runs `validateTeam(enforceRequired: true)`.
  - The review screen shows both players with "Edit" and "Submit entry".
  - The confirmation lists the team plus `"A confirmation email has been sent to both players."` (waitlist: `"Your team is on the waitlist. A confirmation email has been sent to both players."`).
  - `RegistrationForm` renders `TeamEntryForm mode="public"` when `event.type === "tournament"`.
- [ ] **Step 3: Verify in the browser** (`preview_start`), once Ian has run the migration:
  - Blank submit → inline errors on both cards.
  - A full entry → review → confirmation.
  - A second entry reusing that guest's GHIN → the duplicate copy.
  - A dinner still registers as before.
  - 375px width.
- [ ] **Step 4: Commit** `Event Planner: team entry form for tournaments`.

### Task 7: Member self-service edit for teams

**Files:**
- Modify: `components/events/ManageRegistration.tsx`

**Interfaces:**
- Consumes: `TeamEntryForm` (`mode="public"`, `lockMemberEmail`, `initial` from `MyRegistration`), `updateMyRegistration` with `team`, `cancelMyRegistration`.

- [ ] **Step 1:** For tournament registrations, show a team summary with "Edit team" (the form prefilled, member email locked) and "Cancel entry". Non-tournament events are unchanged.
- [ ] **Step 2: Verify in the browser:**
  - Look up by the member email and change the guest's shirt size → saved.
  - Look up by the guest email → not found.
  - Clear a required answer → inline error.
- [ ] **Step 3: Commit** `Event Planner: members can edit their tournament team`.

### Task 8: Admin: team list, full edit, add team, email flag, roster print

**Files:**
- Modify: `components/events/EventManager.tsx`, `components/events/RegistrationEditor.tsx`, `app/admin/events/[id]/roster/page.tsx`, `app/globals.css` (`.team-card`, `.flag-warn`)

**Interfaces:**
- Consumes: `TeamEntryForm mode="admin"`, `updateRegistration` with `team`, `adminAddTeam`, `Registration.emailFailed`, `answerText`.

- [ ] **Step 1: `EventManager` for tournaments:**
  - Each registration is a `.team-card`: member and guest each with email, GHIN and answers; team answers; the status pill; the existing status, paid and delete controls.
  - `.flag-warn` "Email not sent" when `emailFailed`.
  - The header count reads "N of C teams".
  - "+ Add team" opens `TeamEntryForm mode="admin"` → `adminAddTeam`.
  - "Copy emails" and "Email all" include guest emails.
- [ ] **Step 2: `RegistrationEditor`** for tournaments renders `TeamEntryForm mode="admin"` with `initial` plus the status select, saving via `updateRegistration({ ...rest, team })`.
- [ ] **Step 3: Roster print** for tournaments: one table, a row per team with columns Team #, Member (name · GHIN), Guest (name · GHIN), Contact (member email · phone); waitlist below.
- [ ] **Step 4: Verify in the browser:**
  - Edit a guest's GHIN.
  - Add a team with a blank required answer → allowed.
  - Add a team reusing a player → blocked.
  - With SMTP unset locally, a new entry shows "Email not sent".
  - The CSV has one row per player.
  - The print roster renders.
- [ ] **Step 5: Commit** `Event Planner: admin team editing, add team, roster`.

### Task 9: Question builder

**Files:**
- Create: `components/events/QuestionBuilder.tsx`
- Modify: `components/events/EventEditor.tsx` (the Custom questions card body becomes `QuestionBuilder`), `app/globals.css` (`.qb-row`, `.qb-type-chips`, `.qb-locked`)

**Interfaces:**
- Produces: `QuestionBuilder({ fields, onChange, tournament }: { fields: CustomField[]; onChange: (f: CustomField[]) => void; tournament: boolean })`. New fields default to `scope: "player"` when `tournament`, else `"team"`.

- [ ] **Step 1: Build it** per the spec's question-builder bullet:
  - Label input.
  - Type chips: Text · Paragraph · Dropdown · Multiple choice · Checkboxes · Number · Yes/No (`short_text, long_text, select, radio, multi, number, checkbox`).
  - An option list (one row per option, with add and remove) for `select`, `radio` and `multi`.
  - A Required switch; "Each player / Once per team" (tournament only).
  - ↑ / ↓ reorder and Remove.
  - Tournament only: locked rows at the top ("Name", "Email", "GHIN #", each tagged "each player · required"), and an "Add common question" menu:
    - Dietary restrictions (`short_text`, player, required)
    - Shirt size (`radio`, player, required, `XS, S, M, L, XL, XXL, XXXL`)
    - Hat size (`radio`, player, `S/M, L/XL`)
    - Glove size (`radio`, player, `S, M, ML, L, XL`)
- [ ] **Step 2: Verify in the browser:** build Dietary + Shirt size + one team question, save, reload. Order, scope, required and options persist.
- [ ] **Step 3: Commit** `Event Planner: question builder with answer types, required and per-player scope`.

### Task 10: Editor layout: type tiles, tournament settings, steps, preview

**Files:**
- Modify: `components/events/EventEditor.tsx`, `app/globals.css` (`.type-tiles`, `.editor-shell`, `.editor-steps`, `.editor-preview`)

**Interfaces:**
- Consumes: `QuestionBuilder`, `TeamEntryForm mode="preview"`, `RegistrationForm` (for non-tournament preview, in an `inert` wrapper).

- [ ] **Step 1: Type tiles** replace the `<select>`. Each has an icon and one line:
  - Tournament: "Two-player team entry with GHIN"
  - Dinner / Social: "Seated or social, guests welcome"
  - Clinic / Lesson: "Dates or time slots"
  - General: "Anything else"

  Tournament hides the schedule-mode switch, slots, the roster cap, the Guests card and "collect guest names". "Total spots" becomes "Max teams".
- [ ] **Step 2: Steps:**
  - Sections get ids `details, schedule, questions, pricing, roster, access, publish`, labelled Details · Schedule · Players & Questions · Pricing · Roster · Access · Publish. Co-managers and Status go in Publish.
  - A sticky left `.editor-steps` nav with IntersectionObserver scroll-spy at ≥ 960px; a horizontal chip row below that.
  - One save action, shown as a sticky bottom bar on desktop.
- [ ] **Step 3: Live preview:** a right column at ≥ 1280px renders the preview from the current editor state; below that, a "Preview" button opens it in an overlay. If this proves costly, fall back to a "Preview form" button opening `/events/e/<slug>` in a new tab, and say so in the commit message so Ian is told.
- [ ] **Step 4: Verify in the browser:**
  - Create a Tournament with Max teams 36, save, reopen → persisted.
  - An existing dinner saves identically.
  - Check 375, 1024 and 1440px.
- [ ] **Step 5: Commit** `Event Planner: editor layout — type tiles, steps, live preview`.

### Task 11: Events list cards, Club Hub link, public tournament roster

**Files:**
- Modify: `components/events/AppBar.tsx`, `app/admin/events/page.tsx`, `app/events/e/[slug]/page.tsx`, `app/globals.css` (`.evcard`, `.evcard-stripe`, `.datebox`, `.fillbar`)

- [ ] **Step 1: `AppBar`:** in admin mode, add `<Link href="/admin" className="navlink">← Club Hub</Link>` before "All events".
- [ ] **Step 2: Events list:**
  - Each event is an `.evcard` with a type-coloured stripe and icon, and a `.datebox` (month and day from `startsAt`, else "TBD").
  - Title + status badge, then meta.
  - `.fillbar` from `availability(ev, regs)`: "28 of 36 teams" / "42 of 60 spots" / "42 signed up".
  - The waitlist count, then the existing CopyLink, View and Manage.
- [ ] **Step 3: Public roster** for tournaments with `showRoster`: "<member> & <guest>" via `rosterName`; `count_only` → "N teams". View-source shows no email, GHIN or answer.
- [ ] **Step 4: Verify in the browser:**
  - Club Hub link from the list, the editor and the manage page → `/admin`.
  - Cards for all four types at 375px.
  - The tournament public page source has no GHIN.
- [ ] **Step 5: Commit** `Event Planner: event cards, Club Hub link, public team roster`.

### Task 12: Whole-flow check

- [ ] **Step 1:** `npx vitest run`, `npx tsc --noEmit`, `npm run lint`. Expected: clean.
- [ ] **Step 2:** In the browser, run the spec's Testing list end to end:
  - Create the invitational, enter a team, hit the required errors, review and submit.
  - As the member, look up and edit the entry.
  - As admin, edit a team and add a team; check the CSV and the print roster.
  - A dinner and a clinic register as before.
- [ ] **Step 3:** In the hand-off, remind Ian to run `supabase/migration-tournament.sql` in the HUB SQL Editor, and that SMTP env vars must be set for emails to send.
