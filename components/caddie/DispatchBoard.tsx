"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  callAllCaddies,
  cancelDay,
  duplicateDay,
  offerLoop,
  offerToTiers,
  nudgePending,
  respondForCaddie,
  createGroupBooking,
  deleteLoop,
  setLoopStatus,
  setOpenBoard,
  withdrawOffer,
} from "@/lib/caddie/actions";
import {
  LOOP_TYPES,
  TEE_INTERVAL_MINUTES,
  acceptedCount,
  pendingCount,
  rateFor,
  type CaddieRec,
  type CrewMember,
  type GroupNeed,
  type LoopRec,
  type LoopStatus,
  type LoopType,
  type LoopWithCrew,
  type RateCard,
  type TierRec,
} from "@/lib/caddie/types";

// What the server hands down per loop. Mirrors the Candidate in
// lib/caddie/data.ts, which cannot be imported here — it pulls in the
// service_role client.
export interface BoardCandidate {
  caddie: CaddieRec;
  availability: "Available" | "Unavailable" | "Pending" | null;
  alreadyOffered: boolean;
  conflict: boolean;
}

interface Props {
  day: string; // "yyyy-mm-dd"
  dayLabel: string;
  today: string;
  loops: LoopWithCrew[];
  candidatesByLoop: Record<string, BoardCandidate[]>;
  teeLabels: Record<string, string>; // loop id -> "7:42 AM"
  /** Loop ids whose tee time has already passed. */
  pastLoopIds: string[];
  /** Booking id -> party name, for loops that go out together. */
  groupNames: Record<string, string>;
  /** How many active caddies a post would actually notify. */
  coverage: { reachable: number; total: number };
  /** Tiers, in dispatch order, for offering to a whole tier at once. */
  tiers: TierRec[];
  rates: RateCard;
  notifyReady: boolean;
}

/**
 * Offered and notified are different numbers, and the gap is the whole point:
 * a caddie with no alerts on has an offer sitting in a portal they will not
 * open. Saying so is what stops the shop assuming the message landed.
 */
