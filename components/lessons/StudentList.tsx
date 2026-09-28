"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updateStudent } from "@/lib/lessons/actions";
import { formatDay, money, type StudentSummary } from "@/lib/lessons/types";

// The roster: who Ian teaches, how much they have had, and what they owe.
//
// Sorted by what is owed by default, because that is the question the screen
// exists to answer. Students who are square fall to the bottom.

type Sort = "owed" | "name" | "recent";

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 2,
};

export default function StudentList({
  students,
  totals,
}: {
  students: StudentSummary[];
  totals: { lessons: number; unpriced: number; owed: number; paidTotal: number };
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("owed");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = students.filter((s) => {
      if (!showInactive && !s.active) return false;
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.aliases.some((a) => a.toLowerCase().includes(needle)) ||
        (s.email ?? "").toLowerCase().includes(needle)
      );
    });
    return list.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "recent")
        return (b.lastLesson ?? "").localeCompare(a.lastLesson ?? "");
      // Owed first, then the ones still missing a price - both are work to do.
      if (b.owed !== a.owed) return b.owed - a.owed;
      if (b.unpriced !== a.unpriced) return b.unpriced - a.unpriced;
      return a.name.localeCompare(b.name);
    });
  }, [students, q, sort, showInactive]);

  function save(id: string, patch: Parameters<typeof updateStudent>[1]) {
    setError(null);
    start(async () => {
      const r = await updateStudent(id, patch);
      if (!r.ok) setError(r.error);
      else setEditing(null);
    });
  }

  return (
    <>
      <div className="fin-stats" style={{ marginBottom: 18 }}>
        <div className="fin-stat">
          <strong>{totals.lessons}</strong>
          <span>lessons taught</span>
        </div>
        <div className="fin-stat strong">
          <strong>{money(totals.owed)}</strong>
          <span>outstanding</span>
        </div>
        <div className="fin-stat">
          <strong>{money(totals.paidTotal)}</strong>
          <span>collected</span>
        </div>
        <div className="fin-stat">
          <strong>{totals.unpriced}</strong>
          <span>need a price</span>
        </div>
      </div>

      {totals.unpriced > 0 && (
        <p className="notice warn">
          {totals.unpriced} lesson{totals.unpriced === 1 ? "" : "s"} have no
          price set, so they are not counted in what is owed.{" "}
          <Link href="/lessons/log?filter=unpriced">Price them now</Link>.
        </p>
      )}

      {error && <p className="notice err">{error}</p>}

      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <input
          className="field"
          type="search"
          placeholder="Find a student"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 200px", minWidth: 160 }}
        />
        <select
          className="field"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
        >
          <option value="owed">Owes most</option>
          <option value="name">Name</option>
          <option value="recent">Most recent</option>
        </select>
        <label className="check" style={{ whiteSpace: "nowrap" }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />{" "}
          Show inactive
        </label>
      </div>

      {shown.length === 0 && (
        <p className="empty">
          {students.length === 0
            ? "No students yet. Push from the Lesson App sheet to bring the roster in."
            : "Nobody matches that."}
        </p>
      )}

      <div className="stack" style={{ marginTop: 12 }}>
        {shown.map((s) => (
          <div className="card" key={s.id}>
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <div>
                <strong style={{ fontSize: 16 }}>{s.name}</strong>
                {!s.active && (
                  <span className="badge gray" style={{ marginLeft: 8 }}>
                    Inactive
                  </span>
                )}
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {s.lessons} lesson{s.lessons === 1 ? "" : "s"}
                  {s.lastLesson && ` · last ${formatDay(s.lastLesson)}`}
                  {s.unpriced > 0 && ` · ${s.unpriced} unpriced`}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  {s.owed > 0 ? (
                    money(s.owed)
                  ) : (
                    <span className="muted">Settled</span>
                  )}
                </div>
                {s.paidTotal > 0 && (
                  <div className="muted" style={{ fontSize: 12 }}>
                    {money(s.paidTotal)} paid
                  </div>
                )}
              </div>
            </div>

            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Link
                className="btn secondary small"
                href={`/lessons/log?student=${encodeURIComponent(s.id)}`}
              >
                Lessons
              </Link>
              <button
                className="btn ghost small"
                onClick={() => setEditing(editing === s.id ? null : s.id)}
              >
                {editing === s.id ? "Close" : "Details"}
              </button>
            </div>

            {editing === s.id && (
              <StudentEditor
                student={s}
                busy={busy}
                onSave={(patch) => save(s.id, patch)}
              />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function StudentEditor({
  student,
  busy,
  onSave,
}: {
  student: StudentSummary;
  busy: boolean;
  onSave: (patch: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    notes?: string;
    active?: boolean;
  }) => void;
}) {
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email ?? "");
  const [phone, setPhone] = useState(student.phone ?? "");
  const [notes, setNotes] = useState(student.notes);

  return (
    <div className="stack" style={{ marginTop: 12, gap: 8 }}>
      <div className="divider" />
      <label>
        <span style={LABEL}>Name</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        <span style={LABEL}>Email</span>
        <input
          className="field"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="none on file"
        />
      </label>
      <label>
        <span style={LABEL}>Phone</span>
        <input
          className="field"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="none on file"
        />
      </label>
      <label>
        <span style={LABEL}>Notes</span>
        <textarea
          className="field"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {/* Other spellings the calendar has used. Shown but not editable:
          matching future lessons depends on them, and a typo here would
          quietly orphan them. */}
      {student.aliases.length > 0 && (
        <p className="muted" style={{ fontSize: 12 }}>
          Also seen as: {student.aliases.join(", ")}
        </p>
      )}

      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button
          className="btn small"
          disabled={busy}
          onClick={() => onSave({ name, email, phone, notes })}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          className="btn ghost small"
          disabled={busy}
          onClick={() => onSave({ active: !student.active })}
        >
          {student.active ? "Mark inactive" : "Mark active"}
        </button>
      </div>
    </div>
  );
}
