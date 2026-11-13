"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  deleteLesson,
  moveLessonToPackage,
  packFromTitle,
  setLessonHappened,
  setLessonPayment,
} from "@/lib/lessons/actions";
import { courseDay, parseDollars } from "@/lib/lessons/calc";
import { METHOD_LABEL } from "@/lib/lessons/income";
import {
  formatDay,
  money,
  packageOptionLabel,
  type LedgerCandidate,
  type LedgerData,
  type LedgerRow,
  type PackageOption,
  type PayMethod,
} from "@/lib/lessons/types";

// Every lesson in date order, newest first, one at a time.
//
// The Billing screen bills a whole client in one go, which is the right shape
// for catching up on Max Miceli's five. This is the other shape: walk the
// days and answer each lesson on its own terms - its own amount, its own
// method, its own date - and, when the money came by Venmo, the actual
// payment sitting beside it.
//
// Nothing here decides for Ian. It offers what the calendar title said and
// what the Venmo export looks like; he says yes or no.

type Filter = "todo" | "venmo" | "all";

const FILTER_LABEL: Record<Filter, string> = {
  todo: "Needs payment",
  venmo: "Venmo likely",
  all: "All",
};

const METHODS: PayMethod[] = ["venmo", "member_charge", "cash", "other"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Past, on no bill, and not written off: the work. */
function needsMoney(r: LedgerRow): boolean {
  return !r.pack && r.status !== "cancelled" && r.startsAt.slice(0, 10) <= today();
}

/** "Fri 6 Nov 2026" - the heading a day's lessons sit under. */
function dayHeading(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function clockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function LessonLedger({
  data,
  packages,
}: {
  data: LedgerData;
  /** Every package (not single) in the book, for "put it on a package". */
  packages: PackageOption[];
}) {
  // A client's packages, the ones with room first, then newest.
  const pkgsOf = useMemo(() => {
    const m = new Map<string, PackageOption[]>();
    for (const p of packages) {
      const list = m.get(p.clientId) ?? [];
      list.push(p);
      m.set(p.clientId, list);
    }
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          Number(b.size - b.used > 0) - Number(a.size - a.used > 0) ||
          (b.firstLessonAt ?? b.soldOn ?? "").localeCompare(a.firstLessonAt ?? a.soldOn ?? ""),
      );
    }
    return m;
  }, [packages]);
  const [filter, setFilter] = useState<Filter>("todo");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // Rows settled this visit, so the list shrinks as he works. Without it a
  // reload throws him back to the top of 311 lessons after every save.
  const [settled, setSettled] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const all = data.rows.filter((r) => !settled.has(r.id));
    if (filter === "all") return all;
    if (filter === "venmo") return all.filter((r) => r.candidates.length > 0);
    return all.filter(needsMoney);
  }, [data.rows, filter, settled]);

  const left = Math.max(0, data.unbilledCount - settled.size);

  const byDay = useMemo(() => {
    const groups: { day: string; rows: LedgerRow[] }[] = [];
    for (const r of rows) {
      const key = dayHeading(r.startsAt);
      const last = groups[groups.length - 1];
      if (last && last.day === key) last.rows.push(r);
      else groups.push({ day: key, rows: [r] });
    }
    return groups;
  }, [rows]);

  return (
    <>
      <div className="lb-led-count">
        <strong>{left}</strong>
        <span>lesson{left === 1 ? "" : "s"} with no money on them</span>
        <span className="lb-led-of">{data.rows.length} in all</span>
      </div>

      <div className="lb-chips" role="group" aria-label="Which lessons to show">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={f === filter ? "btn small" : "btn secondary small"}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {note && <p className={note.ok ? "notice ok" : "notice err"}>{note.text}</p>}

      {rows.length === 0 ? (
        <p className="empty">
          {filter === "todo" ? "Every lesson has money against it." : "Nothing here."}
        </p>
      ) : (
        <div className="stack">
          {byDay.map((g) => (
            <div key={g.day}>
              <h3 className="lb-led-day">{g.day}</h3>
              {g.rows.map((r) => (
                <LessonRow
                  key={r.id}
                  row={r}
                  pkgs={(r.clientId && pkgsOf.get(r.clientId)) || []}
                  loose={data.loose}
                  open={open === r.id}
                  onOpen={() => setOpen(open === r.id ? null : r.id)}
                  onDone={(text) => {
                    setSettled((s) => new Set([...s, r.id]));
                    setOpen(null);
                    setNote({ ok: true, text });
                  }}
                  onError={(text) => setNote({ ok: false, text })}
                  onNote={(text) => setNote({ ok: true, text })}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function LessonRow({
  row,
  pkgs,
  loose,
  open,
  onOpen,
  onDone,
  onError,
  onNote,
}: {
  row: LedgerRow;
  /** This client's packages, ones with room first. */
  pkgs: PackageOption[];
  loose: LedgerCandidate[];
  open: boolean;
  onOpen: () => void;
  onDone: (text: string) => void;
  onError: (text: string) => void;
  /** A change that keeps the row on screen (it refreshes in place). */
  onNote: (text: string) => void;
}) {
  const [busy, start] = useTransition();
  const [adjusting, setAdjusting] = useState(false);
  const settled = !!row.pack;
  // On nothing, or billed as its own unpaid single, while the client has a
  // package with room: most likely the next lesson of that series.
  const room = pkgs.find((p) => p.size - p.used > 0) ?? null;
  const loneBill =
    !row.pack || (row.pack.kind === "single" && row.pack.paymentStatus !== "paid");
  const offerPack =
    room && loneBill && row.status !== "cancelled" && !(row.hintSize && row.hintSize > 1)
      ? room
      : null;

  function move(target: { packageId: string } | { newSize: number }, label: string) {
    start(async () => {
      const r = await moveLessonToPackage(row.id, target);
      if (!r.ok) onError(r.error);
      else onDone(`${row.clientName}: ${clockTime(row.startsAt)} put on ${label}.`);
    });
  }

  return (
    <div className="card lb-led-row">
      <div className="lb-head">
        <div>
          <Link
            href={row.clientId ? `/lessons/clients/${row.clientId}` : "/lessons/clients"}
            className="lb-name"
          >
            {row.clientName}
          </Link>
          {row.isMember && (
            <span className="badge gray" style={{ marginLeft: 8 }}>
              Member
            </span>
          )}
          <div className="lb-sub">
            {clockTime(row.startsAt)}
            {row.status === "cancelled" && " · didn't happen"}
            {row.status === "no_show" && " · no-show"}
            {row.hint && ` · ${row.hint}`}
          </div>
          {row.titleRaw && <div className="lb-led-title">{row.titleRaw}</div>}
        </div>
        <div>
          {settled ? (
            <>
              <PackSummary row={row} />
              {/* A package was bought once and is priced on its own card;
                  only a lesson billed on its own can be edited from here. */}
              {row.pack?.kind === "single" && (
                <button
                  type="button"
                  className="btn secondary small"
                  style={{ marginTop: 6 }}
                  onClick={onOpen}
                  aria-expanded={open}
                >
                  {open ? "Close" : "Edit"}
                </button>
              )}
            </>
          ) : row.status === "cancelled" || row.status === "no_show" ? (
            <RestoreButton row={row} onDone={onDone} onError={onError} />
          ) : (
            <button
              type="button"
              className="btn small"
              onClick={onOpen}
              aria-expanded={open}
            >
              {open ? "Close" : "Set payment"}
            </button>
          )}
          <button
            type="button"
            className="btn ghost small"
            style={{ marginTop: 6, display: "block", marginLeft: "auto" }}
            onClick={() => setAdjusting((v) => !v)}
            aria-expanded={adjusting}
          >
            {adjusting ? "Done" : "Adjust"}
          </button>
        </div>
      </div>

      {offerPack && (
        <div className="lb-led-offer">
          <span>
            {row.pack ? "Billed on its own, but " : ""}
            {row.clientName} has a {offerPack.size}-pack with{" "}
            {offerPack.size - offerPack.used} left. Put it on that?
          </span>
          <button
            type="button"
            className="btn small"
            disabled={busy}
            onClick={() => move({ packageId: offerPack.id }, `their ${offerPack.size}-pack`)}
          >
            Yes
          </button>
        </div>
      )}

      {adjusting && (
        <AdjustPanel
          row={row}
          pkgs={pkgs}
          busy={busy}
          onMove={move}
          onDone={onDone}
          onError={onError}
          onNote={onNote}
        />
      )}

      {row.duplicateOf && (
        <p className="notice warn" style={{ margin: "10px 0 0" }}>
          A second copy of this lesson is already in the book.{" "}
          <Link href="/lessons/review">Sort the duplicates &rarr;</Link>
        </p>
      )}

      {settled && row.pack?.kind === "package" && <PackBar row={row} />}

      {/* The title already said which package this is. Offer it. */}
      {!settled && row.status !== "cancelled" && row.hintSize !== null && row.hintSize > 1 && (
        <div className="lb-led-offer">
          <span>Your title says a {row.hintSize}-lesson package. Put it on one?</span>
          <button
            type="button"
            className="btn small"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const size = row.hintSize as number;
                const r = await packFromTitle(row.id, size);
                if (!r.ok) onError(r.error);
                else
                  onDone(
                    r.value.made
                      ? `${row.clientName}: started a ${size}-pack.`
                      : `${row.clientName}: added to the open ${size}-pack.`,
                  );
              })
            }
          >
            Yes
          </button>
        </div>
      )}

      {open && (!settled || row.pack?.kind === "single") && (
        <PayForm
          row={row}
          loose={loose}
          editing={settled}
          onDone={onDone}
          onError={onError}
          onCancel={onOpen}
        />
      )}
    </div>
  );
}

const HAPPENED: { status: "completed" | "cancelled" | "no_show"; label: string }[] = [
  { status: "completed", label: "Happened" },
  { status: "cancelled", label: "Didn’t happen" },
  { status: "no_show", label: "No-show" },
];

/**
 * Everything about a lesson that is not the money: whether it happened,
 * which package it belongs to, or that it was never a lesson at all. Each
 * saves on the tap - no trip to Outlook, no wait for the sync.
 */
function AdjustPanel({
  row,
  pkgs,
  busy,
  onMove,
  onDone,
  onError,
  onNote,
}: {
  row: LedgerRow;
  pkgs: PackageOption[];
  busy: boolean;
  onMove: (target: { packageId: string } | { newSize: number }, label: string) => void;
  onDone: (text: string) => void;
  onError: (text: string) => void;
  onNote: (text: string) => void;
}) {
  const [saving, start] = useTransition();
  const off = busy || saving;
  const current = row.status === "scheduled" ? "completed" : row.status;

  function happened(status: "completed" | "cancelled" | "no_show", label: string) {
    start(async () => {
      const r = await setLessonHappened(row.id, status);
      if (!r.ok) onError(r.error);
      // Didn't happen takes it off the to-do list; the others keep it there.
      else if (status === "cancelled") onDone(`${row.clientName}: didn’t happen.`);
      else onNote(`${row.clientName}: ${label.toLowerCase()}.`);
    });
  }

  return (
    <div className="lb-led-form lb-adjust">
      <div className="lb-led-lbl">Did it happen?</div>
      <div className="lb-chips">
        {HAPPENED.map((h) => (
          <button
            key={h.status}
            type="button"
            className={h.status === current ? "btn small" : "btn secondary small"}
            aria-pressed={h.status === current}
            disabled={off || h.status === current}
            onClick={() => happened(h.status, h.label)}
          >
            {h.label}
          </button>
        ))}
      </div>
      <p className="lb-fhint" style={{ margin: "4px 0 0" }}>
        Saved now, and the calendar sync keeps it. Didn&rsquo;t happen also
        drops an unpaid single, so it stops asking for payment.
      </p>

      {row.clientId && (
        <>
          <div className="lb-led-lbl" style={{ marginTop: 12 }}>
            Part of a package?
          </div>
          <div className="lb-pkpick">
            {pkgs.map((p) => {
              const on = row.pack?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`lb-led-cand${on ? " on" : ""}`}
                  aria-pressed={on}
                  disabled={off || on}
                  onClick={() => onMove({ packageId: p.id }, `the ${p.size}-pack`)}
                >
                  <span className="lb-led-cand-who">{packageOptionLabel(p)}</span>
                  {p.size - p.used <= 0 && <span className="lb-sub">full</span>}
                </button>
              );
            })}
          </div>
          <div className="lb-chips" style={{ marginTop: 6 }}>
            <span className="lb-sub" style={{ alignSelf: "center" }}>
              New:
            </span>
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                className="btn secondary small"
                disabled={off}
                onClick={() => onMove({ newSize: n }, `a new ${n}-pack`)}
              >
                {n}-pack
              </button>
            ))}
          </div>
        </>
      )}

      <DeleteRow row={row} onDone={onDone} onError={onError} />
    </div>
  );
}

/**
 * For a calendar entry that was never a lesson. Asks first, and tells the
 * sync to skip the event so it does not come back tomorrow.
 */
function DeleteRow({
  row,
  onDone,
  onError,
}: {
  row: LedgerRow;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();
  if (!asking) {
    return (
      <button
        type="button"
        className="lb-led-more"
        style={{ marginTop: 8 }}
        onClick={() => setAsking(true)}
      >
        Not a lesson? Delete
      </button>
    );
  }
  return (
    <div className="lb-qacts" style={{ marginTop: 8, flexWrap: "wrap" }}>
      <span className="lb-fhint" style={{ flexBasis: "100%", margin: 0 }}>
        Delete {row.clientName} &middot; {clockTime(row.startsAt)}? The calendar
        sync will not bring it back.
      </span>
      <button
        type="button"
        className="btn danger small"
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await deleteLesson(row.id, row.clientId);
            setAsking(false);
            if (!r.ok) onError(r.error);
            else onDone(`Deleted ${row.clientName} · ${clockTime(row.startsAt)}.`);
          })
        }
      >
        {busy ? "Deleting…" : "Yes, delete it"}
      </button>
      <button
        type="button"
        className="btn secondary small"
        disabled={busy}
        onClick={() => setAsking(false)}
      >
        Keep it
      </button>
    </div>
  );
}

