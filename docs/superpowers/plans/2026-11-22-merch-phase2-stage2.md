# Merchandise phase 2, stage 2: Orders & receiving with the receiving log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the accounting team's Google Sheet receiving log (read-only), suggest which order each new row belongs to, and let a person confirm, so Orders & receiving shows what has arrived without hand entry.

**Architecture:** A server module reads the sheet with a Google service account (JWT signed with Node `crypto`, no new dependency) and writes the parsed rows to one merch document, `receivinglog/current`, through the existing `put_doc` RPC. It runs when someone opens Orders & receiving (at most every 2 minutes) and from the daily cron. Matching is pure page JS (`18-ops.js`) over the parsed rows, the orders and the people's decisions (`logmatch/{key}`); confirming writes an `invoicesIn` entry (`source: 'log'`) on the order, as Invoice in does today. No budget or stock figure changes.

**Tech Stack:** Next.js route handlers (TypeScript), Node `crypto` (RS256), Google Sheets API v4 (`spreadsheets.readonly`), plain page JS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-merch-phase2-design.md` (stage 2)

## Global Constraints

- **Read-only.** The app never writes to the sheet or any Google file; scope `https://www.googleapis.com/auth/spreadsheets.readonly` only.
- **A person confirms every match.** Nothing is checked off automatically. Rows with no candidate order go to "Not from an order" without a click (filing checks nothing off).
- **Jonas stays the record.** A confirmed arrival changes no budget, Left to buy or stock figure (`storeRoomValue` and README "Receiving" behaviour unchanged).
- Sheet id default `1L2H5NaP_6nV1FwyYE5ThjKv8GenbvdtFulW6gYsCkSs` (env `MERCH_LOG_SHEET_ID` overrides); credentials from env `GOOGLE_SERVICE_ACCOUNT_JSON` (the downloaded key file's JSON). Without it the page shows the setup steps and everything else works.
- Rows dated before the go-live date (`since`, set on the first successful read) are not imported; Credits rows in the same window are.
- Anyone who can enter orders (owner, staff) can confirm, re-pick, mark "Not an order", and undo.
- Copy: plain English; "Jonas" for the POS; the log is "the receiving log".

## Review Focus

- **The sheet changes shape** (a renamed tab, a new 2027 tab, a moved column, a blank or text price): tabs are found by header, unreadable rows are listed as problems, and the read never fails as a whole. → test in Task 1.
- **A row is edited or removed in the sheet after it was matched**: the match shows "changed in the log" for a person; nothing is silently dropped or double-counted. → test in Task 3.
- **Two people confirm the same row**: the order gets one entry for the row (keyed by `logKey`), never two. → test in Task 4.
- **No credentials / no access / Google down**: Orders & receiving shows one plain line saying what to fix; the rest of the page works; the cron logs and continues. → test in Task 2.
- **A hand Invoice in already exists for the same invoice #**: confirming the log row replaces it instead of adding a second entry. → test in Task 4.

---

### Task 1: Parse the receiving log (pure)

**Files:**
- Create: `lib/merch/receiving-log.ts`
- Create: `lib/merch/fixtures/receiving-log.json` (made-up rows in the real layout: two year tabs with the real headers incl. `ITEM DECRIPTION`, a Credits tab, carried-down dates, a `$1,891.62`-style price, a `CJ Paid W/ CC` invoice, an exact repeat, a blank-price row, a header-only 2027 tab)
- Test: `lib/merch/receiving-log.test.ts`

**Interfaces:**
- Produces:
  - `type LogRow = { key: string; tab: string; date: string /* YYYY-MM-DD */; desc: string; invoice: string; amount: number; credit: boolean; brand: string | null; special: boolean }`
  - `parseLog(tabs: { title: string; values: string[][] }[], opts: { since: string; words: Record<string, string[]> }): { rows: LogRow[]; problems: string[] }` — finds data tabs by header (`REC. DATE` or `DATE`; `ITEM DESCRIPTION`/`ITEM DECRIPTION`; `INVOICE #`; `PRICE`), the Credits tab by name (`/credit/i`); carries the date down; `M/D/YYYY` and `M/D/YY` dates; price text → number (credits negative); skips blank rows; a row with a description but no readable date or price goes to `problems` (`"<tab> row <n>: no price"`); keeps rows dated ≥ `since`.
  - `rowKey(tab: string, invoice: string, amount: number, desc: string, n: number): string` — sha1 (first 16 hex) of the tab, invoice, amount to the cent, the lower-cased description and the repeat counter `n`; row numbers are not used.
  - `brandOf(desc: string, words: Record<string, string[]>): string | null` — the vendor key whose word appears as a whole word (case-insensitive; `&` allowed inside, e.g. `h&b`); longest word wins.
  - `VENDOR_WORDS_DEFAULT: Record<string, string[]>` — `{footjoy: ['fj', 'footjoy'], 'holderness & bourne': ['h&b', 'holderness'], 'peter millar': ['peter millar'], 'ralph lauren': ['rlx', 'ralph lauren'], adidas: ['adidas'], taylormade: ['taylormade', 'taylor made'], imperial: ['imperial'], 'johnnie-o': ['johnnie-o', 'johnnie o'], sunice: ['sunice'], 'sun mountain': ['sun mountain'], garb: ['garb'], kastel: ['kastel']}`; vendor names from `vendors/*` add themselves as words on the page.
  - `special` = the description has a name in brackets (`/\([^)]+\)/`).

- [ ] **Step 1: Write the failing tests** in `lib/merch/receiving-log.test.ts`:

```ts
it("reads every year tab by its headers and the Credits tab", () => {
  const { rows } = parseLog(fx.tabs, { since: "2026-01-01", words: VENDOR_WORDS_DEFAULT });
  expect(new Set(rows.map(r => r.tab))).toEqual(new Set(["SHEET 4 1/1-12-31/2026", "Credits"]));
});
it("carries the date down and reads prices and credits", () => {
  const { rows } = parseLog(fx.tabs, { since: "2026-01-01", words: VENDOR_WORDS_DEFAULT });
  const r = rows.find(x => x.invoice === "211")!;
  expect(r.date).toBe("2026-01-02"); expect(r.amount).toBe(1891.62);
  expect(rows.find(x => x.credit)!.amount).toBeLessThan(0);
});
it("keeps only rows on or after since", () => {
  const { rows } = parseLog(fx.tabs, { since: "2026-11-01", words: VENDOR_WORDS_DEFAULT });
  expect(rows.every(r => r.date >= "2026-11-01")).toBe(true);
});
it("lists unreadable rows as problems and reads the rest", () => {
  const { rows, problems } = parseLog(fx.tabs, { since: "2026-01-01", words: VENDOR_WORDS_DEFAULT });
  expect(problems.some(p => /no price/.test(p))).toBe(true);
  expect(rows.length).toBeGreaterThan(5);
});
it("an exact repeat gets its own key; keys don't depend on row position", () => {
  const a = parseLog(fx.tabs, { since: "2026-01-01", words: VENDOR_WORDS_DEFAULT }).rows;
  expect(new Set(a.map(r => r.key)).size).toBe(a.length);
  const shifted = JSON.parse(JSON.stringify(fx.tabs)); shifted[0].values.splice(1, 0, ["", "", "", ""]);
  const b = parseLog(shifted, { since: "2026-01-01", words: VENDOR_WORDS_DEFAULT }).rows;
  expect(b.map(r => r.key)).toEqual(a.map(r => r.key));
});
it("finds the brand by its words", () => {
  expect(brandOf("Shirts/Sweaters FJ Mens Stock", VENDOR_WORDS_DEFAULT)).toBe("footjoy");
  expect(brandOf("T-Shirts/Backpack H&B Mens Stock", VENDOR_WORDS_DEFAULT)).toBe("holderness & bourne");
  expect(brandOf("Hats Melin Mens Stock", VENDOR_WORDS_DEFAULT)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run lib/merch/receiving-log.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `lib/merch/receiving-log.ts` and the fixture.
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: read the receiving log's layout"`

### Task 2: Read the sheet and store it (server)

**Files:**
- Create: `lib/merch/google.ts`, `lib/merch/receiving-log-server.ts`, `app/merch/api/receiving-log/route.ts`
- Modify: `app/api/cron/merch/route.ts` (call `refreshReceivingLog` first; a failure is logged and doesn't stop the reminder)
- Modify: `lib/merch/rules.ts` (`receivinglog` server-only: not writable through `/merch/api/db` by anyone; `logmatch` in `STAFF_WRITABLE` with a `docProblem` shape)
- Test: `lib/merch/google.test.ts`, `lib/merch/receiving-log-server.test.ts`, `lib/merch/rules.test.ts`

**Interfaces:**
- Produces (`google.ts`):
  - `googleConfigured(): boolean` (env `GOOGLE_SERVICE_ACCOUNT_JSON` parses and has `client_email`, `private_key`); `googleClientEmail(): string | null`.
  - `serviceToken(scope: string, fetchImpl = fetch): Promise<string>` — RS256 JWT (`iss` client_email, `scope`, `aud` `https://oauth2.googleapis.com/token`, `iat`, `exp` = iat + 3600) exchanged at the token URL; cached until 60 s before expiry.
  - `readSheetTabs(id: string, fetchImpl = fetch): Promise<{ title: string; values: string[][] }[]>` — `GET .../v4/spreadsheets/{id}?fields=sheets.properties.title`, then `values:batchGet` for every tab with `A1:E`; throws `GoogleError` with `status`.
- Produces (`receiving-log-server.ts`):
  - `refreshReceivingLog(opts?: { force?: boolean; fetchImpl?: typeof fetch; now?: Date; db?: LogStore }): Promise<{ ok: boolean; rows?: number; skipped?: "recent"; error?: string }>` — reads `receivinglog/current`; unless `force`, skips if its `at` is under 2 minutes old; reads the sheet; `parseLog` with `since` = stored `since` or today (Pacific) on the first read and words = `VENDOR_WORDS_DEFAULT` merged with `guidelines/current.vendorWords`; writes `receivinglog/current` = `{at, since, sheet, rows, problems, error: null}` via `put_doc` with `p_by: 'receiving-log'`. On failure keeps the previous rows, writes `error` and returns `{ok:false, error}`. Plain lines: `"The receiving log isn't connected yet. See the setup steps."` (no credentials), `"The app can't open the receiving log. Share it with <client_email> as Viewer."` (403/404), `"Google didn't answer; showing the log as of <time>."` (5xx/network). `LogStore` = `{get(path): Promise<data|null>; put(path, data): Promise<void>}` (the default uses the merch admin client).
- Route: `POST /merch/api/receiving-log` (owner or staff; viewers 403) → `refreshReceivingLog({force: owner && body.force === true})`.
- `docProblem('logmatch/<key>', d)`: `d.state ∈ {'matched','notorder'}`; `matched` needs `po` (string), `amount` (number), `date` (YYYY-MM-DD); `by` string.

- [ ] **Step 1: Write the failing tests** (`google.test.ts` with a real RSA key from `crypto.generateKeyPairSync` and a stubbed fetch: the assertion verifies with the public key, the scope is read-only, a second call reuses the cached token; `receiving-log-server.test.ts` with a stubbed `LogStore` and fetch: stores rows with `since` = today on the first read; skips under 2 minutes unless forced; a 403 keeps the previous rows and says `Share it with <email> as Viewer`; no credentials says `isn't connected`; `rules.test.ts`: nobody can write `receivinglog/current`, staff can write `logmatch/x`, the `logmatch` shape is checked).
- [ ] **Step 2: Run** `npx vitest run lib/merch/google.test.ts lib/merch/receiving-log-server.test.ts lib/merch/rules.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the modules, the route and the cron call.
- [ ] **Step 4: Run** the same and `npx tsc --noEmit -p .` — Expected: PASS, clean.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: read the receiving log with a service account, read-only"`

### Task 3: Suggest matches (pure page JS)

**Files:**
- Modify: `merchandise/app/src/18-ops.js`
- Test: `lib/merch/ops.test.ts`

**Interfaces:**
- Produces (`18-ops.js`):
  - `logCandidates(row, orders, vendorKeyOf): PO[]` — open orders whose `vendorKeyOf(po)` equals `row.brand`, delivery month within one month either side of the row's month, and open balance ≥ `row.amount × 0.98` (a credit: any such order with something received or arrived); ordered by month distance, then `|open − amount|`. `open` = `onOrder(po)`-style total less received, passed in as `po.__open` by the caller to keep this pure.
  - `logQueue(rows, orders, decisions, vendorKeyOf): { toMatch: {row, cands}[]; notOrder: {row, why: 'none' | 'marked'}[]; matched: {row, po}[]; changed: {key, po}[] }`.
  - `vendorKeyFor(vendorName, words): string | null` — the alias key whose key or words match the vendor's name.

- [ ] **Step 1: Write the failing tests** (in `lib/merch/ops.test.ts`): same brand and month and enough balance is suggested, nearest month first, a too-small or too-far order isn't; a row with no candidate goes to `notOrder` with `why: 'none'`; a matched row missing from the log goes to `changed`.
- [ ] **Step 2: Run** `npx vitest run lib/merch/ops.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: suggest which order a receiving log row belongs to"`

### Task 4: Confirm, re-pick, not an order, undo

**Files:**
- Modify: `merchandise/app/src/18-ops.js` (pure entry builders), `merchandise/app/src/77-receiving.js` (actions; hand Invoice in hidden for staff once the log is live), `merchandise/app/src/90-io.js` (load `receivinglog/current` and `logmatch/*` live; refresh the log when Orders & receiving opens)
- Test: `lib/merch/ops.test.ts`, `lib/merch/receiving-match.test.ts` (page harness)

**Interfaces:**
- Produces (`18-ops.js`):
  - `logEntry(row, po, by): InvoiceEntry` — `{date: row.date, amount: row.amount, invoice: row.invoice, note: row.desc, source: 'log', logKey: row.key, by, at: row.date + 'T00:00:00Z', rcvd: num(po.received)}` (`at` = the row's own date, so a row dated before a Clear stays cleared).
  - `withLogEntry(invoicesIn, entry)` — drops any entry with the same `logKey`, and any `source: 'hand'` entry with the same `invoice`, then appends. `withoutLogEntry(invoicesIn, logKey)`.
- Page actions (`77-receiving.js`): `confirmLogRow(key, poId)` writes `pos/{poId}` with `withLogEntry` and `logmatch/{key}` `{state:'matched', po, amount, date, by, at}`; `markNotOrder(key)`; `undoLogRow(key)` removes the entry and deletes `logmatch/{key}`. Hand **Invoice in** shows for staff only while `receivinglog/current` is absent or in error; the owner always sees it, labelled "Override".

- [ ] **Step 1: Write the failing tests:** confirming twice and over a hand entry with the same invoice leaves one `log` entry; a row dated before `invoicesClearedAt` stays cleared (`liveInvoices`); in the harness, confirm puts the order in the store room and takes the row off the match list, and undo puts both back.
- [ ] **Step 2: Run** `npx vitest run lib/merch/ops.test.ts lib/merch/receiving-match.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: confirm receiving log rows against orders"`

### Task 5: The Orders & receiving page

**Files:**
- Modify: `merchandise/app/src/05-nav.js` (`VIEWS.orders` = `[['receiving','Receiving'],['orders','Orders'],['vendors','Vendors']]`: the sidebar entry opens on Receiving)
- Modify: `merchandise/app/src/77-receiving.js` (`renderReceiving`), `06-verdict.js` (`receiving`: rows to match first), `30-home.js` (`sideBadges`: rows to match), `31-today.js` (`homeLines.arriving`: "N log rows to match")
- Modify: `merchandise/README.md` ("Receiving": the log, matching, setup)
- Test: `lib/merch/receiving-match.test.ts`, `lib/merch/nav.test.ts`

Layout of the Receiving view, top to bottom: a status line (`Receiving log read <time ago>` · problems count · or the error line with the setup steps); **Match from the log (n)** — each row: date, description, invoice, amount, the first candidate with **Confirm**, other candidates as **Pick**, **Not an order**; then the existing lists (arrived, not in Jonas; late; due this month; backlog by vendor), each order showing its trail `Placed → Arrived <date> (inv <#>, $<amt>) → In Jonas`; **Not from an order** collapsed, with the reason and Undo on marked rows; **Changed in the log** when any.

- [ ] **Step 1: Write the failing tests:** the sidebar entry opens on Receiving; with one matchable row Home's Arriving line and the Receiving verdict say "1 log row to match"; without the log the page shows the not-connected line and the existing lists.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run` — Expected: all pass.
- [ ] **Step 5: Commit** `git commit -m "Merchandise: Orders & receiving matches the receiving log"`

### Task 6: Browser check and setup guide

**Files:**
- Create: `docs/merch-receiving-log-setup.md` (the owner's steps: a Google Cloud project, the Sheets API on, a service account, a JSON key added to Vercel as `GOOGLE_SERVICE_ACCOUNT_JSON`, and `pasatiemposhop@gmail.com` sharing the sheet with the service account's email as **Viewer**; nothing is added to the sheet)

- [ ] **Step 1:** Serve the page with a stand-in `/merch/api/db` holding a copy of the live documents plus a `receivinglog/current` built by `parseLog` from a read-only read of the real sheet (rows since 2026-11-01) and two made-up spring orders that match rows. As owner, staff and viewer at 1400px and 390px: confirm, pick another, not an order, undo; no page errors; no horizontal scroll; viewer sees no action buttons.
- [ ] **Step 2: Run** `npx vitest run`, `cd merchandise/pipeline && python3 -m pytest -q`, `npx eslint lib/merch app/merch`, `npx tsc --noEmit -p .` — Expected: all pass.
- [ ] **Step 3: Commit and push.**
