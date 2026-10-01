"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatDay, money, type ClientSummary } from "@/lib/lessons/types";

// The roster. Sorted by who owes money first, because that is the question
// this screen exists to answer; alphabetical is there for looking somebody up.

type Sort = "owed" | "name" | "recent";

export default function ClientList({ clients }: { clients: ClientSummary[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("owed");
  const [showInactive, setShowInactive] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients
      .filter((c) => {
        if (!showInactive && !c.active) return false;
        return !needle || c.name.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "recent")
          return (b.lastLessonAt ?? "").localeCompare(a.lastLessonAt ?? "");
        if (b.owedCents !== a.owedCents) return b.owedCents - a.owedCents;
        return a.name.localeCompare(b.name);
      });
  }, [clients, q, sort, showInactive]);

  return (
    <>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input
          className="field"
          type="search"
          placeholder="Find a client"
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

      <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
        {shown.length} of {clients.length}
      </p>

      {shown.length === 0 && <p className="empty">Nobody matches that.</p>}

      <div className="stack" style={{ marginTop: 6 }}>
        {shown.map((c) => (
          <Link
            key={c.id}
            href={`/lessons/clients/${c.id}`}
            className="card"
            style={{ display: "block", textDecoration: "none" }}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                gap: 12,
                alignItems: "baseline",
              }}
            >
              <div>
                <strong style={{ fontSize: 16 }}>{c.name}</strong>
                {c.isMember && (
                  <span className="badge gray" style={{ marginLeft: 8 }}>
                    Member
                  </span>
                )}
                {!c.active && (
                  <span className="badge gray" style={{ marginLeft: 8 }}>
                    Inactive
                  </span>
                )}
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {c.totalLessons} lesson{c.totalLessons === 1 ? "" : "s"}
                  {c.packageCount > 0 &&
                    ` · ${c.packageCount} package${c.packageCount === 1 ? "" : "s"}`}
                  {c.lastLessonAt && ` · last ${formatDay(c.lastLessonAt)}`}
                </div>
              </div>
              <div style={{ textAlign: "right", fontWeight: 700 }}>
                {c.owedCents > 0 ? (
                  money(c.owedCents)
                ) : (
                  <span className="muted" style={{ fontWeight: 400 }}>
                    &mdash;
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
