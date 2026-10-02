"use client";

import { useMemo, useState, useTransition } from "react";
import {
  dismissReview,
  linkReviews,
  resolveReview,
} from "@/lib/lessons/actions";
import { formatDay, formatWhen, type ReviewRec } from "@/lib/lessons/types";

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

export type ReviewMatches = Record<
  string,
  { lessonId: string; clientId: string; clientName: string }
>;

export default function ReviewQueue({
  items,
  clients,
  matches,
}: {
  items: ReviewRec[];
  clients: { id: string; name: string }[];
  /** calendar uid -> the lesson already in the book that entry is. */
  matches: ReviewMatches;
}) {
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [linked, setLinked] = useState<Set<string>>(new Set());

  // Entries that are lessons already in the book, grouped by whose lesson
  // they are - one tap links a whole group. The rest need a real answer.
  const { groups, rest } = useMemo(() => {
    const byClient = new Map<
      string,
      { clientId: string; clientName: string; items: ReviewRec[] }
    >();
    const loose: ReviewRec[] = [];
    for (const it of items) {
      if (linked.has(it.calendarUid)) continue;
      const m = matches[it.calendarUid];
      if (!m) {
        loose.push(it);
        continue;
      }
      const g = byClient.get(m.clientId) ?? {
        clientId: m.clientId,
        clientName: m.clientName,
        items: [],
      };
      g.items.push(it);
      byClient.set(m.clientId, g);
    }
    return {
      groups: [...byClient.values()].sort(
        (a, b) => b.items.length - a.items.length,
      ),
      rest: loose,
    };
  }, [items, matches, linked]);

  const left = groups.reduce((t, g) => t + g.items.length, 0) + rest.length;
  if (!left) {
    return (
      <p className="empty">
        Nothing to review. Calendar entries that mention a lesson but match no
        client will appear here.
      </p>
    );
  }

  return (
    <>
      <p className="lead">
        {left} calendar {left === 1 ? "entry" : "entries"} the sync could not
        place.{" "}
        {groups.length > 0 &&
          "Most are lessons already in the book under a differently written title - link them and the sync recognises them from now on."}
      </p>

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      {groups.length > 0 && (
        <div className="stack" style={{ marginTop: 12 }}>
          {groups.map((g) => (
            <LinkGroup
              key={g.clientId}
              clientName={g.clientName}
              items={g.items}
              onDone={(uids, text) => {
                setLinked((s) => new Set([...s, ...uids]));
                setNote({ kind: "ok", text });
              }}
              onError={(text) => setNote({ kind: "err", text })}
            />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <>
          {groups.length > 0 && (
            <h2 className="section-title" style={{ marginTop: 26 }}>
              Needs an answer
            </h2>
          )}
          <div className="stack" style={{ marginTop: 12 }}>
            {rest.map((r) => (
              <ReviewCard
                key={r.calendarUid}
                item={r}
                clients={clients}
                onNote={setNote}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/**
 * "These N entries are Hoffman kids group's lessons, already in the book."
 * Linking stamps the calendar id on each existing lesson and clears the
 * entries; nothing new is created, so nothing is counted twice.
 */
function LinkGroup({
  clientName,
  items,
  onDone,
  onError,
}: {
  clientName: string;
  items: ReviewRec[];
  onDone: (uids: string[], text: string) => void;
  onError: (text: string) => void;
}) {
  const [busy, start] = useTransition();
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const n = items.length;

  function link() {
    const uids = items.map((i) => i.calendarUid);
    start(async () => {
      const r = await linkReviews(uids);
      if (!r.ok) {
        onError(r.error);
        return;
      }
      const { linked, skipped } = r.value;
      onDone(
        uids,
        `Linked ${linked} to ${clientName}'s lessons.` +
          (skipped ? ` ${skipped} could not be matched and stay in the queue.` : ""),
      );
    });
  }

  return (
    <div className="card lb-linkgroup">
      <div>
        <div>
          <div className="lb-name">{clientName}</div>
          <div className="lb-sub">
            {n} {n === 1 ? "entry" : "entries"} · already in the book
            {n > 1 &&
              ` · ${formatDay(first.startsAt)} – ${formatDay(last.startsAt)}`}
          </div>
        </div>
      </div>
      <details className="lb-dates">
        <summary>
          Show titles <span className="muted">({n})</span>
        </summary>
        <ul className="lb-dlist">
          {sorted.map((i) => (
            <li key={i.calendarUid}>
              <span className="lb-dwhen">
                {formatWhen(i.startsAt)}
                <span className="lb-sub" style={{ display: "block" }}>
                  {i.titleRaw}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </details>
      <div className="lb-actions" style={{ marginTop: 10 }}>
        <button className="btn small" disabled={busy} onClick={link}>
          {busy ? "Linking…" : n === 1 ? "Link" : `Link all ${n}`}
        </button>
      </div>
    </div>
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
