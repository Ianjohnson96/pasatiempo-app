"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTier, moveTier, saveTier } from "@/lib/caddie/actions";
import type { TierRec } from "@/lib/caddie/types";

// The seniority ladder, in the club's own words.
//
// Order is the whole point: the tier at the top is offered loops first, so the
// list is arranged top-to-bottom in dispatch order and moved with arrows. No
// sort-order numbers on screen — nobody thinks "shop guys are a 10", they think
// "shop guys go first".

interface Props {
  tiers: TierRec[];
  /** Active caddies per tier id, so deleting a populated tier can be refused. */
  counts: Record<string, number>;
  untiered: number;
}

export default function TierManager({ tiers, counts, untiered }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string,
  ) {
    setNote(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (okMsg) setNote({ kind: "ok", text: okMsg });
        setEditing(null);
        setAdding(false);
        router.refresh();
      } else {
        setNote({ kind: "err", text: res.error ?? "Something went wrong." });
      }
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Caddie Tiers</h1>
          <div className="sub">
            Top of the list is offered loops first. {tiers.length}{" "}
            {tiers.length === 1 ? "tier" : "tiers"}.
          </div>
        </div>
        <button
          className="btn"
          onClick={() => {
            setAdding((a) => !a);
            setEditing(null);
            setNote(null);
          }}
        >
          {adding ? "Cancel" : "Add tier"}
        </button>
      </div>

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      {untiered > 0 && (
        <p className="notice warn">
          {untiered} active {untiered === 1 ? "caddie has" : "caddies have"} no
          tier, so they sort below everyone on the dispatch list. Set their tier
          on the Roster.
        </p>
      )}

      {adding && (
        <TierForm
          busy={busy}
          submitLabel="Add tier"
          onCancel={() => setAdding(false)}
          onSubmit={(v) => run(() => saveTier(v), `${v.name} added.`)}
        />
      )}

      {tiers.length === 0 ? (
        <div className="empty" style={{ marginTop: 18 }}>
          No tiers yet. Add the first one — it will be offered loops first.
        </div>
      ) : (
        <div className="evlist" style={{ marginTop: 18 }}>
          {tiers.map((tier, i) => {
            const count = counts[tier.id] ?? 0;
            const isEditing = editing === tier.id;

            return (
              <div key={tier.id} className="evrow" style={{ flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    marginRight: 12,
                  }}
                >
                  <button
                    className="btn ghost small"
                    disabled={busy || i === 0}
                    aria-label={`Move ${tier.name} up`}
                    onClick={() => run(() => moveTier(tier.id, "up"))}
                  >
                    ↑
                  </button>
                  <button
                    className="btn ghost small"
                    disabled={busy || i === tiers.length - 1}
                    aria-label={`Move ${tier.name} down`}
                    onClick={() => run(() => moveTier(tier.id, "down"))}
                  >
                    ↓
                  </button>
                </div>

                <div className="ev-main" style={{ minWidth: 0 }}>
                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <span className="ev-title">{tier.name}</span>
                    {i === 0 && <span className="badge open">goes first</span>}
                  </div>
                  <div className="ev-meta">
                    <span>
                      {count} active {count === 1 ? "caddie" : "caddies"}
                    </span>
                    {tier.description && <span>{tier.description}</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    className="btn secondary small"
                    onClick={() => {
                      setEditing(isEditing ? null : tier.id);
                      setAdding(false);
                      setNote(null);
                    }}
                  >
                    {isEditing ? "Close" : "Rename"}
                  </button>
                  <button
                    className="btn ghost small"
                    disabled={busy}
                    onClick={() =>
                      run(() => deleteTier(tier.id), `${tier.name} removed.`)
                    }
                  >
                    Delete
                  </button>
                </div>

                {isEditing && (
                  <div style={{ flexBasis: "100%" }}>
                    <TierForm
                      initial={tier}
                      busy={busy}
                      submitLabel="Save"
                      onCancel={() => setEditing(null)}
                      onSubmit={(v) =>
                        run(() => saveTier({ ...v, id: tier.id }), "Saved.")
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="muted" style={{ fontSize: 13, marginTop: 18 }}>
        Tiers drive who gets offered a loop first. Within a tier, whoever has
        waited longest since their last loop comes up next.
      </p>
    </>
  );
}

function TierForm({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: TierRec;
  busy: boolean;
  submitLabel: string;
  onSubmit: (v: { name: string; description: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  return (
    <form
      className="card"
      style={{ marginTop: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, description });
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <label style={{ flex: "0 0 auto" }}>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
            Tier name
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Shop guys"
            style={{ ...inputStyle, width: 200 }}
          />
        </label>
        <label style={{ flex: "1 1 220px" }}>
          <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
            Note (optional)
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Who belongs in this tier"
            style={{ ...inputStyle, width: "100%" }}
          />
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn ghost small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 15,
};
