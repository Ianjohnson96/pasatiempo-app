"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markDropped } from "@/lib/caddie/actions";

// The shop records a drop for a caddie who phoned in rather than using the
// portal. Two taps: it puts a mark against the caddie's record with the staff
// member's name on it, which is not something to do by brushing a button.
//
// A plain second step rather than confirm(): the browser dialog blocks the
// page and cannot be exercised by anything that tests it.

export default function MarkDroppedButton({
  assignmentId,
  caddieName,
}: {
  assignmentId: string;
  caddieName: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, start] = useTransition();

  if (!armed) {
    return (
      <button
        type="button"
        className="btn ghost small"
        aria-label={`Record that ${caddieName} dropped this loop`}
        onClick={() => {
          setError(null);
          setArmed(true);
        }}
      >
        Dropped?
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span className="muted" style={{ fontSize: 12 }}>
        {caddieName} can&apos;t make it?
      </span>
      <button
        type="button"
        className="btn danger small"
        disabled={working}
        onClick={() =>
          start(async () => {
            const res = await markDropped(assignmentId);
            if (res.ok) {
              setArmed(false);
              router.refresh();
            } else {
              setError(res.error);
            }
          })
        }
      >
        {working ? "Saving…" : "Mark dropped"}
      </button>
      <button
        type="button"
        className="btn ghost small"
        disabled={working}
        onClick={() => setArmed(false)}
      >
        Keep
      </button>
      {error && (
        <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>
      )}
    </span>
  );
}
