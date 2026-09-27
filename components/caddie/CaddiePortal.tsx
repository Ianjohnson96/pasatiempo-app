"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PushOptIn from "./PushOptIn";
import {
  caddieSignOut,
  claimOpenLoop,
  dropMyLoop,
  respondToMyOffer,
} from "@/lib/caddie/actions";
import { dropLateness } from "@/lib/caddie/ledger";
import type {
  CaddieRec,
  ConfirmationStatus,
  LoopType,
} from "@/lib/caddie/types";

// The caddie's phone. This is the only screen in the app that is never opened
// on a desktop, so it is a single column with targets big enough for a thumb
// at 6am — no tables, no hover states, nothing that needs a mouse.

export interface PortalLoop {
  assignmentId: string;
  /** Tee time has passed: the loop is under way and can no longer be handed back. */
  started: boolean;
  status: ConfirmationStatus;
  offerExpiresAt: string | null;
  teeLabel: string; // "7:42 AM"
  dayLabel: string; // "Sat, Sep 20"
  teeTime: string; // ISO, for sorting only
  playerName: string;
  loopType: LoopType;
  holes: number;
  notes: string;
  rateCents: number | null;
}

/** A loop the shop posted to the job board that this caddie could take. */
export interface OpenLoop {
  loopId: string;
  teeLabel: string;
  dayLabel: string;
  playerName: string;
  loopType: LoopType;
  holes: number;
  notes: string;
  rateCents: number | null;
}

