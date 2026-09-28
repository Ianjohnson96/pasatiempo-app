"use client";

import { useState, useTransition } from "react";
import { confirmPending, rejectPending } from "@/lib/lessons/actions";
import { formatWhen, type PendingRec } from "@/lib/lessons/types";

// The confirm queue: calendar events that look like a lesson but match nobody
// on the roster.
//
// Nothing here is counted until it is answered. Guessing would be worse than
// asking - a wrong guess quietly changes what a student owes, and nobody would
// ever spot it.

export default function ConfirmQueue({
  items,
  students,
}: {
  items: PendingRec[];
  students: { id: string; name: string }[];
}) {
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  if (!items.length) {
    return (
      <p className="empty">
        Nothing to confirm. Anything on the calendar that might be a lesson but
        matches no student will show up here.
      </p>
    );
  }

  return (
    <>
      <p className="lead">
        {items.length} calendar {items.length === 1 ? "entry" : "entries"} might
        be a lesson. Until you answer,{" "}
        {items.length === 1 ? "it is" : "they are"} not counted anywhere.
      </p>

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      <div className="stack" style={{ marginTop: 12 }}>
        {items.map((p) => (
          <PendingCard
            key={p.eventKey}
            item={p}
            students={students}
            onNote={setNote}
          />
        ))}
      </div>
    </>
  );
}

function PendingCard({
  item: p,
  students,
  onNote,
}: {
  item: PendingRec;
  students: { id: string; name: string }[];
  onNote: (n: { kind: "ok" | "err"; text: string }) => void;
}) {
  // Pre-select the sync's guess when it matches somebody on the roster. It is
  // usually right, and it still has to be confirmed either way.
  const guessed = p.guess
    ? students.find(
        (s) => s.name.trim().toLowerCase() === p.guess!.trim().toLowerCase(),
      )
    : undefined;

  const [choice, setChoice] = useState(guessed?.id ?? "");
  const [newName, setNewName] = useState(guessed ? "" : (p.guess ?? ""));
  const [busy, start] = useTransition();

  function answer(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    ok: string,
  ) {
    start(async () => {
      const r = await fn();
      if (!r.ok) onNote({ kind: "err", text: r.error ?? "That did not work." });
      else onNote({ kind: "ok", text: ok });
    });
  }

  return (
    <div className="card">
      <strong>{p.title}</strong>
      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
        {formatWhen(p.startsAt)} &middot; {p.minutes} min
        {p.calendar && ` · ${p.calendar}`}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <select
          className="field"
          value={choice}
          disabled={busy}
          onChange={(e) => setChoice(e.target.value)}
          style={{ flex: "1 1 180px" }}
        >
          <option value="">New student&hellip;</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {choice === "" && (
          <input
            className="field"
            placeholder="Student name"
            value={newName}
            disabled={busy}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: "1 1 160px" }}
          />
        )}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button
          className="btn small"
          disabled={busy || (choice === "" && !newName.trim())}
          onClick={() =>
            answer(
              () =>
                confirmPending(
                  p.eventKey,
                  choice ? { id: choice } : { name: newName },
                ),
              "Added to the book.",
            )
          }
        >
          It&apos;s a lesson
        </button>
        <button
          className="btn secondary small"
          disabled={busy}
          onClick={() =>
            answer(() => rejectPending(p.eventKey, false), "Dismissed.")
          }
        >
          Not a lesson
        </button>
        {/* Remembers the title, so a weekly commitment is answered once rather
            than after every sync. */}
        <button
          className="btn ghost small"
          disabled={busy}
          onClick={() =>
            answer(
              () => rejectPending(p.eventKey, true),
              "Dismissed, and it will not be asked about again.",
            )
          }
        >
          Never ask again
        </button>
      </div>
    </div>
  );
}
