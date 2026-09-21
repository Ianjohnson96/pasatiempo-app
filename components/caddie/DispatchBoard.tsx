"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelDay,
  duplicateDay,
  offerLoop,
  respondForCaddie,
  saveLoop,
  setLoopStatus,
  setOpenBoard,
  withdrawOffer,
} from "@/lib/caddie/actions";
import {
  LOOP_TYPES,
  RANKS,
  acceptedCount,
  pendingCount,
  rateFor,
  type CaddieRank,
  type CaddieRec,
  type CrewMember,
  type LoopStatus,
  type LoopType,
  type LoopWithCrew,
  type RateCard,
} from "@/lib/caddie/types";

// What the server hands down per loop. Mirrors the Candidate in
// lib/caddie/data.ts, which cannot be imported here — it pulls in the
// service_role client.
export interface BoardCandidate {
  caddie: CaddieRec;
  availability: "Available" | "Unavailable" | "Pending" | null;
  alreadyOffered: boolean;
  conflict: boolean;
  requested: boolean;
}

interface Props {
  day: string; // "yyyy-mm-dd"
  dayLabel: string;
  today: string;
  loops: LoopWithCrew[];
  caddies: CaddieRec[];
  candidatesByLoop: Record<string, BoardCandidate[]>;
  teeLabels: Record<string, string>; // loop id -> "7:42 AM"
  rates: RateCard;
  notifyReady: boolean;
}

const STATUS_BADGE: Record<LoopStatus, string> = {
  Unassigned: "badge draft",
  "Partially Assigned": "badge gray",
  Assigned: "badge open",
  Completed: "badge closed",
  Cancelled: "badge closed",
};

