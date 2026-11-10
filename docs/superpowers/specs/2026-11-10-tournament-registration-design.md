# Event Planner: Tournament team registration + visual refresh

Date: 2026-11-10 · Owner: Ian Johnson

## Why

Ian is opening sign-ups for the club invitational in June. The Event Planner
(`/admin/events`, public form at `/events/e/<slug>`) only knows dinners, clinics
and general events. A guest there is just a name, so it can't collect what a
golf tournament needs. The planner also looks plain, and there is no way back to
Club Hub (`/admin`) from inside it.

## What this is (and isn't)

- **It is a registration page only.** The tournament's information site (the
  MHI page, El Sombrero, the invitational site) stays separate and is not touched.
- **Who uses it:** a member is already signed in to the password-protected
  members website. They click a link to this page and enter their **team: one
  member plus one guest**. The member fills in both players. The guest never
  visits the page.
- **Success:** Ian builds the June invitational entry form himself in the
  planner, adding his own questions, and gets a clean roster and export with
  every player's email, GHIN, dietary needs and prize sizes.

### Goals
1. A new **Tournament** event type with a two-player team entry form (Member,
   Guest).
2. Built-in fields for each player: **name, email (required), GHIN (required)**.
3. A question builder where Ian adds his own questions, picks the answer type,
   marks a question **Required**, and chooses whether it is asked **of each
   player** or **once per team**.
4. Team-based capacity and waitlist ("36 teams").
5. A roster grouped by team, plus a **CSV export with one row per player**.
6. A **"← Club Hub"** link on every planner screen.
7. A visual refresh of the event list, the editor, the sign-up form and the
   roster.

### Non-goals
- Pairings, flights, scoring or tee sheets (Golf Genius handles those).
- Looking up handicap indexes from GHIN (needs USGA API approval). The form
  stores the number only.
- Online payment, and any entry-fee work. Ian: "dont worry about entry fee."
  The Financials panel is left exactly as is; no tournament-specific changes.
- Checking membership. The members website's password is the gate; the
  existing invite-only allowlist stays available but is off by default.
- Teams of other sizes (foursomes, solo entries). The design shouldn't block
  them later, but only the two-player Member + Guest team is built now.
- Changes to the MHI, El Sombrero or invitational info sites or their tables.

### Anti-goals (a failure even if it "works")
- A member can submit a team with a required answer missing for either player.
- Guest details end up mashed into one text answer, so the export can't list
  players separately.
- Dinners, clinics and existing registrations break or change behaviour.
- Guest or member emails, GHINs and other answers leak onto the public page.

## Constraints (from the code today)

- Data lives in Supabase, `events` schema: tables `events.events` and
  `events.registrations`. JSON columns (`custom_fields`, `answers`,
  `guest_names`, `slots`) store camelCase shapes as-is (`lib/events/map.ts`).
- Migrations are hand-run SQL files in `supabase/` (pattern:
  `migration-roster-limit.sql`, "run once in the HUB Supabase SQL Editor").
- `EventType = "dinner" | "clinic" | "general"` (`lib/events/types.ts`). The
  builder must check whether `events.events.type` has a DB check constraint. If
  it does, the migration widens it.
- Registration logic is in `register()` (`lib/events/actions.ts:396`): it checks
  invite-only and the roster cap, then decides confirmed or waitlist from
  `availability()` (`lib/events/data.ts`), which counts seats by `party_size`.
- Self-service lookup, edit and cancel by email already exist
  (`lookupMyRegistrations`, `updateMyRegistration`, `cancelMyRegistration`,
  `components/events/ManageRegistration.tsx`).
- The public page gets a stripped event (`publicEvent()` in `map.ts`); the
  roster on the public page is controlled by `showRoster` and `rosterStyle`.
- Tests use Vitest (`npm test`); `lib/events/finance.test.ts` shows the style.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Tournament is a new type inside the existing planner. Choosing it switches the form to a team layout. The question builder gains "each player / once per team", Required, and two new answer types. | Reuses links, capacity, waitlist, Financials, co-managers and self-service. Smallest build. The registration row stays one per team, so team-level reporting is natural. |
| B | A separate tournament tool with its own team and player tables. | Cleaner for pairings or scoring later, but rebuilds everything the planner already does. Pairings and scoring are out of scope (Golf Genius). |
| C | No build: use today's custom questions twice ("Guest GHIN"…). | Works immediately, but every guest question is made by hand, there is no per-player roster or export, and guest required-ness is clumsy. |

Ian picked **A**.

## Design

### Data model

**`EventType`** adds `"tournament"`.

**`CustomField`** gains:
- `scope: "player" | "team"`. Default `"team"`; existing fields read as
  `"team"`, so dinners and clinics are unchanged.
- New `FieldType` values: `"radio"` (multiple choice, pick one, shown as
  buttons) and `"multi"` (checkboxes, pick several). Existing types stay:
  short_text, long_text, select (dropdown), checkbox (yes/no), number.