function describeOffer(v: {
  offered: number;
  notified: number;
  skipped: { reason: string }[];
}): { kind: "ok" | "err"; text: string } {
  const parts = [
    `Offered to ${v.offered} ${v.offered === 1 ? "caddie" : "caddies"}`,
  ];
  if (v.notified < v.offered) {
    parts.push(
      `${v.notified} alerted — the rest have no job alerts turned on`,
    );
  } else {
    parts.push("all alerted");
  }
  if (v.skipped.length > 0) {
    parts.push(`${v.skipped.length} skipped: ${v.skipped.map((s) => s.reason).join("; ")}`);
  }
  return {
    kind: v.skipped.length > 0 || v.notified === 0 ? "err" : "ok",
    text: parts.join(" · ") + ".",
  };
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
  candidatesByLoop,
  teeLabels,
  pastLoopIds,
  groupNames,
  coverage,
  tiers,
  rates,
  notifyReady,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openLoop, setOpenLoop] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const past = new Set(pastLoopIds);

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

      {!notifyReady ? (
        <p className="notice warn">
          Job alerts are not configured, so posting a loop tells nobody. Ring the
          caddie, then mark their answer here.
        </p>
      ) : (
        coverage.reachable < coverage.total && (
          // Said before the button is pressed, not after. Finding out that a
          // blast reached five of eighteen once it has already gone is how the
          // shop learns to ring everybody anyway.
          <p
            className={coverage.reachable === 0 ? "notice err" : "notice warn"}
          >
            Job alerts reach <strong>{coverage.reachable} of{" "}
            {coverage.total}</strong> active{" "}
            {coverage.total === 1 ? "caddie" : "caddies"}.{" "}
            {coverage.total - coverage.reachable}{" "}
            {coverage.total - coverage.reachable === 1 ? "has" : "have"} not
            turned alerts on and will not hear about a posted loop.{" "}
            <Link href="/admin/caddie/roster">See who →</Link>
          </p>
        )
      )}

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      <QuickAdd day={day} busy={pending} />

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
            // Offering a loop that has already been played is never right,
            // whatever its status says.
            const isPast = past.has(loop.id);
            const groupName = loop.bookingId
              ? groupNames[loop.bookingId]
              : undefined;

            return (
              <div
                  key={loop.id}
                  className="evrow"
                  style={{
                    flexWrap: "wrap",
                    // A shared left rule reads as "these go out together"
                    // faster than repeating the party name on every row.
                    borderLeft: groupName
                      ? "3px solid var(--accent)"
                      : undefined,
                    paddingLeft: groupName ? 10 : undefined,
                  }}
                >
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
                    {groupName && (
                      <span className="badge gray" title={`Part of ${groupName}`}>
                        {groupName}
                      </span>
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
                  {needs > 0 && !isPast && loop.status !== "Cancelled" && (
                    <button
                      className="btn small"
                      onClick={() => setOpenLoop(isOpen ? null : loop.id)}
                    >
                      {isOpen ? "Close" : `Offer (${needs})`}
                    </button>
                  )}
                  {/* The whole point of the app: one button instead of
                      texting the roster one at a time. */}
                  {needs > 0 && !isPast && loop.status !== "Cancelled" && (
                    <button
                      className="btn small"
                      disabled={pending}
                      // The accessible name must contain the visible text,
                      // or a screen reader announces the tooltip instead of
                      // the label the sighted user is being told to press.
                      aria-label="Call all caddies: post this loop and alert everyone active"
                      onClick={() =>
                        start(async () => {
                          setNote(null);
                          const res = await callAllCaddies(loop.id);
                          if (res.ok) {
                            setNote({
                              kind: "ok",
                              text:
                                res.value > 0
                                  ? `Alerted ${res.value} ${
                                      res.value === 1 ? "caddie" : "caddies"
                                    }. First to claim gets it.`
                                  : "Posted, but no caddie has job alerts turned on yet.",
                            });
                            router.refresh();
                          } else {
                            setNote({ kind: "err", text: res.error });
                          }
                        })
                      }
                    >
                      Call all{coverage.reachable > 0 && ` (${coverage.reachable})`}
                    </button>
                  )}
                  {waiting > 0 && !isPast && (
                    <button
                      className="btn secondary small"
                      disabled={pending}
                      title={`Push the offer again at the ${waiting} still deciding`}
                      onClick={() =>
                        start(async () => {
                          setNote(null);
                          const res = await nudgePending(loop.id);
                          setNote(
                            res.ok
                              ? {
                                  kind: res.value > 0 ? "ok" : "err",
                                  text:
                                    res.value > 0
                                      ? `Nudged ${res.value} ${res.value === 1 ? "phone" : "phones"}.`
                                      : "Nobody waiting has job alerts turned on.",
                                }
                              : { kind: "err", text: res.error },
                          );
                          router.refresh();
                        })
                      }
                    >
                      Nudge ({waiting})
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
                  <DeleteLoopButton
                    loop={loop}
                    disabled={pending}
                    onDone={() => router.refresh()}
                  />
                </div>

                {/* Who put this on the sheet and who took it off. A loop that
                    vanishes is an argument waiting to happen, and the caddie
                    who was on it deserves a better answer than "the system". */}
                <LoopAudit loop={loop} />

                {isOpen && (
                  <OfferPanel
                    candidates={candidatesByLoop[loop.id] ?? []}
                    tiers={tiers}
                    needs={needs}
                    busy={pending}
                    onOfferCaddies={(ids) =>
                      start(async () => {
                        setNote(null);
                        const res = await offerLoop(loop.id, ids);
                        if (!res.ok) {
                          setNote({ kind: "err", text: res.error });
                          return;
                        }
                        setNote(describeOffer(res.value));
                        setOpenLoop(null);
                        router.refresh();
                      })
                    }
                    onOfferTiers={(tierIds) =>
                      start(async () => {
                        setNote(null);
                        const res = await offerToTiers(loop.id, tierIds);
                        if (!res.ok) {
                          setNote({ kind: "err", text: res.error });
                          return;
                        }
                        setNote(describeOffer(res.value));
                        setOpenLoop(null);
                        router.refresh();
                      })
                    }
                    onCallAll={() =>
                      start(async () => {
                        setNote(null);
                        const res = await callAllCaddies(loop.id);
                        if (!res.ok) {
                          setNote({ kind: "err", text: res.error });
                          return;
                        }
                        setNote({
                          kind: res.value > 0 ? "ok" : "err",
                          text:
                            res.value > 0
                              ? `Posted and alerted ${res.value} ${
                                  res.value === 1 ? "caddie" : "caddies"
                                }. First to claim gets it.`
                              : "Posted, but no caddie has job alerts turned on yet.",
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
      <span className={`badge ${tone}`}>
        {member.caddie.tierName ?? "—"}
      </span>
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
  tiers,
  needs,
  busy,
  onOfferCaddies,
  onOfferTiers,
  onCallAll,
}: {
  candidates: BoardCandidate[];
  tiers: TierRec[];
  needs: number;
  busy: boolean;
  onOfferCaddies: (ids: string[]) => void;
  onOfferTiers: (tierIds: string[]) => void;
  onCallAll: () => void;
}) {
  const [mode, setMode] = useState<"tier" | "pick" | "all">("tier");
  const [picked, setPicked] = useState<string[]>([]);
  const [pickedTiers, setPickedTiers] = useState<string[]>([]);

  const toggle = (id: string, set: typeof setPicked) =>
    set((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // How many active caddies sit in the tiers currently ticked.
  const inTiers = candidates.filter(
    (c) => c.caddie.tierId && pickedTiers.includes(c.caddie.tierId),
  ).length;

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
      <div className="seg" style={{ marginBottom: 12 }}>
        <button
          className={mode === "tier" ? "segbtn on" : "segbtn"}
          onClick={() => setMode("tier")}
        >
          By tier
        </button>
        <button
          className={mode === "pick" ? "segbtn on" : "segbtn"}
          onClick={() => setMode("pick")}
        >
          Pick caddies
        </button>
        <button
          className={mode === "all" ? "segbtn on" : "segbtn"}
          onClick={() => setMode("all")}
        >
          Everyone
        </button>
      </div>

      {mode === "tier" && (
        <>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Offer to whole tiers, seniority first. Only these caddies can take
            it — widen to the next tier if nobody bites.
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {tiers.map((t, i) => {
              const count = candidates.filter(
                (c) => c.caddie.tierId === t.id,
              ).length;
              return (
                <label
                  key={t.id}
                  style={{ display: "flex", gap: 10, alignItems: "center" }}
                >
                  <input
                    type="checkbox"
                    checked={pickedTiers.includes(t.id)}
                    onChange={() => toggle(t.id, setPickedTiers)}
                  />
                  <span style={{ flex: 1 }}>{t.name}</span>
                  {i === 0 && <span className="badge open">most senior</span>}
                  <span className="muted" style={{ fontSize: 12 }}>
                    {count} active
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              className="btn small"
              disabled={busy || pickedTiers.length === 0 || inTiers === 0}
              onClick={() => onOfferTiers(pickedTiers)}
            >
              Offer to {inTiers} {inTiers === 1 ? "caddie" : "caddies"}
            </button>
            {pickedTiers.length > 0 && (
              <button
                className="btn ghost small"
                onClick={() => setPickedTiers([])}
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}

      {mode === "pick" && (
        <>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Best first — availability, then tier, then who has waited longest.
            Needs {needs}.
          </p>
          <div
            style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}
          >
            {candidates.length === 0 && (
              <span className="muted">No active caddies on the roster yet.</span>
            )}
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
                  onChange={() => toggle(c.caddie.id, setPicked)}
                />
                <span className="badge gray">{c.caddie.tierName ?? "—"}</span>
                <span style={{ flex: 1 }}>{c.caddie.fullName}</span>
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
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              className="btn small"
              disabled={busy || picked.length === 0}
              onClick={() => onOfferCaddies(picked)}
            >
              {picked.length > 1
                ? `Offer to ${picked.length} — first to answer wins`
                : "Send offer"}
            </button>
            {picked.length > 0 && (
              <button className="btn ghost small" onClick={() => setPicked([])}>
                Clear
              </button>
            )}
          </div>
        </>
      )}

      {mode === "all" && (
        <>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Posts the loop to the job board and alerts every active caddie.
            Unlike a tier offer, anyone can claim it — use this when you need it
            filled more than you need it fair.
          </p>
          <button className="btn small" disabled={busy} onClick={onCallAll}>
            Call all caddies
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick add — built for entering a whole sheet by hand
// ---------------------------------------------------------------------------

function QuickAdd({
  day,
  busy,
}: {
  day: string;
  busy: boolean;
}) {
  const router = useRouter();
  // Defaults to the day on screen but editable, so a Saturday party can be
  // booked on a Tuesday without navigating there first.
  const [date, setDate] = useState(day);
  const [time, setTime] = useState("07:00");
  const [name, setName] = useState("");
  // One entry per tee time. A group with no needs is a group playing without
  // a caddie, which is a thing the shop has to be able to say.
  const [groups, setGroups] = useState<GroupNeed[][]>([
    [{ loopType: "Single Bag", count: 1 }],
  ]);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, start] = useTransition();

  // Show the shop exactly which tee times it is about to create, so a party of
  // twelve across three groups is checkable before it is booked, not after.
  const preview = useMemo(() => {
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return [];
    return groups.map((_, i) => {
      const total = h * 60 + m + i * TEE_INTERVAL_MINUTES;
      const hh = Math.floor(total / 60) % 24;
      const mm = total % 60;
      const ampm = hh < 12 ? "a" : "p";
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      return `${h12}:${String(mm).padStart(2, "0")}${ampm}`;
    });
  }, [time, groups]);

  // Mutating one group without disturbing the rest.
  const editGroup = (i: number, fn: (needs: GroupNeed[]) => GroupNeed[]) =>
    setGroups((gs) => gs.map((g, k) => (k === i ? fn(g) : g)));

  const addNeed = (i: number, loopType: LoopType) =>
    editGroup(i, (needs) =>
      needs.some((n) => n.loopType === loopType)
        ? needs.map((n) =>
            n.loopType === loopType
              ? { ...n, count: Math.min(8, n.count + 1) }
              : n,
          )
        : [...needs, { loopType, count: 1 }],
    );

  const dropNeed = (i: number, loopType: LoopType) =>
    editGroup(i, (needs) =>
      needs.flatMap((n) =>
        n.loopType !== loopType
          ? [n]
          : n.count > 1
            ? [{ ...n, count: n.count - 1 }]
            : [],
      ),
    );

  const totalLoops = groups.reduce((n, g) => n + g.length, 0);
  const totalCaddies = groups.reduce(
    (n, g) => n + g.reduce((s, x) => s + x.count, 0),
    0,
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await createGroupBooking({
        day: date,
        time,
        name,
        groups,
        notes,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setName("");
      setNotes("");
      setGroups([[{ loopType: "Single Bag", count: 1 }]]);
      setTime(bumpTime(time, TEE_INTERVAL_MINUTES * groups.length));
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
        <Field label="First tee">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            style={{ ...inputStyle, width: 120 }}
          />
        </Field>
        <Field label="Group / party" grow>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Member or party name"
            required
            style={{ ...inputStyle, minWidth: 180, width: "100%" }}
          />
        </Field>
        <Field label="Note" grow>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            style={{ ...inputStyle, minWidth: 140, width: "100%" }}
          />
        </Field>
      </div>

      {/* One row per tee time, ten minutes apart, each saying what it wants.
          A group is rarely one thing — two double bags, or a double and a
          single, or a double and a forecaddie for the other two — and a
          sixteen-player outing where only the first and fourth groups want a
          caddie is still one booking. */}
      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
        {groups.map((needs, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: "8px 10px",
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <strong style={{ minWidth: 64, fontSize: 15 }}>
              {preview[i] ?? "—"}
            </strong>
            <span className="muted" style={{ fontSize: 12, minWidth: 54 }}>
              {groups.length > 1 ? `${i + 1} of ${groups.length}` : "group"}
            </span>

            {needs.length === 0 && (
              <span className="muted" style={{ fontSize: 13 }}>
                No caddie — just playing
              </span>
            )}

            {needs.map((n) => (
              <span
                key={n.loopType}
                className="badge gray"
                style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
              >
                {n.count > 1 ? `${n.count} × ` : ""}
                {n.loopType}
                <button
                  type="button"
                  aria-label={`Remove one ${n.loopType} from group ${i + 1}`}
                  onClick={() => dropNeed(i, n.loopType)}
                  style={{
                    border: 0,
                    background: "none",
                    cursor: "pointer",
                    color: "inherit",
                    fontSize: 15,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            ))}

            <select
              value=""
              aria-label={`Add a caddie to group ${i + 1}`}
              onChange={(e) => {
                if (e.target.value) addNeed(i, e.target.value as LoopType);
              }}
              style={{ ...inputStyle, width: 148, marginLeft: "auto" }}
            >
              <option value="">+ Add caddie</option>
              {LOOP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {i === 0 && groups.length > 1 && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setGroups((gs) => gs.map(() => [...needs]))}
              >
                Same for all
              </button>
            )}
            {groups.length > 1 && (
              <button
                type="button"
                className="btn ghost small"
                aria-label={`Remove the ${preview[i] ?? ""} tee time`}
                onClick={() => setGroups((gs) => gs.filter((_, k) => k !== i))}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn secondary small"
          disabled={groups.length >= 20}
          onClick={() =>
            setGroups((gs) => [...gs, gs.length ? [...gs[gs.length - 1]] : []])
          }
        >
          + Another tee time
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          {TEE_INTERVAL_MINUTES} minutes apart
        </span>

        <button
          className="btn"
          type="submit"
          disabled={saving || busy}
          style={{ marginLeft: "auto" }}
        >
          {saving
            ? "Booking…"
            : totalLoops === 1
              ? "Add loop"
              : `Book ${totalLoops} loops`}
        </button>
      </div>

      {groups.length > 1 && (
        <p
          className="muted"
          style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}
        >
          {preview.join(" · ")} — {totalCaddies}{" "}
          {totalCaddies === 1 ? "caddie" : "caddies"} across {groups.length} tee
          times, kept together as one group.
        </p>
      )}

      {err && (
        <p className="notice err" style={{ marginBottom: 0 }}>
          {err}
        </p>
      )}
    </form>
  );
}

/**
 * Delete a loop, with a second tap to mean it.
 *
 * Two-step rather than a native confirm(): the browser dialog blocks the
 * render thread and cannot be driven by anything that tests this page, so a
 * confirm() here reads as "it worked" while nothing happened at all.
 *
 * Deleting is not cancelling. Cancel keeps the row, the history and the
 * caddie's record of having been on it; delete is for a job that should never
 * have been posted, so it says so plainly before doing it.
 */
function DeleteLoopButton({
  loop,
  disabled,
  onDone,
}: {
  loop: LoopRec;
  disabled: boolean;
  onDone: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const [working, start] = useTransition();

  if (!armed) {
    return (
      <button
        className="btn ghost small"
        disabled={disabled}
        aria-label={`Delete the ${loop.playerName} loop`}
        onClick={() => setArmed(true)}
      >
        Delete
      </button>
    );
  }

  return (
    <span
      style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
      role="group"
      aria-label="Confirm delete"
    >
      <span className="muted" style={{ fontSize: 13 }}>
        Delete for good?
      </span>
      <button
        className="btn danger small"
        disabled={working}
        onClick={() =>
          start(async () => {
            const res = await deleteLoop(loop.id);
            setArmed(false);
            if (res.ok) onDone();
          })
        }
      >
        {working ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        className="btn ghost small"
        disabled={working}
        onClick={() => setArmed(false)}
      >
        Keep it
      </button>
    </span>
  );
}

/** The paper trail: who posted it, and who called it off. */
function LoopAudit({ loop }: { loop: LoopRec }) {
  const when = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  const posted = when(loop.createdAt);
  const cancelled = when(loop.cancelledAt);
  if (!posted && !cancelled) return null;

  return (
    <p
      className="muted no-print"
      style={{ fontSize: 12, margin: "6px 0 0" }}
    >
      {posted && (
        <>
          Posted {posted}
          {loop.createdBy ? ` by ${loop.createdBy}` : ""}
        </>
      )}
      {posted && cancelled && " · "}
      {cancelled && (
        <>
          Cancelled {cancelled}
          {loop.cancelledBy ? ` by ${loop.cancelledBy}` : ""}
        </>
      )}
    </p>
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
