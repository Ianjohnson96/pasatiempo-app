"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatSlot } from "@/lib/events/format";
import {
  centsToDollarInput,
  computeFinance,
  formatCents,
  parseDollarsToCents,
} from "@/lib/events/finance";
import {
  TENDERS,
  TENDER_LABEL,
  type EventFinance,
  type Instructor,
  type PrizePurchase,
} from "@/lib/events/finance-types";
import {
  addPrize,
  deletePrize,
  savePayment,
  saveFinanceSettings,
  saveInstructors,
  setPresence,
} from "@/lib/events/finance-actions";
import type { EventRec, Registration } from "@/lib/events/types";

// Admin-only clinic financials. Built phone-first — this gets used standing on
// the range with one hand, so every control stacks and nothing scrolls sideways.

type Run = (
  fn: () => Promise<{ ok: boolean; error?: string }>,
) => Promise<boolean>;
type Summary = ReturnType<typeof computeFinance>;

export default function FinancialsPanel({
  event,
  registrations,
  finance,
  prizes,
}: {
  event: EventRec;
  registrations: Registration[];
  finance: EventFinance;
  prizes: PrizePurchase[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  const summary = useMemo(
    () => computeFinance(event, registrations, finance, prizes),
    [event, registrations, finance, prizes],
  );

  // Every action returns {ok,error}; funnel them all through one handler so a
  // server-side refusal always surfaces instead of failing silently.
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    const res = await fn();
    if (!res.ok) {
      setError(res.error ?? "That didn't save.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="stack">
      {error && <div className="notice err">{error}</div>}

      <SummaryCard summary={summary} />
      <PaymentsCard
        event={event}
        registrations={registrations}
        finance={finance}
        summary={summary}
        run={run}
      />
      <PrizesCard event={event} prizes={prizes} summary={summary} run={run} />
      <ClinicHelpCard
        event={event}
        finance={finance}
        summary={summary}
        run={run}
      />
      <PayoutsCard summary={summary} />
      <SettingsCard event={event} finance={finance} run={run} />
    </div>
  );
}

// ---- 1. Summary -----------------------------------------------------------

function SummaryCard({ summary: s }: { summary: Summary }) {
  return (
    <div className="card">
      <div className="section-title">Where the money stands</div>
      <div className="fin-stats">
        <Stat label="Collected" value={formatCents(s.grossCents)} strong />
        <Stat
          label={`Outstanding (${s.unpaidCount})`}
          value={formatCents(s.outstandingCents)}
          warn={s.outstandingCents > 0}
        />
        <Stat label="Prizes" value={formatCents(s.prizeTotalCents)} />
        <Stat label="Organizer cut" value={formatCents(s.organizerCutCents)} />
        <Stat
          label="Net pot"
          value={formatCents(s.netPotCents)}
          strong
          warn={s.netPotCents < 0}
        />
        <Stat
          label={`Per clinic (÷ ${s.dateCount})`}
          value={formatCents(s.perClinicCents)}
        />
      </div>
      <p className="hint" style={{ marginBottom: 0 }}>
        {s.paidCount} of {s.signedUpCount} signed up have paid. Prizes and the
        organizer cut come off the top before the pot is split.
        {s.netPotCents < 0 &&
          " The pot is negative — prize spend has passed what's been collected."}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
  warn,
}: {
  label: string;
  value: string;
  strong?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`fin-stat${strong ? " strong" : ""}`}>
      <div className="n" style={warn ? { color: "var(--danger)" } : undefined}>
        {value}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}

// ---- 2. Payments ----------------------------------------------------------

function PaymentsCard({
  event,
  registrations,
  finance,
  summary,
  run,
}: {
  event: EventRec;
  registrations: Registration[];
  finance: EventFinance;
  summary: Summary;
  run: Run;
}) {
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  // Cancelled sign-ups are out of the money, so they're out of this list too.
  const active = registrations.filter((r) => r.status !== "cancelled");
  const shown = unpaidOnly ? active.filter((r) => !r.paid) : active;
  const cancelled = registrations.length - active.length;

  return (
    <div className="card">
      <div className="fin-cardhead">
        <div className="section-title" style={{ margin: 0 }}>
          Payments
        </div>
        <label className="check fin-filter">
          <input
            type="checkbox"
            checked={unpaidOnly}
            onChange={(e) => setUnpaidOnly(e.target.checked)}
          />
          <span>Unpaid only</span>
        </label>
      </div>
      <p className="hint">
        {summary.paidCount} paid · {summary.unpaidCount} outstanding
        {cancelled > 0 && ` · ${cancelled} cancelled (excluded)`}
      </p>

      {shown.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          {unpaidOnly ? "Everyone has paid." : "Nobody has signed up yet."}
        </p>
      ) : (
        shown.map((r) => (
          <PaymentRow
            key={r.id}
            eventId={event.id}
            reg={r}
            defaultFeeCents={finance.feeCents}
            run={run}
          />
        ))
      )}
    </div>
  );
}

function PaymentRow({
  eventId,
  reg,
  defaultFeeCents,
  run,
}: {
  eventId: string;
  reg: Registration;
  defaultFeeCents: number;
  run: Run;
}) {
  const [paid, setPaid] = useState(reg.paid);
  const [fee, setFee] = useState(
    centsToDollarInput(reg.feeCents ?? defaultFeeCents),
  );
  const [tender, setTender] = useState<string>(reg.tender ?? "");
  const [paidOn, setPaidOn] = useState(reg.paidOn ?? "");
  const [note, setNote] = useState(reg.paymentNote);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function save() {
    setSaving(true);
    const ok = await run(() =>
      savePayment({
        eventId,
        regId: reg.id,
        paid,
        // Stored explicitly rather than leaning on the event default: what
        // someone actually paid shouldn't change later because the fee was edited.
        feeCents: parseDollarsToCents(fee),
        tender: tender || null,
        paidOn: paidOn || null,
        paymentNote: note,
      }),
    );
    setSaving(false);
    if (ok) setDirty(false);
  }

  return (
    <div className={`fin-pay${paid ? " on" : ""}`}>
      <div className="fp-top">
        <label className="check fp-paid">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => {
              setPaid(e.target.checked);
              setDirty(true);
            }}
          />
          <span className="fp-name">{reg.name}</span>
        </label>
        {reg.status === "waitlist" && <span className="pill sm">waitlist</span>}
      </div>
      <div className="fp-contact">{reg.email}</div>

      <div className="fp-grid">
        <div className="field">
          <label>Amount</label>
          <input
            inputMode="decimal"
            value={fee}
            onChange={(e) => {
              setFee(e.target.value);
              setDirty(true);
            }}
          />
        </div>
        <div className="field">
          <label>Paid with</label>
          <select
            value={tender}
            onChange={(e) => {
              setTender(e.target.value);
              setDirty(true);
            }}
          >
            <option value="">—</option>
            {TENDERS.map((t) => (
              <option key={t} value={t}>
                {TENDER_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={paidOn}
            onChange={(e) => {
              setPaidOn(e.target.value);
              setDirty(true);
            }}
          />
        </div>
        <div className="field">
          <label>Note</label>
          <input
            value={note}
            placeholder="optional"
            onChange={(e) => {
              setNote(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      </div>

      {dirty && (
        <button className="btn small" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </button>
      )}
    </div>
  );
}

// ---- 3. Prizes ------------------------------------------------------------

function PrizesCard({
  event,
  prizes,
  summary,
  run,
}: {
  event: EventRec;
  prizes: PrizePurchase[];
  summary: Summary;
  run: Run;
}) {
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const cents = parseDollarsToCents(amount);
    if (cents == null) return;
    setBusy(true);
    const ok = await run(() =>
      addPrize({
        eventId: event.id,
        purchasedOn: date || null,
        description: desc,
        amountCents: cents,
      }),
    );
    setBusy(false);
    if (ok) {
      setDate("");
      setDesc("");
      setAmount("");
    }
  }

  return (
    <div className="card">
      <div className="section-title">Prizes bought from the pot</div>

      {prizes.length === 0 ? (
        <p className="muted">Nothing bought yet.</p>
      ) : (
        <div className="fin-lines">
          {prizes.map((p) => (
            <div className="fin-line" key={p.id}>
              <div className="fl-main">
                <div className="fl-desc">{p.description}</div>
                {p.purchasedOn && (
                  <div className="fl-date">{p.purchasedOn}</div>
                )}
              </div>
              <div className="fl-amt">{formatCents(p.amountCents)}</div>
              <button
                className="btn ghost small"
                aria-label={`Remove ${p.description}`}
                onClick={() => run(() => deletePrize(event.id, p.id))}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="fin-line total">
            <div className="fl-main">
              <strong>Total prize spend</strong>
            </div>
            <div className="fl-amt">
              <strong>{formatCents(summary.prizeTotalCents)}</strong>
            </div>
            <span className="fl-spacer" />
          </div>
        </div>
      )}

      <div className="divider" />
      <div className="fp-grid">
        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>What was it</label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. gift cards"
          />
        </div>
        <div className="field">
          <label>Amount</label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>
      <button
        className="btn secondary small"
        disabled={busy || !desc.trim() || parseDollarsToCents(amount) == null}
        onClick={add}
      >
        {busy ? "Adding…" : "Add purchase"}
      </button>
    </div>
  );
}

// ---- 4. Clinic help (who worked which date) -------------------------------

function ClinicHelpCard({
  event,
  finance,
  summary,
  run,
}: {
  event: EventRec;
  finance: EventFinance;
  summary: Summary;
  run: Run;
}) {
  const [names, setNames] = useState<Instructor[]>(finance.instructors);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveNames() {
    setBusy(true);
    const ok = await run(() => saveInstructors(event.id, names));
    setBusy(false);
    if (ok) setEditing(false);
  }

  return (
    <div className="card">
      <div className="fin-cardhead">
        <div className="section-title" style={{ margin: 0 }}>
          Who worked which clinic
        </div>
        <button
          className="btn ghost small"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Done" : "Edit helpers"}
        </button>
      </div>

      {editing ? (
        <>
          {names.map((i, idx) => (
            <div className="builder-row" key={i.id}>
              <input
                value={i.name}
                onChange={(e) => {
                  const next = [...names];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setNames(next);
                }}
              />
              <button
                className="btn ghost small"
                onClick={() => setNames(names.filter((n) => n.id !== i.id))}
              >
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn secondary small"
              onClick={() =>
                setNames([...names, { id: crypto.randomUUID(), name: "" }])
              }
            >
              + Add helper
            </button>
            <button className="btn small" disabled={busy} onClick={saveNames}>
              {busy ? "Saving…" : "Save helpers"}
            </button>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            Removing a helper also drops them from every date they were marked on.
          </p>
        </>
      ) : event.slots.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          This event has no dates, so there is nothing to split. Add clinic dates
          in the event editor first.
        </p>
      ) : (
        <div className="fin-dates">
          {event.slots.map((s) => {
            const row = summary.dates.find((d) => d.slotId === s.id);
            const present = new Set(row?.present.map((p) => p.id) ?? []);
            return (
              <div className="fin-date" key={s.id}>
                <div className="fd-head">
                  <div className="fd-when">{formatSlot(s)}</div>
                  <div className="fd-share">
                    {present.size > 0
                      ? `${formatCents(row?.perPersonCents ?? 0)} each`
                      : "nobody marked"}
                  </div>
                </div>
                <div className="fd-chips">
                  {finance.instructors.map((i) => {
                    const on = present.has(i.id);
                    return (
                      <button
                        key={i.id}
                        className={`fd-chip${on ? " on" : ""}`}
                        aria-pressed={on}
                        onClick={() =>
                          run(() => setPresence(event.id, s.id, i.id, !on))
                        }
                      >
                        {i.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- 5. Payouts -----------------------------------------------------------

function PayoutsCard({ summary: s }: { summary: Summary }) {
  return (
    <div className="card">
      <div className="section-title">What each pro is owed</div>

      {s.payouts.length === 0 ? (
        <p className="muted">No helpers on the list yet.</p>
      ) : (
        <div className="fin-lines">
          {s.payouts.map((p) => (
            <div className="fin-line" key={p.instructor.id}>
              <div className="fl-main">
                <div className="fl-desc">
                  {p.instructor.name}
                  {p.isOrganizer && (
                    <span className="pill sm" style={{ marginLeft: 8 }}>
                      organizer
                    </span>
                  )}
                </div>
                <div className="fl-date">
                  {p.datesWorked} of {s.dateCount} clinics
                  {p.organizerCutCents !== 0 &&
                    ` · ${formatCents(p.sharesCents)} shares + ${formatCents(
                      p.organizerCutCents,
                    )} cut`}
                </div>
              </div>
              <div className="fl-amt">
                <strong>{formatCents(p.owedCents)}</strong>
              </div>
              <span className="fl-spacer" />
            </div>
          ))}

          {s.remainderCents !== 0 && (
            <div className="fin-line">
              <div className="fl-main">
                <div className="fl-desc">Unallocated</div>
                <div className="fl-date">
                  Rounding, plus the share of any date with nobody marked.
                </div>
              </div>
              <div className="fl-amt">{formatCents(s.remainderCents)}</div>
              <span className="fl-spacer" />
            </div>
          )}
        </div>
      )}

      <p className="hint" style={{ marginBottom: 0 }}>
        Shares plus unallocated always add back to the net pot of{" "}
        {formatCents(s.netPotCents)}. Each clinic&apos;s share is divided among
        everyone marked present for that date.
      </p>
    </div>
  );
}

// ---- 6. Settings ----------------------------------------------------------

function SettingsCard({
  event,
  finance,
  run,
}: {
  event: EventRec;
  finance: EventFinance;
  run: Run;
}) {
  const [fee, setFee] = useState(centsToDollarInput(finance.feeCents));
  const [cut, setCut] = useState(centsToDollarInput(finance.organizerCutCents));
  const [who, setWho] = useState(finance.organizerName);
  const [busy, setBusy] = useState(false);

  async function save() {
    const feeCents = parseDollarsToCents(fee);
    const cutCents = parseDollarsToCents(cut);
    if (feeCents == null || cutCents == null) return;
    setBusy(true);
    await run(() =>
      saveFinanceSettings({
        eventId: event.id,
        feeCents,
        organizerName: who,
        organizerCutCents: cutCents,
      }),
    );
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="section-title">Settings</div>
      <div className="fp-grid">
        <div className="field">
          <label>Fee per person</label>
          <input
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
          <div className="hint">
            The default. Anyone can be given a different amount on their row.
          </div>
        </div>
        <div className="field">
          <label>Organizer cut</label>
          <input
            inputMode="decimal"
            value={cut}
            onChange={(e) => setCut(e.target.value)}
          />
          <div className="hint">Taken off the top, before the split.</div>
        </div>
        <div className="field">
          <label>Cut goes to</label>
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">— nobody —</option>
            {finance.instructors.map((i) => (
              <option key={i.id} value={i.name}>
                {i.name}
              </option>
            ))}
          </select>
          <div className="hint">
            They still earn their per-clinic shares on top of it.
          </div>
        </div>
      </div>
      <button className="btn" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