- `required` already exists. Enforce it **server-side** in `register()` and in
  the self-service update, not only in the browser. Today it is client-only.
  *My call (builder check):* the server enforces Required on **new**
  registrations for every event type, and on self-service **edits only for
  tournaments** (which have no existing entries). That way a dinner or clinic
  attendee who signed up before a required question was added isn't locked
  out of editing their sign-up. Admin (staff) edits and staff-entered teams
  skip Required, like staff edits skip capacity today.
- `"multi"` answers are stored as a JSON array of strings. Every other type
  stays a string.

**Players on a registration.** Add a nullable `players jsonb` column to
`events.registrations`:

```ts
interface Player {
  role: "member" | "guest";
  name: string;
  email: string;   // required, lower-cased
  ghin: string;    // required, digits only
  answers: Record<string, string | string[]>; // player-scoped CustomField.id → value
}
```

For a tournament registration:
- `name`, `email` and `phone` (top-level) = the member. This keeps lookup,
  edit and cancel by email working unchanged.
- `players` = `[member, guest]`, always 2, both complete.
- `party_size` = 2; `guest_names` = `[guest.name]` for compatibility.
- `answers` = team-scoped answers (for example "Team name").

For other event types, `players` stays null.

**Event-level settings for tournaments** (new columns on `events.events`):
- `team_labels jsonb` default `["Member","Guest"]`. Editable labels for the two
  player cards (e.g. "Member" / "Guest"). *Builder's call: hard-code these
  instead if that keeps things simpler; Ian didn't ask for editable labels.*

Capacity for a tournament is **in teams**. The editor shows "Max teams"; the
stored `capacity` is the number of teams. `availability()` and `takenSeats()`
count **registrations** (not `party_size`) for a tournament, and the waitlist
works per team. The roster cap (`rosterLimit`) is hidden for tournaments.

### Sign-up form (public, `/events/e/<slug>`, `RegistrationForm.tsx`)

When `type === "tournament"`:
- The header shows the event photo or logo, title, date and location (as today,
  restyled).
- **Two player cards side by side**: Member and Guest, stacked on phones. Each
  card has name, email, GHIN, phone (member only, optional), then every
  player-scoped question.
- Team-scoped questions sit below the two cards.
- Every required field is marked; you can't submit until both players are
  complete. Errors show inline on the field, not only as a toast.
- GHIN accepts digits only (trimmed) and is required. *Builder's call on the
  length check: GHIN numbers are usually 7–8 digits, so a soft hint is fine and
  a hard limit isn't needed.*
- **A review step:** "Review your team" shows both players' answers, with
  "Edit" and "Submit entry" buttons.
- The confirmation screen restates the team and says a confirmation email has
  gone to both players.

### Duplicate entries (decided by Ian: block them)

On a new tournament entry, self-service edits and admin edits, a player
can't appear on more than one **active** (confirmed or waitlisted) team in
the same event. Players are matched by **email or GHIN**. This covers:
- a member entering twice;
- a member who is also a guest on another team;
- the same guest on two teams;
- the member and guest on one entry being the same person.

The member sees a plain message naming which player clashes (e.g. "That
guest is already entered on another team. Questions? Contact the golf
shop."). The message must not reveal whose team it is. Cancelled entries
don't count. The check runs server-side in `register()` and in the update
actions.

### Confirmation email (decided by Ian: member and guest)

Today no events code sends email, although the form says one will be sent;
`lib/mail.ts` (SMTP via nodemailer) exists but events don't use it. For
tournaments:
- After a successful entry, send one email to the **member** and one to the
  **guest**. Each shows the event title, date and location, both players'
  names, the recipient's own answers, and the team status (confirmed or
  waitlist). The guest's email says the entry was made by the member.
- Don't put the other player's email or GHIN in a player's email.
- *My call:* sending is best-effort. If SMTP isn't configured or a send
  fails, the registration still saves, the failure is logged, and the roster
  shows a small "email not sent" flag on that team. Admin-entered teams send
  the same emails (with a "don't send emails" checkbox in the admin form,
  default off).
