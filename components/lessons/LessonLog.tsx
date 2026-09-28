"use client";

import { useMemo, useState, useTransition } from "react";
import {
  markPaidBulk,
  setAmountBulk,
  setLessonAmount,
  setLessonPaid,
  voidLesson,
} from "@/lib/lessons/actions";
import {
  formatWhen,
  money,
  seriesLabel,
  type LessonRec,
} from "@/lib/lessons/types";

// Every lesson, newest first, with its own price and paid tick.
//
// The two filters that matter are "needs a price" and "unpaid": between them
// they are the whole of the month-end job. Bulk select exists because the
// realistic case is twenty lessons at the same rate, and ticking those one at a
// time is how a book stops getting kept.

export type Filter = "all" | "unpriced" | "unpaid" | "paid";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpriced", label: "Needs a price" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
];

export default function LessonLog({
  lessons,
  students,
  initialFilter = "all",
  initialStudent = "",
}: {
  lessons: LessonRec[];
  students: { id: string; name: string }[];
  initialFilter?: Filter;
  initialStudent?: string;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [student, setStudent] = useState(initialStudent);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState("");
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, start] = useTransition();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lessons.filter((l) => {
      if (student && l.studentId !== student) return false;
      if (filter === "unpriced" && !(l.amount === null && l.status === "delivered"))
        return false;
      if (filter === "unpaid" && (l.paid || l.status !== "delivered")) return false;
      if (filter === "paid" && !l.paid) return false;
      if (needle) {
        return (
          l.studentName.toLowerCase().includes(needle) ||
          l.title.toLowerCase().includes(needle)
        );
      }
      return true;
    });
  }, [lessons, filter, student, q]);

  // Only what is on screen can be acted on in bulk: a selection that survived a
  // filter change would price lessons Ian can no longer see.
  const visiblePicked = useMemo(
    () => shown.filter((l) => picked.has(l.id)).map((l) => l.id),
    [shown, picked],
  );

  const shownTotal = useMemo(() => {
    let owed = 0;
    let unpriced = 0;
    for (const l of shown) {
      if (l.status !== "delivered") continue;
      if (l.amount === null) unpriced += 1;
      else if (!l.paid) owed += l.amount;
    }
    return { owed, unpriced };
  }, [shown]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    done?: string,
  ) {
    setNote(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setNote({ kind: "err", text: r.error ?? "That did not work." });
      else if (done) setNote({ kind: "ok", text: done });
    });
  }

  return (
    <>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <div className="seg">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={f.key === filter ? "segbtn on" : "segbtn"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <select
          className="field"
          value={student}
          onChange={(e) => setStudent(e.target.value)}
        >
          <option value="">Everyone</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="field"
          type="search"
          placeholder="Search titles"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 180px", minWidth: 150 }}
        />
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
        {shown.length} lesson{shown.length === 1 ? "" : "s"}
        {shownTotal.owed > 0 && ` · ${money(shownTotal.owed)} outstanding`}
        {shownTotal.unpriced > 0 && ` · ${shownTotal.unpriced} need a price`}
      </p>

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      {visiblePicked.length > 0 && (
        <div className="card" style={{ marginTop: 10 }}>
          <div
            className="row"
            style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}
          >
            <strong>{visiblePicked.length} selected</strong>
            <input
              className="field"
              type="number"
              min="0"
              step="5"
              inputMode="decimal"
              placeholder="Price each"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              style={{ width: 120 }}
            />
            <button
              className="btn small"
              disabled={busy || bulkPrice === ""}
              onClick={() =>
                run(
                  () => setAmountBulk(visiblePicked, Number(bulkPrice)),
                  `Priced ${visiblePicked.length} at ${money(Number(bulkPrice))}.`,
                )
              }
            >
              Set price
            </button>
            <button
              className="btn secondary small"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await markPaidBulk(visiblePicked);
                  if (!r.ok) setNote({ kind: "err", text: r.error });
                  else
                    setNote({
                      kind: "ok",
                      // Says how many actually moved: unpriced lessons are
                      // skipped, and implying otherwise would overstate what
                      // has been collected.
                      text:
                        r.value === visiblePicked.length
                          ? `Marked ${r.value} paid.`
                          : `Marked ${r.value} paid. ${visiblePicked.length - r.value} had no price and were left alone.`,
                    });
                })
              }
            >
              Mark paid
            </button>
            <button
              className="btn ghost small"
              onClick={() => setPicked(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {shown.length === 0 && (
        <p className="empty">
          {lessons.length === 0
            ? "No lessons yet. Push from the Lesson App sheet to bring them in."
            : "Nothing matches those filters."}
        </p>
      )}

      <div className="stack" style={{ marginTop: 12 }}>
        {shown.map((l) => (
          <LessonRow
            key={l.id}
            lesson={l}
            picked={picked.has(l.id)}
            busy={busy}
            onToggle={() => toggle(l.id)}
            onPrice={(amt) => run(() => setLessonAmount(l.id, amt))}
            onPaid={(p) => run(() => setLessonPaid(l.id, p))}
            onVoid={() => run(() => voidLesson(l.id), "Removed from the book.")}
          />
        ))}
      </div>
    </>
  );
}

function LessonRow({
  lesson: l,
  picked,
  busy,
  onToggle,
  onPrice,
  onPaid,
  onVoid,
}: {
  lesson: LessonRec;
  picked: boolean;
  busy: boolean;
  onToggle: () => void;
  onPrice: (amount: number | null) => void;
  onPaid: (paid: boolean) => void;
  onVoid: () => void;
}) {
  const [price, setPrice] = useState(l.amount === null ? "" : String(l.amount));
  const series = seriesLabel(l);

  // Commit on blur or Enter only: saving per keystroke would fire a write for
  // every digit of "120".
  function commit() {
    const trimmed = price.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && !isFinite(next)) return;
    if (next === l.amount) return;
    onPrice(next);
  }

  return (
    <div className="card">
      <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={picked}
          onChange={onToggle}
          aria-label={`Select ${l.studentName} on ${formatWhen(l.startsAt)}`}
          style={{ marginTop: 4 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", gap: 8 }}
          >
            <strong>{l.studentName}</strong>
            {series && <span className="pill">{series}</span>}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {formatWhen(l.startsAt)} &middot; {l.minutes} min
          </div>
          {l.title && (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {l.title}
            </div>
          )}

          <div
            className="row"
            style={{
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              className="field"
              type="number"
              min="0"
              step="5"
              inputMode="decimal"
              placeholder="Price"
              value={price}
              disabled={busy}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              style={{ width: 100 }}
            />
            <button
              className={l.paid ? "btn small" : "btn secondary small"}
              disabled={busy}
              onClick={() => onPaid(!l.paid)}
            >
              {l.paid ? "✓ Paid" : "Mark paid"}
            </button>
            {l.amount === null && l.status === "delivered" && (
              <span className="badge draft">No price</span>
            )}
            {l.status === "scheduled" && (
              <span className="badge gray">Upcoming</span>
            )}
            <span style={{ flex: 1 }} />
            <button
              className="btn ghost small"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Remove this lesson for ${l.studentName} from the book?`,
                  )
                )
                  onVoid();
              }}
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
