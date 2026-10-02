"use client";

import { useState, useTransition } from "react";
import { syncCalendarNow, type SyncSummary } from "@/lib/lessons/actions";

// "Sync now": pull the Outlook calendar immediately, e.g. right after fixing
// titles, instead of waiting for the 2am run. Says what changed, in words.

function describe(s: SyncSummary): string {
  const bits = [
    s.inserted && `${s.inserted} new`,
    s.adopted && `${s.adopted} linked`,
    s.resolved && `${s.resolved} cleared from Review`,
    s.singles && `${s.singles} billed as singles`,
    s.queued && `${s.queued} sent to Review`,
  ].filter(Boolean);
  return bits.length
    ? `Synced: ${bits.join(", ")}.`
    : `Synced — nothing new (${s.updated} lessons checked).`;
}

export default function SyncNow() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  return (
    <span className="lb-syncnow">
      <button
        type="button"
        className="btn secondary small"
        disabled={busy}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await syncCalendarNow();
            setMsg(
              r.ok
                ? { ok: true, text: describe(r.value) }
                : { ok: false, text: r.error },
            );
          });
        }}
      >
        {busy ? "Syncing…" : "Sync now"}
      </button>
      {msg && (
        <span className={msg.ok ? "lb-syncmsg" : "lb-syncmsg bad"} role="status">
          {msg.text}
        </span>
      )}
    </span>
  );
}