- Re-sending on edits isn't required.
- Non-tournament events: out of scope, but their confirmation wording should
  stop promising an email ("You're registered" without the "a confirmation
  will be sent" line), because none is sent.
- No party-size picker or slot picker for tournaments (single date only;
  `scheduleMode` is forced to `"single"`).

Roughly:

```
The Invitational — Team Entry
June 2027 · Pasatiempo
───────────────────────────────────────────
┌ MEMBER ───────────┐  ┌ GUEST ────────────┐
│ Name   *          │  │ Name   *          │
│ Email  *          │  │ Email  *          │
│ GHIN # *          │  │ GHIN # *          │
│ Dietary *         │  │ Dietary *         │
│ Shirt size * (S M L XL XXL) │ Shirt size * │
└───────────────────┘  └───────────────────┘
Team questions
[ Review your team → ]
```

### Self-service edit (`ManageRegistration.tsx`)

The member looks up the entry by their email, as today, and can edit both
players and all answers with the same required rules, or cancel the team. The
guest's email doesn't unlock the entry. *Builder's call: matches today's
"identified by registrant email" model.*

### Editor (`EventEditor.tsx`)

- **Type picker as large tiles** (Tournament · Dinner / Social · Clinic /
  Lesson · General), each with an icon and a one-line description. Tournament
  hides schedule slots, roster cap, the party-size and guest settings, and
  "collect guest names" (the team layout replaces them).
- **Step layout:** the editor is split into sections (Details · Schedule ·
  Players & Questions · Pricing · Roster · Access · Publish), with a sticky step
  list on the left on desktop to jump between them. It stays **one page and one
  save**. The step list is navigation and scroll-spy, not a wizard. On phones
  the step list becomes a horizontal chip row at the top.
- **Question builder:**
  - Each question has a label, an answer-type picker shown as icon chips (Text ·
    Paragraph · Dropdown · Multiple choice · Checkboxes · Number · Yes/No), an
    options editor (one option per row with add and remove, instead of today's
    comma string) for dropdown, multiple choice and checkboxes, a **Required**
    switch, and (tournaments only) an **Each player / Once per team** switch.
  - Reorder with up and down buttons. *Builder's call: drag-and-drop is nice
    but not required; up/down arrows are fine and more dependable on touch.*
  - Built-in player fields (name, email, GHIN) are shown at the top of the
    tournament builder as locked rows, so Ian sees the whole form.
  - **"Add common question"** offers quick-add presets for tournaments: Dietary
    restrictions (text), Shirt size (multiple choice XS–XXXL), Hat/Glove size.
    *Builder's call on the preset list; it is a convenience only.*
- **Live preview:** on wide screens, a right-hand panel shows a read-only
  preview of the sign-up form as it is built, using the same form component in
  preview mode. On narrow screens a "Preview" button opens it.
  *Builder's call: if a live preview is costly, a "Preview form" button that
  opens the draft public page in a new tab is acceptable. Tell Ian if you cut
  it.*

### Events list (`app/admin/events/page.tsx`)

Each event row becomes a card:
- A coloured stripe and icon by type.
- A date block (month and day).
- Title and status pill.
- A **fill bar** ("28 of 36 teams", or "42 signed up" when unlimited), plus the
  waitlist count.
- The existing Copy link, View and Manage actions.

### Roster (`app/admin/events/[id]/roster/page.tsx`)

For tournaments:
- **Team cards** listing the member and guest with email, GHIN and every
  answer, plus status and paid flags as today.
- **Export CSV:** one row per player. Columns: Team #, Role, Name, Email,
  GHIN, Phone, then each player question, then each team question (repeated
  on both rows), Status, Registered at.
- **Full admin editing (decided by Ian).** For tournaments,
  `RegistrationEditor.tsx` / `updateRegistration()` get the same two-player
  layout and a `players`-aware server action, so staff can fix any player's
  name, email, GHIN or answers. Edits keep `name`/`email`/`guest_names`
  derived from `players`, so nothing drifts.
- **"+ Add team" on the roster** lets staff enter a team that was phoned
  in. It uses the same two-player form, skips Required and capacity (like
  staff edits today), and still runs the duplicate check.
- Status, paid and delete actions keep working at the team level.

Non-tournament rosters keep today's layout but pick up the visual refresh, and
get a CSV export too (one row per registration) if it's cheap.

### Navigation

`AppBar` (`components/events/AppBar.tsx`) in admin mode adds a **"← Club Hub"**
link to `/admin`, left of "All events". The brand link keeps going to
`/admin/events`.

### Visual system

Stay within the existing events stylesheet (`app/globals.css` tokens:
`--green-*`, `--ink`, `--line`, `--warn`) and its classes (`card`, `btn`,
`badge`, `seg`). Add classes; don't restyle the public dinner and clinic pages
beyond what shared components require. The hub's look (`app/hub.css`) is a
reference for spacing and type, not a dependency.

### Public-page safety

`publicEvent()` stays as is. The public roster for tournaments, if
`showRoster` is on, shows **names only** in the chosen style (never emails,
GHINs or answers), and `count_only` shows "N teams".

## Migration

Add `email_failed boolean default false` on `events.registrations` for the
"email not sent" flag.

New file `supabase/migration-tournament.sql` (hand-run, idempotent):
- `alter table events.registrations add column if not exists players jsonb;`
- `alter table events.events add column if not exists team_labels jsonb;`
  (if kept)
- Widen any `type` check constraint to include `'tournament'`.

Existing rows need no backfill.

## Testing

- Vitest unit tests for the pure parts: required-answer validation (team and
  player scope, multi answers), team-based availability and waitlist,
  CSV row building (one row per player), GHIN normalisation, duplicate
  detection (email or GHIN, ignoring cancelled entries), and building the
  confirmation email (neither email shows the other player's email or GHIN).
- In the browser: create a tournament event, register a team, hit the
  required-field errors, review, submit, look the entry up and edit it as the
  member, check the roster and CSV, and confirm a dinner and a clinic event
  still register exactly as before.

## Left to the builder

- Component structure and file split (e.g. a `TeamEntryForm` component and a
  shared `QuestionInput`).
- Exact styling within the existing tokens.
- Whether the live preview is inline or a new tab (see above).
- Whether `team_labels` is editable or hard-coded.
- The quick-add preset list.
