"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import PackageCard from "./PackageCard";
import {
  assignLessonToPackage,
  createPackage,
  updateClient,
} from "@/lib/lessons/actions";
import { seqLabel } from "@/lib/lessons/calc";
import {
  formatWhen,
  money,
  type ClientRec,
  type NumberedLesson,
  type PackageRec,
} from "@/lib/lessons/types";

// One client: their packages, their lesson history, and the controls to put
// the two together.
//
// Attaching a lesson to a package is the important one. 149 lessons arrived
// with no package because their calendar titles never said so - Patsy Leung's
// 14 and Fred Caiocca's 12 are almost certainly series nobody labelled. This
// is where that gets rebuilt, one lesson at a time, by the person who knows.

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 2,
};

export default function ClientDetail({
  client,
  packages,
  lessons,
}: {
  client: ClientRec;
  packages: PackageRec[];
  lessons: NumberedLesson[];
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [busy, start] = useTransition();

  // Owed is unpaid only; a pending member charge is in flight, not owed.
  const pending = packages
    .filter((p) => p.paymentStatus === "pending")
    .reduce((t, p) => t + (p.priceCents ?? 0), 0);
  const owed = packages
    .filter((p) => p.paymentStatus === "unpaid")
    .reduce((t, p) => t + (p.priceCents ?? 0), 0);
  const unpriced = packages.filter((p) => p.priceCents === null).length;
  const oneOffs = lessons.filter((l) => !l.packageId).length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setNote(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setNote({ kind: "err", text: r.error ?? "That did not work." });
      else if (ok) setNote({ kind: "ok", text: ok });
    });
  }

  return (
    <>
      <p style={{ marginBottom: 6 }}>
        <Link href="/lessons/clients" className="muted">
          &larr; All clients
        </Link>
      </p>

      <div className="lb-head">
        <div>
          <h1 style={{ fontSize: 24, margin: 0, overflowWrap: "anywhere" }}>
            {client.name}
          </h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
            {packages.length > 0 &&
              ` · ${packages.length} package${packages.length === 1 ? "" : "s"}`}
            {oneOffs > 0 && ` · ${oneOffs} not in a package`}
          </div>
          {client.aliases.length > 0 && (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Also seen as: {client.aliases.join(", ")}
            </div>
          )}
        </div>
        <div>
          {owed > 0 && <div style={{ fontWeight: 700 }}>{money(owed)} owed</div>}
          {pending > 0 && (
            <div className="muted" style={{ fontSize: 13 }}>
              {money(pending)} pending
            </div>
          )}
          {unpriced > 0 && (
            <div className="muted" style={{ fontSize: 12 }}>
              {unpriced} package{unpriced === 1 ? "" : "s"} unpriced
            </div>
          )}
        </div>
      </div>

      <div className="lb-actions" style={{ marginTop: 10 }}>
        <button
          className="btn secondary small"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Close" : "Details"}
        </button>
        <NewPackage
          busy={busy}
          onCreate={(size, dollars) =>
            run(
              () => createPackage(client.id, { size, dollars }),
              `Added a ${size}-lesson package.`,
            )
          }
        />
      </div>

      {note && (
        <p
          className={note.kind === "ok" ? "notice ok" : "notice err"}
          style={{ marginTop: 10 }}
        >
          {note.text}
        </p>
      )}

      {editing && (
        <Editor
          client={client}
          busy={busy}
          onSave={(patch) => run(() => updateClient(client.id, patch), "Saved.")}
        />
      )}

      <h2 className="section-title" style={{ marginTop: 24 }}>
        Packages
      </h2>
      {packages.length === 0 ? (
        <p className="empty">No packages. Every lesson here is a one-off.</p>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          {packages.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              lessons={lessons.filter((l) => l.packageId === p.id)}
            />
          ))}
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: 26 }}>
        Lessons
      </h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Newest first. Use the dropdown to move a lesson into a package.
      </p>
      {lessons.length === 0 ? (
        <p className="empty">No lessons recorded.</p>
      ) : (
        <div className="stack" style={{ marginTop: 12 }}>
          {lessons.map((l) => (
            <div className="card" key={l.id}>
              <div className="lb-lesson">
                <div style={{ minWidth: 0 }}>
                  <strong>{formatWhen(l.startsAt)}</strong>
                  {seqLabel(l) && seqLabel(l) !== "one-off" && (
                    <span className="badge gray" style={{ marginLeft: 8 }}>
                      {seqLabel(l)}
                    </span>
                  )}
                  {l.status !== "completed" && (
                    <span className="badge gray" style={{ marginLeft: 8 }}>
                      {l.status === "scheduled" ? "booked" : l.status.replace("_", "-")}
                    </span>
                  )}
                  {/* The calendar title as Ian typed it. Kept visible because
                      it is the only clue to which series a lesson belonged to. */}
                  {l.titleRaw && (
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      {l.titleRaw}
                    </div>
                  )}
                </div>
                <select
                  className="field"
                  value={l.packageId ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    run(() =>
                      assignLessonToPackage(
                        l.id,
                        e.target.value || null,
                        client.id,
                      ),
                    )
                  }
                  aria-label="Package for this lesson"
                >
                  <option value="">One-off</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label || `${p.size}-lesson`}
                      {p.soldOn ? ` (${p.soldOn})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function NewPackage({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (size: number, dollars: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState("5");
  const [dollars, setDollars] = useState("");

  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        New package
      </button>
    );
  }

  return (
    <span className="lb-actions">
      <input
        className="field"
        type="number"
        min="1"
        max="50"
        value={size}
        onChange={(e) => setSize(e.target.value)}
        style={{ width: 70 }}
        aria-label="Lessons in the package"
      />
      <input
        className="field"
        type="number"
        min="0"
        step="10"
        placeholder="Price $"
        value={dollars}
        onChange={(e) => setDollars(e.target.value)}
        style={{ width: 100 }}
      />
      <button
        className="btn small"
        disabled={busy || !Number.isInteger(Number(size))}
        onClick={() => {
          onCreate(Number(size), dollars.trim() === "" ? null : Number(dollars));
          setOpen(false);
          setDollars("");
        }}
      >
        Add
      </button>
      <button className="btn ghost small" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </span>
  );
}

function Editor({
  client,
  busy,
  onSave,
}: {
  client: ClientRec;
  busy: boolean;
  onSave: (patch: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    memberNumber?: string | null;
    isMember?: boolean;
    active?: boolean;
    notes?: string | null;
  }) => void;
}) {
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [memberNumber, setMemberNumber] = useState(client.memberNumber ?? "");
  const [isMember, setIsMember] = useState(client.isMember);
  const [notes, setNotes] = useState(client.notes ?? "");

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="stack" style={{ gap: 8 }}>
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
          <span style={LABEL}>Member number</span>
          <input
            className="field"
            value={memberNumber}
            onChange={(e) => setMemberNumber(e.target.value)}
            placeholder="not a member"
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={isMember}
            onChange={(e) => setIsMember(e.target.checked)}
          />{" "}
          Club member (can charge to their account)
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

        <div className="lb-actions">
          <button
            className="btn small"
            disabled={busy}
            onClick={() =>
              onSave({ name, email, phone, memberNumber, isMember, notes })
            }
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            className="btn ghost small"
            disabled={busy}
            onClick={() => onSave({ active: !client.active })}
          >
            {client.active ? "Mark inactive" : "Mark active"}
          </button>
        </div>
      </div>
    </div>
  );
}