/** A lesson written off can be put back; nothing here is one-way. */
function RestoreButton({
  row,
  onDone,
  onError,
}: {
  row: LedgerRow;
  onDone: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className="btn secondary small"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await setLessonHappened(row.id, "completed");
          if (!r.ok) onError(r.error);
          else onDone(`${row.clientName}: put back on the book.`);
        })
      }
    >
      {busy ? "…" : "It did happen"}
    </button>
  );
}

/** What a settled lesson shows instead of a form. */
function PackSummary({ row }: { row: LedgerRow }) {
  const p = row.pack;
  if (!p) return null;
  if (p.kind === "package") {
    return (
      <>
        <div className="lb-name">{p.size}-pack</div>
        <div className="lb-sub">
          {p.left} left · {p.paymentStatus}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="lb-name">{money(p.priceCents)}</div>
      <div className="lb-sub">
        {p.paymentMethod ? METHOD_LABEL[p.paymentMethod as PayMethod] : "no method"}
        {p.paymentStatus !== "paid" && ` · ${p.paymentStatus}`}
      </div>
    </>
  );
}

/**
 * How much of the package is gone.
 *
 * No amount per lesson on purpose: a package is bought once, so a figure
 * against one of its lessons would be counted again on the next.
 */
function PackBar({ row }: { row: LedgerRow }) {
  const p = row.pack;
  if (!p) return null;
  const pips = Array.from({ length: Math.min(p.size, 12) }, (_, i) => i < p.used);
  return (
    <div className="lb-led-pack">
      <div className="lb-led-pips" aria-hidden="true">
        {pips.map((on, i) => (
          <span key={i} className={on ? "on" : ""} />
        ))}
      </div>
      <div className="lb-sub">
        {p.used} of {p.size} used, {p.left} left
        {p.priceCents !== null && ` · pack ${money(p.priceCents)}`}
        {p.soldOn && ` · bought ${formatDay(p.soldOn)}`}
      </div>
    </div>
  );
}

function PayForm({
  row,
  loose,
  editing,
  onDone,
  onError,
  onCancel,
}: {
  row: LedgerRow;
  loose: LedgerCandidate[];
  /** Open on a lesson already billed: start from what it says, not a guess. */
  editing: boolean;
  onDone: (text: string) => void;
  onError: (text: string) => void;
  onCancel: () => void;
}) {
  const pack = editing ? row.pack : null;
  const best = row.candidates[0] ?? null;
  // Editing starts from what is recorded. Otherwise fill from the strongest
  // Venmo candidate, or what this client paid last time - either beats an
  // empty box.
  const [dollars, setDollars] = useState(
    pack?.priceCents != null
      ? String(pack.priceCents / 100)
      : best
        ? String(best.amountCents / 100)
        : row.lastPriceCents !== null
          ? String(row.lastPriceCents / 100)
          : "",
  );
  const [method, setMethod] = useState<PayMethod>(
    (pack?.paymentMethod as PayMethod | null) ??
      (best ? "venmo" : (row.lastMethod ?? (row.isMember ? "member_charge" : "cash"))),
  );
  // The lesson's own Pacific day - slicing its UTC instant puts an evening
  // lesson on tomorrow.
  const [paidOn, setPaidOn] = useState(
    (pack?.paidOn ?? best?.paidOn ?? courseDay(row.startsAt)).slice(0, 10),
  );
  const [paid, setPaid] = useState(pack ? pack.paymentStatus === "paid" : true);
  // An edit starts with no new tie: whatever paid it is already recorded, and
  // pre-picking a guess would tie a second payment to the same bill on save.
  const [tie, setTie] = useState<string | null>(editing ? null : (best?.id ?? null));
  // "Not yet" on a member charge already submitted keeps it pending, not unpaid.
  const notYet: "unpaid" | "pending" =
    pack?.paymentStatus === "pending" ? "pending" : "unpaid";
  const [showAll, setShowAll] = useState(false);
  const [busy, start] = useTransition();

  const offered = showAll ? loose.slice(0, 60) : row.candidates;

  function save() {
    const parsed = parseDollars(dollars);
    if (!parsed.ok || parsed.cents === null) {
      onError("Enter an amount.");
      return;
    }
    const cents = parsed.cents;
    start(async () => {
      const r = await setLessonPayment(row.id, {
        priceCents: cents,
        method: paid || notYet === "pending" ? method : null,
        status: paid ? "paid" : notYet,
        paidOn: paid ? paidOn : null,
        paymentId: paid && method === "venmo" ? tie : null,
      });
      if (!r.ok) onError(r.error);
      else if (!paid)
        onDone(
          `${row.clientName}: ${money(cents)}, ${notYet === "pending" ? "pending" : "not paid yet"}.`,
        );
      else
        onDone(
          `${row.clientName}: ${money(cents)} ${METHOD_LABEL[method].toLowerCase()}` +
            `, ${formatDay(paidOn)}.`,
        );
    });
  }

  return (
    <div className="lb-led-form">
      <div className="lb-led-fields">
        <label>
          <span className="lb-led-lbl">Amount</span>
          <input
            className="field"
            inputMode="decimal"
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
            placeholder="85"
            disabled={busy}
          />
        </label>
        {paid && (
          <label>
            <span className="lb-led-lbl">Paid on</span>
            <input
              className="field"
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              disabled={busy}
            />
          </label>
        )}
      </div>

      {/* A bill can be raised before the money lands, and an edit must be
          able to say so - otherwise "paid on" is a date for a payment that
          never happened. */}
      <div className="lb-led-lbl">Paid?</div>
      <div className="lb-chips">
        <button
          type="button"
          className={paid ? "btn small" : "btn secondary small"}
          aria-pressed={paid}
          disabled={busy}
          onClick={() => setPaid(true)}
        >
          Paid
        </button>
        <button
          type="button"
          className={!paid ? "btn small" : "btn secondary small"}
          aria-pressed={!paid}
          disabled={busy}
          onClick={() => setPaid(false)}
        >
          Not yet
        </button>
      </div>

      {paid && (
        <>
          <div className="lb-led-lbl">How</div>
          <div className="lb-chips">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                className={m === method ? "btn small" : "btn secondary small"}
                aria-pressed={m === method}
                disabled={busy}
                onClick={() => setMethod(m)}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </>
      )}

      {paid && method === "venmo" && (
        <div className="lb-led-cands">
          <div className="lb-led-lbl">
            {offered.length === 0
              ? "No Venmo payment looks like this one"
              : showAll
                ? "Every payment attached to nothing"
                : "Venmo payments that could be this one"}
          </div>
          {offered.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`lb-led-cand${c.id === tie ? " on" : ""}`}
              aria-pressed={c.id === tie}
              disabled={busy}
              onClick={() => {
                const picked = c.id === tie ? null : c.id;
                setTie(picked);
                if (picked) {
                  setDollars(String(c.amountCents / 100));
                  setPaidOn(c.paidOn.slice(0, 10));
                }
              }}
            >
              <span className="lb-led-cand-who">
                {c.payerName || "(no name)"} &middot; {money(c.amountCents)}
              </span>
              <span className="lb-sub">
                {formatDay(c.paidOn)}
                {c.why && ` · ${c.why}`}
                {c.note && ` · "${c.note}"`}
              </span>
            </button>
          ))}
          {!showAll && (
            <button
              type="button"
              className="lb-led-more"
              onClick={() => setShowAll(true)}
            >
              None of these &mdash; show all {loose.length} untied payments
            </button>
          )}
          {tie === null && offered.length > 0 && (
            <p className="lb-fhint" style={{ margin: "8px 0 0" }}>
              Saving with none picked records the amount but leaves the Venmo row
              unmatched.
            </p>
          )}
        </div>
      )}

      {row.lastPriceCents !== null && (
        <p className="lb-lastnote">
          Last time: {money(row.lastPriceCents)}
          {row.lastMethod && ` · ${METHOD_LABEL[row.lastMethod]}`}
        </p>
      )}

      <div className="lb-actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn small" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn secondary small"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <span style={{ flexGrow: 1 }} />
        <button
          type="button"
          className="btn danger small"
          disabled={busy}
          title="Marked, not deleted - tonight's sync will not put it back"
          onClick={() =>
            start(async () => {
              const r = await setLessonHappened(row.id, "cancelled");
              if (!r.ok) onError(r.error);
              else onDone(`${row.clientName}: marked as never happened.`);
            })
          }
        >
          Didn&rsquo;t happen
        </button>
      </div>
    </div>
  );
}
