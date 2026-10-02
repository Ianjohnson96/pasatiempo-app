"use client";

import { useMemo, useState, useTransition } from "react";
import { dismissReview, resolveReview } from "@/lib/lessons/actions";
import { formatWhen, type ReviewRec } from "@/lib/lessons/types";

// Calendar entries that said "lesson" but matched no client.
//
// Nothing here is counted until it is answered. The sync shows what it
// stripped the title down to, and suggests clients whose names appear in it -
// but it only pre-selects on an exact match. "adrian moreno wife" is not an
// exact match for Adrian Moreno, and should not be treated as one: it might be
// his lesson or his wife's, and only Ian knows which.

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function ReviewQueue({
  items,
  clients,
}: {
  items: ReviewRec[];
  clients: { id: string; name: string }[];
}) {
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  if (!items.length) {
    return (
      <p className="empty">
        Nothing to review. Calendar entries that mention a lesson but match no
        client will appear here.
      </p>
    );
  }

  const one = items.length === 1;

  return (
    <>
      <p className="lead">
        {items.length} calendar {one ? "entry" : "entries"} {one ? "mentions" : "mention"}{" "}
        a lesson but {one ? "does" : "do"} not match a client. Until you answer,{" "}
        {one ? "it is" : "they are"} counted nowhere.
      </p>

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      <div className="stack" style={{ marginTop: 12 }}>
        {items.map((r) => (
          <ReviewCard
            key={r.calendarUid}
            item={r}
            clients={clients}
            onNote={setNote}
          />
        ))}
      </div>
    </>
  );
}

function ReviewCard({
  item,
  clients,
  onNote,
}: {
  item: ReviewRec;
  clients: { id: string; name: string }[];
  onNote: (n: { kind: "ok" | "err"; text: string }) => void;
}) {
  // Offer the obvious candidates: any client whose name appears inside the
  // stripped title, longest first. Suggested, never applied on its own.
  const suggestions = useMemo(() => {
    const bare = norm(item.guessName ?? item.titleRaw);
    return clients
      .filter((c) => bare.includes(norm(c.name)))
      .sort((a, b) => b.name.length - a.name.length)
      .slice(0, 3);
  }, [clients, item.guessName, item.titleRaw]);

  const exact = useMemo(() => {
    const bare = norm(item.guessName ?? "");
    return bare ? clients.find((c) => norm(c.name) === bare) : undefined;
  }, [clients, item.guessName]);

  const [choice, setChoice] = useState(item.guessClientId ?? exact?.id ?? "");
  const [newName, setNewName] = useState("");
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
      <strong>{item.titleRaw}</strong>
      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
        {formatWhen(item.startsAt)}
      </div>
      {item.guessName && (
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          Read as: {item.guessName}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="lb-actions" style={{ gap: 6, marginTop: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Looks like:
          </span>
          {suggestions.map((s) => (
            <button
              key={s.id}
              className={s.id === choice ? "btn small" : "btn ghost small"}
              disabled={busy}
              onClick={() => {
                setChoice(s.id);
                setNewName("");
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="lb-actions" style={{ marginTop: 10 }}>
        <select
          className="field"
          value={choice}
          disabled={busy}
          onChange={(e) => setChoice(e.target.value)}
          style={{ flex: "1 1 200px" }}
        >
          <option value="">New client&hellip;</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {choice === "" && (
          <input
            className="field"
            placeholder="Client name"
            value={newName}
            disabled={busy}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: "1 1 160px" }}
          />
        )}
      </div>

      <div className="lb-actions" style={{ marginTop: 10 }}>
        <button
          className="btn small"
          disabled={busy || (choice === "" && !newName.trim())}
          onClick={() =>
            answer(
              () =>
                resolveReview(
                  item.calendarUid,
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
            answer(
              () => dismissReview(item.calendarUid),
              "Dismissed - it will not be asked about again.",
            )
          }
        >
          Not a lesson
        </button>
      </div>
    </div>
  );
}