export default function DispatchBoard({
  day,
  dayLabel,
  today,
  loops,
  caddies,
  candidatesByLoop,
  teeLabels,
  rates,
  notifyReady,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openLoop, setOpenLoop] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const go = (d: string) => router.push(`/admin/caddie?day=${d}`);

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string,
  ) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setNote(okMsg ? { kind: "ok", text: okMsg } : null);
        router.refresh();
      } else {
        setNote({ kind: "err", text: res.error ?? "Something went wrong." });
      }
    });
  }

  const unassigned = loops.filter(
    (l) =>
      l.loop.status === "Unassigned" || l.loop.status === "Partially Assigned",
  ).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Caddie Dispatch</h1>
          <div className="sub">
            {dayLabel}
            {day === today && " · today"} · {loops.length}{" "}
            {loops.length === 1 ? "loop" : "loops"}
            {unassigned > 0 && ` · ${unassigned} still needing caddies`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="btn secondary small"
            onClick={() => go(shift(day, -1))}
          >
            ←
          </button>
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && go(e.target.value)}
            style={inputStyle}
          />
          <button
            className="btn secondary small"
            onClick={() => go(shift(day, 1))}
          >
            →
          </button>
          {day !== today && (
            <button className="btn ghost small" onClick={() => go(today)}>
              Today
            </button>
          )}
        </div>
      </div>

      <DayTools day={day} hasLoops={loops.length > 0} busy={pending} onNote={setNote} />

      {!notifyReady && (
        <p className="notice warn">
          Offers are recorded but nothing is sent yet — no email or SMS is wired
          up. Ring the caddie, then mark their answer here.
        </p>
      )}

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      <QuickAdd day={day} caddies={caddies} busy={pending} />

      {loops.length === 0 ? (
        <div className="empty" style={{ marginTop: 18 }}>
          No loops on this day yet. Add the first one above.
        </div>
      ) : (
        <div className="evlist" style={{ marginTop: 18 }}>
          {loops.map(({ loop, crew }) => {
            const accepted = acceptedCount(crew);
            const waiting = pendingCount(crew);
            const rate = rateFor(rates, loop.loopType);
            const isOpen = openLoop === loop.id;
            const needs = loop.caddiesRequired - accepted;

            return (
              <div key={loop.id} className="evrow" style={{ flexWrap: "wrap" }}>
                <div className="ev-main" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="ev-title">{teeLabels[loop.id]}</span>
                    <span className="ev-title" style={{ fontWeight: 400 }}>
                      {loop.playerName}
                    </span>
                    <span className={STATUS_BADGE[loop.status]}>
                      {loop.status}
                    </span>
                    {loop.openBoard && (
                      <span className="badge gray">job board</span>
                    )}
                  </div>
                  <div className="ev-meta">
                    <span>{loop.loopType}</span>
                    <span>
                      {accepted}/{loop.caddiesRequired} confirmed
                      {waiting > 0 && ` · ${waiting} waiting`}
                    </span>
                    {rate != null && (
                      <span>${(rate / 100).toFixed(0)} a caddie</span>
                    )}
                    {loop.requestedRank && (
                      <span>wants {loop.requestedRank}-rank</span>
                    )}
                    {loop.notes && <span>{loop.notes}</span>}
                  </div>

                  {crew.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginTop: 8,
                      }}
                    >
                      {crew.map((c) => (
                        <CrewChip
                          key={c.id}
                          member={c}
                          busy={pending}
                          onAccept={() =>
                            run(
                              () => respondForCaddie(c.id, true),
                              `${c.caddie.fullName} is on the loop.`,
                            )
                          }
                          onDecline={() => run(() => respondForCaddie(c.id, false))}
                          onWithdraw={() => run(() => withdrawOffer(c.id))}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="no-print"
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  {needs > 0 && loop.status !== "Cancelled" && (
                    <button
                      className="btn small"
                      onClick={() => setOpenLoop(isOpen ? null : loop.id)}
                    >
                      {isOpen ? "Close" : `Offer (${needs})`}
                    </button>
                  )}
                  <button
                    className="btn secondary small"
                    disabled={pending}
                    onClick={() =>
                      run(() => setOpenBoard(loop.id, !loop.openBoard))
                    }
                  >
                    {loop.openBoard ? "Unpost" : "Post"}
                  </button>
                  <button
                    className="btn ghost small"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        setLoopStatus(
                          loop.id,
                          loop.status === "Cancelled" ? "Unassigned" : "Cancelled",
                        ),
                      )
                    }
                  >
                    {loop.status === "Cancelled" ? "Restore" : "Cancel"}
                  </button>
                </div>

                {isOpen && (
                  <OfferPanel
                    candidates={candidatesByLoop[loop.id] ?? []}
                    needs={needs}
                    busy={pending}
                    onSend={(ids) =>
                      start(async () => {
                        const res = await offerLoop(loop.id, ids);
                        if (!res.ok) {
                          setNote({ kind: "err", text: res.error });
                          return;
                        }
                        const { offered, skipped } = res.value;
                        setNote({
                          kind: skipped.length ? "err" : "ok",
                          text:
                            `Offered to ${offered} ${
                              offered === 1 ? "caddie" : "caddies"
                            }.` +
                            (skipped.length
                              ? ` ${skipped.length} skipped: ${skipped
                                  .map((s) => s.reason)
                                  .join("; ")}`
                              : ""),
                        });
                        setOpenLoop(null);
                        router.refresh();
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Whole-day actions: print the sheet, call the day off, copy it forward
// ---------------------------------------------------------------------------

function DayTools({
  day,
  hasLoops,
  busy,
  onNote,
}: {
  day: string;
  hasLoops: boolean;
  busy: boolean;
  onNote: (n: { kind: "ok" | "err"; text: string } | null) => void;
}) {
  const router = useRouter();
  const [working, start] = useTransition();
  const [copyTo, setCopyTo] = useState(shift(day, 7));
  const [showCopy, setShowCopy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const disabled = busy || working || !hasLoops;

  return (
    <div
      className="no-print"
      style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}
    >
      <button
        className="btn secondary small"
        disabled={!hasLoops}
        onClick={() => window.print()}
      >
        Print sheet
      </button>

      <button
        className="btn secondary small"
        disabled={disabled}
        onClick={() => setShowCopy((s) => !s)}
      >
        Copy day →
      </button>

      {/* Two-step rather than a native confirm(): the browser dialog blocks the
          page, looks nothing like the rest of the app, and cannot be styled to
          say what is actually about to happen. */}
      {confirmCancel ? (
        <span
          style={{
            display: "inline-flex",
            gap: 8,
            alignItems: "center",
            padding: "4px 8px",
            border: "1px solid var(--danger)",
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13 }}>
            Cancel every loop on this day? Offers waiting on an answer are
            withdrawn.
          </span>
          <button
            className="btn danger small"
            disabled={working}
            onClick={() =>
              start(async () => {
                const res = await cancelDay(day);
                setConfirmCancel(false);
                if (res.ok) {
                  onNote({
                    kind: "ok",
                    text: `Cancelled ${res.value} ${
                      res.value === 1 ? "loop" : "loops"
                    }. Individual loops can be restored.`,
                  });
                  router.refresh();
                } else {
                  onNote({ kind: "err", text: res.error });
                }
              })
            }
          >
            {working ? "Cancelling…" : "Yes, cancel them"}
          </button>
          <button
            className="btn ghost small"
            onClick={() => setConfirmCancel(false)}
          >
            Keep them
          </button>
        </span>
      ) : (
        <button
          className="btn ghost small"
          disabled={disabled}
          onClick={() => {
            setShowCopy(false);
            setConfirmCancel(true);
          }}
        >
          Cancel the day
        </button>
      )}

      {showCopy && (
        <span
          style={{
            display: "inline-flex",
            gap: 8,
            alignItems: "center",
            padding: "4px 8px",
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          <span className="muted" style={{ fontSize: 13 }}>
            Copy these loops to
          </span>
          <input
            type="date"
            value={copyTo}
            onChange={(e) => e.target.value && setCopyTo(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--ink)",
            }}
          />
          <button
            className="btn small"
            disabled={working}
            onClick={() =>
              start(async () => {
                const res = await duplicateDay(day, copyTo);
                if (res.ok) {
                  onNote({
                    kind: "ok",
                    text: `Copied ${res.value} ${
                      res.value === 1 ? "loop" : "loops"
                    } to ${copyTo}. Caddies were not copied.`,
                  });
                  setShowCopy(false);
                  router.push(`/admin/caddie?day=${copyTo}`);
                } else {
                  onNote({ kind: "err", text: res.error });
                }
              })
            }
          >
            {working ? "Copying…" : "Copy"}
          </button>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One caddie's standing on one loop
// ---------------------------------------------------------------------------

function CrewChip({
  member,
  busy,
  onAccept,
  onDecline,
  onWithdraw,
}: {
  member: CrewMember;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onWithdraw: () => void;
}) {
  const s = member.confirmationStatus;
  const tone = s === "Accepted" ? "open" : s === "Pending" ? "draft" : "gray";

  return (
    <span
      className="pill"
      style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
    >
      <span className={`badge ${tone}`}>{member.caddie.rank}</span>
      <span>{member.caddie.fullName}</span>
      <span className="muted" style={{ fontSize: 12 }}>
        {s.toLowerCase()}
      </span>
      {s === "Pending" && (
        <>
          <button className="btn ghost small" disabled={busy} onClick={onAccept}>
            ✓
          </button>
          <button
            className="btn ghost small"
            disabled={busy}
            onClick={onDecline}
          >
            ✕
          </button>
          <button
            className="btn ghost small"
            disabled={busy}
            onClick={onWithdraw}
          >
            pull
          </button>
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ranked candidates, multi-select
// ---------------------------------------------------------------------------

function OfferPanel({
  candidates,
  needs,
  busy,
  onSend,
}: {
  candidates: BoardCandidate[];
  needs: number;
  busy: boolean;
  onSend: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div
      className="no-print"
      style={{
        flexBasis: "100%",
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid var(--line)",
      }}
    >
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
        {candidates.length === 0
          ? "No active caddies on the roster yet."
          : `Best first — availability, then rank, then who has waited longest. Needs ${needs}.`}
      </div>

      <div
        style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}
      >
        {candidates.map((c) => (
          <label
            key={c.caddie.id}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              opacity: c.conflict || c.alreadyOffered ? 0.5 : 1,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={picked.includes(c.caddie.id)}
              onChange={() => toggle(c.caddie.id)}
            />
            <span className="badge gray">{c.caddie.rank}</span>
            <span style={{ flex: 1 }}>{c.caddie.fullName}</span>
            {c.requested && <span className="badge open">requested</span>}
            {c.availability === "Available" && (
              <span className="badge open">available</span>
            )}
            {c.availability === "Unavailable" && (
              <span className="badge closed">off</span>
            )}
            {c.availability == null && (
              <span className="muted" style={{ fontSize: 12 }}>
                no answer
              </span>
            )}
            {c.conflict && <span className="badge closed">conflict</span>}
            {c.alreadyOffered && <span className="badge gray">asked</span>}
            <span className="muted" style={{ fontSize: 12 }}>
              {c.caddie.lastWorkedOn
                ? `last ${c.caddie.lastWorkedOn}`
                : "never worked"}
            </span>
          </label>
        ))}
      </div>

      <div
        style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}
      >
        <button
          className="btn small"
          disabled={busy || picked.length === 0}
          onClick={() => onSend(picked)}
        >
          {picked.length > 1
            ? `Broadcast to ${picked.length} — first to answer wins`
            : "Send offer"}
        </button>
        {picked.length > 0 && (
          <button className="btn ghost small" onClick={() => setPicked([])}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick add — built for entering a whole sheet by hand
// ---------------------------------------------------------------------------

function QuickAdd({
  day,
  caddies,
  busy,
}: {
  day: string;
  caddies: CaddieRec[];
  busy: boolean;
}) {
  const router = useRouter();
  // The date defaults to whatever day is on screen, but is editable, so a
  // Saturday loop can be posted on a Tuesday without navigating there first.
  const [date, setDate] = useState(day);
  const [time, setTime] = useState("07:00");
  const [playerName, setPlayerName] = useState("");
  const [loopType, setLoopType] = useState<LoopType>("Single Bag");
  const [caddiesRequired, setCaddiesRequired] = useState(1);
  const [notes, setNotes] = useState("");
  const [requestedRank, setRequestedRank] = useState<CaddieRank | "">("");
  const [requestedCaddieId, setRequestedCaddieId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const activeCaddies = useMemo(
    () => caddies.filter((c) => c.status === "Active"),
    [caddies],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await saveLoop({
        day: date,
        time,
        playerName,
        loopType,
        caddiesRequired,
        notes,
        requestedRank: requestedRank || null,
        requestedCaddieId: requestedCaddieId || null,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      // Entering a sheet means many loops in a row: keep the settings and the
      // date, clear the name, and roll the clock forward one interval so the
      // next row starts close to right.
      setPlayerName("");
      setNotes("");
      setRequestedCaddieId("");
      setTime(bumpTime(time, 10));

      // Posted somewhere other than the day on screen? Go there, otherwise the
      // loop vanishes into a date the user cannot see and looks like a failure.
      if (date !== day) router.push(`/admin/caddie?day=${date}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="card no-print" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            required
            style={{ ...inputStyle, width: 150 }}
          />
        </Field>
        <Field label="Tee time">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            style={{ ...inputStyle, width: 120 }}
          />
        </Field>
        <Field label="Player" grow>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Member name"
            required
            style={{ ...inputStyle, minWidth: 180, width: "100%" }}
          />
        </Field>
        <Field label="Type">
          <select
            value={loopType}
            onChange={(e) => setLoopType(e.target.value as LoopType)}
            style={inputStyle}
          >
            {LOOP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Caddies">
          <input
            type="number"
            min={1}
            max={8}
            value={caddiesRequired}
            onChange={(e) => setCaddiesRequired(Number(e.target.value))}
            style={{ ...inputStyle, width: 72 }}
          />
        </Field>
        <Field label="Wants rank">
          <select
            value={requestedRank}
            onChange={(e) => setRequestedRank(e.target.value as CaddieRank | "")}
            style={{ ...inputStyle, width: 100 }}
          >
            <option value="">Any</option>
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Wants caddie">
          <select
            value={requestedCaddieId}
            onChange={(e) => setRequestedCaddieId(e.target.value)}
            style={{ ...inputStyle, minWidth: 140 }}
          >
            <option value="">Anyone</option>
            {activeCaddies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note" grow>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            style={{ ...inputStyle, minWidth: 140, width: "100%" }}
          />
        </Field>
        <button className="btn" type="submit" disabled={saving || busy}>
          {saving ? "Adding…" : "Add loop"}
        </button>
      </div>
      {err && (
        <p className="notice err" style={{ marginBottom: 0 }}>
          {err}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <label style={{ display: "block", flex: grow ? "1 1 160px" : "0 0 auto" }}>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 15,
};

function shift(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function bumpTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}
