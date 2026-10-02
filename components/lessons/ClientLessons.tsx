"use client";

import { useMemo, useState, useTransition } from "react";
import { assignLessonToPackage, assignLessons } from "@/lib/lessons/actions";
import { seqLabel, suggestForPackage } from "@/lib/lessons/calc";
import {
  formatWhen,
  type NumberedLesson,
  type PackageRec,
} from "@/lib/lessons/types";

// A client's lessons, and the tools to put them into packages.
//
// 149 lessons arrived in no package because their calendar titles never said
// so. One dropdown per lesson works for a stray one; rebuilding a series
// needs more. Select mode ticks several at once and moves them in one write,
// and "Suggest" pre-ticks the likeliest ones - the oldest unassigned lessons
// from the day the package was sold, up to the room it has left. Nothing
// moves until Ian taps Move.

function pkgName(p: PackageRec): string {
  return `${p.label || `${p.size}-lesson`}${p.soldOn ? ` (${p.soldOn})` : ""}`;
}

const NOTHING_TO_SUGGEST =
  "Nothing to suggest — that package is full, or no unassigned lessons " +
  "fall after it was sold.";

export default function ClientLessons({
  clientId,
  packages,
  lessons,
  onNote,
}: {
  clientId: string;
  packages: PackageRec[];
  lessons: NumberedLesson[];
  onNote: (n: { kind: "ok" | "err"; text: string } | null) => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // The first package with room is the likeliest target.
  const firstWithRoom =
    packages.find((p) => !p.isComplete)?.id ?? packages[0]?.id ?? "";
  const [target, setTarget] = useState<string>(firstWithRoom);
  const [busy, start] = useTransition();

  const byId = useMemo(
    () => new Map(packages.map((p) => [p.id, p])),
    [packages],
  );
  const nameOf = (id: string | null) => {
    const p = id ? byId.get(id) : undefined;
    return p ? pkgName(p) : "one-offs";
  };

  function toggle(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function suggest() {
    const pkg = byId.get(target);
    if (!pkg) return;
    const ids = suggestForPackage(pkg, lessons);
    setPicked(new Set(ids));
    onNote(ids.length ? null : { kind: "err", text: NOTHING_TO_SUGGEST });
  }

  function move() {
    const ids = [...picked];
    const packageId = target === "" ? null : target;
    onNote(null);
    start(async () => {
      const r = await assignLessons(ids, packageId, clientId);
      if (!r.ok) {
        onNote({ kind: "err", text: r.error });
        return;
      }
      onNote({
        kind: "ok",
        text: `Moved ${r.value} lesson${r.value === 1 ? "" : "s"} to ${nameOf(packageId)}.`,
      });
      setPicked(new Set());
      setSelecting(false);
    });
  }

  function moveOne(lessonId: string, packageId: string | null) {
    onNote(null);
    start(async () => {
      const r = await assignLessonToPackage(lessonId, packageId, clientId);
      if (!r.ok) onNote({ kind: "err", text: r.error });
    });
  }

  if (lessons.length === 0) return <p className="empty">No lessons recorded.</p>;

  return (
    <>
      <div className="lb-sechead" style={{ marginTop: 0 }}>
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Newest first.{" "}
          {selecting
            ? "Tick lessons, pick a package, Move."
            : "Use a dropdown, or Select to move several at once."}
        </p>
        {packages.length > 0 && (
          <button
            type="button"
            className={selecting ? "btn secondary small" : "btn small"}
            onClick={() => {
              setSelecting((v) => !v);
              setPicked(new Set());
              onNote(null);
            }}
          >
            {selecting ? "Done" : "Select"}
          </button>
        )}
      </div>

      <div className="stack" style={{ marginTop: 12 }}>
        {lessons.map((l) => {
          const seq = seqLabel(l);
          const body = (
            <div style={{ minWidth: 0, flex: 1 }}>
              <strong>{formatWhen(l.startsAt)}</strong>
              {seq && seq !== "one-off" && (
                <span className="badge gray" style={{ marginLeft: 8 }}>
                  {seq}
                </span>
              )}
              {l.status !== "completed" && (
                <span className="badge gray" style={{ marginLeft: 8 }}>
                  {l.status === "scheduled"
                    ? "booked"
                    : l.status.replace("_", "-")}
                </span>
              )}
              {selecting && l.packageId && (
                <div className="lb-sub">in {nameOf(l.packageId)}</div>
              )}
              {/* The calendar title as Ian typed it - the best clue to which
                  series a lesson belonged to. */}
              {l.titleRaw && (
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {l.titleRaw}
                </div>
              )}
            </div>
          );

          return selecting ? (
            <label
              key={l.id}
              className={picked.has(l.id) ? "card lb-pick on" : "card lb-pick"}
            >
              <input
                type="checkbox"
                checked={picked.has(l.id)}
                onChange={() => toggle(l.id)}
              />
              {body}
            </label>
          ) : (
            <div className="card" key={l.id}>
              <div className="lb-lesson">
                {body}
                <select
                  className="field"
                  value={l.packageId ?? ""}
                  disabled={busy}
                  onChange={(e) => moveOne(l.id, e.target.value || null)}
                  aria-label="Package for this lesson"
                >
                  <option value="">One-off</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {pkgName(p)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {selecting && (
        <div
          className="lb-bulkbar"
          role="region"
          aria-label="Move selected lessons"
        >
          <span className="lb-bulkcount">{picked.size} selected</span>
          <select
            className="field"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Move to"
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {pkgName(p)} · {p.used}/{p.size}
              </option>
            ))}
            <option value="">One-off (no package)</option>
          </select>
          <div className="lb-actions">
            <button
              type="button"
              className="btn secondary small"
              disabled={busy || target === ""}
              onClick={suggest}
            >
              Suggest
            </button>
            <button
              type="button"
              className="btn small"
              disabled={busy || picked.size === 0}
              onClick={move}
            >
              {busy ? "Moving…" : "Move"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