export default function CaddiePortal({
  caddie,
  items,
  open,
  vapidKey,
}: {
  caddie: CaddieRec;
  items: PortalLoop[];
  open: OpenLoop[];
  vapidKey: string | null;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const offers = items.filter((i) => i.status === "Pending");
  const booked = items.filter((i) => i.status === "Accepted");

  function answer(id: string, accept: boolean) {
    setNote(null);
    start(async () => {
      const res = await respondToMyOffer(id, accept);
      if (res.ok) {
        setNote({
          kind: "ok",
          text: res.value === "accepted" ? "You're on the loop." : "Declined.",
        });
        router.refresh();
      } else {
        setNote({ kind: "err", text: res.error });
      }
    });
  }

  return (
    <main
      className="container narrow"
      style={{ maxWidth: 520, paddingTop: 24, paddingBottom: 48 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <p className="eyebrow" style={{ marginBottom: 2 }}>
            Pasatiempo Caddies
          </p>
          <h1 style={{ fontSize: 26, margin: 0 }}>{caddie.fullName}</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {caddie.tierName ?? "Caddie"}
          </div>
        </div>
        <button
          className="btn ghost small"
          disabled={busy}
          onClick={() =>
            start(async () => {
              await caddieSignOut();
              router.refresh();
            })
          }
        >
          Sign out
        </button>
      </div>

      {note && (
        <p
          className={note.kind === "ok" ? "notice ok" : "notice err"}
          style={{ marginTop: 16 }}
        >
          {note.text}
        </p>
      )}

      <PushOptIn vapidKey={vapidKey} />

      <Link
        href="/caddie/availability"
        className="btn secondary"
        style={{ display: "block", textAlign: "center", marginTop: 18 }}
      >
        Set your availability →
      </Link>

      {/* ---- Offers waiting on an answer -------------------------------- */}
      <h2 className="section-title" style={{ marginTop: 28 }}>
        {offers.length > 0
          ? `${offers.length} ${
              offers.length === 1 ? "offer" : "offers"
            } for you`
          : "No offers right now"}
      </h2>

      {offers.length === 0 && (
        <p className="muted" style={{ marginTop: 4 }}>
          The Pro Shop will let you know when something comes up.
        </p>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {offers.map((o) => (
          <LoopCard key={o.assignmentId} loop={o} highlight>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                className="btn"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={() => answer(o.assignmentId, true)}
              >
                Accept
              </button>
              <button
                className="btn secondary"
                style={{ flex: 1 }}
                disabled={busy}
                onClick={() => answer(o.assignmentId, false)}
              >
                Decline
              </button>
            </div>
            {o.offerExpiresAt && (
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                First to answer gets it.
              </div>
            )}
          </LoopCard>
        ))}
      </div>

      {/* ---- The open job board ------------------------------------------ */}
      {open.length > 0 && (
        <>
          <h2 className="section-title" style={{ marginTop: 32 }}>
            Up for grabs
          </h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Posted by the Pro Shop. First to claim gets it.
          </p>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {open.map((o) => (
              <div className="card" key={o.loopId}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "baseline",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 600 }}>
                    {o.teeLabel}
                  </div>
                  <div className="muted">{o.dayLabel}</div>
                </div>

                <div style={{ fontSize: 17, marginTop: 6 }}>{o.playerName}</div>

                <div className="ev-meta" style={{ marginTop: 6 }}>
                  <span>{o.loopType}</span>
                  {o.rateCents != null && (
                    <span>${(o.rateCents / 100).toFixed(0)}</span>
                  )}
                </div>

                {o.notes && (
                  <div style={{ marginTop: 8, fontSize: 14 }}>{o.notes}</div>
                )}

                <button
                  className="btn"
                  style={{ width: "100%", marginTop: 14 }}
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      setNote(null);
                      const res = await claimOpenLoop(o.loopId);
                      if (res.ok) {
                        setNote({ kind: "ok", text: "You're on the loop." });
                        router.refresh();
                      } else {
                        setNote({ kind: "err", text: res.error });
                        router.refresh();
                      }
                    })
                  }
                >
                  Claim this loop
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- Confirmed loops --------------------------------------------- */}
      <h2 className="section-title" style={{ marginTop: 32 }}>
        Your schedule
      </h2>

      {booked.length === 0 ? (
        <p className="muted" style={{ marginTop: 4 }}>
          Nothing booked yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {booked.map((b) => (
            <LoopCard key={b.assignmentId} loop={b}>
              {!b.started && (
                <DropControl
                  loop={b}
                  busy={busy}
                  onDropped={(text) => {
                    setNote({ kind: "ok", text });
                    router.refresh();
                  }}
                  onError={(text) => setNote({ kind: "err", text })}
                />
              )}
            </LoopCard>
          ))}
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 36 }}>
        Caddies are paid in person at the end of the loop. The figure shown is
        the club rate for that loop.
      </p>
    </main>
  );
}

function LoopCard({
  loop,
  highlight,
  children,
}: {
  loop: PortalLoop;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={
        highlight ? { borderColor: "var(--accent)", borderWidth: 2 } : undefined
      }
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 600 }}>{loop.teeLabel}</div>
        <div className="muted">{loop.dayLabel}</div>
      </div>

      <div style={{ fontSize: 17, marginTop: 6 }}>{loop.playerName}</div>

      <div className="ev-meta" style={{ marginTop: 6 }}>
        <span>{loop.loopType}</span>
        {loop.rateCents != null && (
          <span>${(loop.rateCents / 100).toFixed(0)}</span>
        )}
      </div>

      {loop.notes && (
        <div style={{ marginTop: 8, fontSize: 14 }}>{loop.notes}</div>
      )}

      {children}
    </div>
  );
}

/**
 * "Can't make it" — hand a booked loop back to the shop.
 *
 * Two taps, not one: a loop given back by a thumb brushing the screen is a
 * loop the shop has to refill for nothing. The second step says plainly when
 * it is late, because inside a day the shop may not find anyone, and a caddie
 * should know that before choosing.
 */
function DropControl({
  loop,
  busy,
  onDropped,
  onError,
}: {
  loop: PortalLoop;
  busy: boolean;
  onDropped: (text: string) => void;
  onError: (text: string) => void;
}) {
  // Set at the moment of the first tap, not during render: how late a drop is
  // depends on when it happens, and render is not "when".
  const [armedAt, setArmedAt] = useState<string | null>(null);
  const [working, start] = useTransition();

  if (!armedAt) {
    return (
      <button
        className="btn ghost small"
        style={{ marginTop: 12 }}
        disabled={busy}
        onClick={() => setArmedAt(new Date().toISOString())}
      >
        Can&apos;t make it
      </button>
    );
  }

  const late = dropLateness(armedAt, loop.teeTime);

  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: "var(--green-tint)",
      }}
    >
      <div style={{ fontSize: 14 }}>
        Give this loop back to the Pro Shop?
        {late === "same day" && (
          <strong style={{ display: "block", marginTop: 4, color: "var(--danger)" }}>
            It tees off within a few hours — the shop may not find anyone.
          </strong>
        )}
        {late === "late" && (
          <strong style={{ display: "block", marginTop: 4, color: "var(--warn)" }}>
            It is within a day of the tee time, so it is hard to replace you.
          </strong>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          className="btn danger small"
          style={{ flex: 1 }}
          disabled={working}
          onClick={() =>
            start(async () => {
              const res = await dropMyLoop(loop.assignmentId);
              setArmedAt(null);
              if (res.ok) onDropped("Loop given back. The shop can see it's open again.");
              else onError(res.error);
            })
          }
        >
          {working ? "Giving back…" : "Yes, give it back"}
        </button>
        <button
          className="btn secondary small"
          style={{ flex: 1 }}
          disabled={working}
          onClick={() => setArmedAt(null)}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
