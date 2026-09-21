"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInvite,
  deleteCaddie,
  saveCaddie,
  setCaddieTier,
  setCaddieStatus,
  type CaddieInput,
  type InviteHandout,
} from "@/lib/caddie/actions";
import {
  CADDIE_STATUSES,
  CONTACT_METHODS,
  type CaddieRec,
  type CaddieStatus,
  type ContactMethod,
  type TierRec,
} from "@/lib/caddie/types";

// The caddie roster. Nothing else in the section works until this has rows in
// it — a loop with no one to offer it to is just a note to self.

interface Props {
  caddies: CaddieRec[];
  tiers: TierRec[];
}

const STATUS_BADGE: Record<CaddieStatus, string> = {
  Active: "badge open",
  Inactive: "badge gray",
  Suspended: "badge closed",
};

const BLANK: CaddieInput = {
  fullName: "",
  phone: "",
  email: "",
  tierId: null,
  status: "Active",
  preferredContactMethod: "Both",
  notes: "",
};

export default function RosterManager({ caddies, tiers }: Props) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [invite, setInvite] = useState<
    { caddie: CaddieRec; handout: InviteHandout } | null
  >(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const active = caddies.filter((c) => c.status === "Active").length;

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg?: string,
  ) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (okMsg) setNote({ kind: "ok", text: okMsg });
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
          <h1>Caddie Roster</h1>
          <div className="sub">
            {caddies.length} on the roster · {active} active
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
          {adding ? "Cancel" : "Add caddie"}
        </button>
      </div>

      {note && (
        <p className={note.kind === "ok" ? "notice ok" : "notice err"}>
          {note.text}
        </p>
      )}

      {invite && (
        <InvitePanel
          caddieName={invite.caddie.fullName}
          handout={invite.handout}
          onClose={() => setInvite(null)}
        />
      )}

      {adding && (
        <CaddieForm
          initial={BLANK}
          tiers={tiers}
          busy={busy}
          submitLabel="Add caddie"
          onCancel={() => setAdding(false)}
          onSubmit={(input) =>
            start(async () => {
              const res = await saveCaddie(input);
              if (res.ok) {
                setNote({ kind: "ok", text: `${res.value.fullName} added.` });
                setAdding(false);
                router.refresh();
              } else {
                setNote({ kind: "err", text: res.error });
              }
            })
          }
        />
      )}

      {caddies.length === 0 ? (
        <div className="empty" style={{ marginTop: 18 }}>
          No caddies yet. Add the first one to start dispatching loops.
        </div>
      ) : (
        <div className="evlist" style={{ marginTop: 18 }}>
          {caddies.map((c) => {
            const isEditing = editing === c.id;
            return (
              <div key={c.id} className="evrow" style={{ flexWrap: "wrap" }}>
                <div className="ev-main" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="ev-title">{c.fullName}</span>
                    <span className={STATUS_BADGE[c.status]}>{c.status}</span>

                    {/* Tier, changed in place. Promoting a caddie is something
                        the shop does often and should not need a form. */}
                    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                      {tiers.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          disabled={busy || c.tierId === t.id}
                          aria-pressed={c.tierId === t.id}
                          aria-label={`Move ${c.fullName} to ${t.name}`}
                          className={
                            c.tierId === t.id ? "btn small" : "btn ghost small"
                          }
                          onClick={() =>
                            run(
                              () => setCaddieTier(c.id, t.id),
                              `${c.fullName} is now ${t.name}.`,
                            )
                          }
                        >
                          {t.name}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div className="ev-meta">
                    {c.phone && <span>{formatPhone(c.phone)}</span>}
                    {c.email && <span>{c.email}</span>}
                    <span>contact by {c.preferredContactMethod}</span>
                    <span>
                      {c.lastWorkedOn
                        ? `last loop ${c.lastWorkedOn}`
                        : "no loops yet"}
                    </span>
                    {c.notes && <span>{c.notes}</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {c.status === "Active" && (
                    <button
                      className="btn small"
                      disabled={busy}
                      onClick={() =>
                        start(async () => {
                          setNote(null);
                          const res = await createInvite(c.id);
                          if (res.ok) setInvite({ caddie: c, handout: res.value });
                          else setNote({ kind: "err", text: res.error });
                        })
                      }
                    >
                      Sign-in link
                    </button>
                  )}
                  <button
                    className="btn secondary small"
                    onClick={() => {
                      setEditing(isEditing ? null : c.id);
                      setAdding(false);
                      setNote(null);
                    }}
                  >
                    {isEditing ? "Close" : "Edit"}
                  </button>
                  {c.status === "Active" ? (
                    <button
                      className="btn ghost small"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => setCaddieStatus(c.id, "Inactive"),
                          `${c.fullName} is now inactive.`,
                        )
                      }
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      className="btn ghost small"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => setCaddieStatus(c.id, "Active"),
                          `${c.fullName} is back on the active list.`,
                        )
                      }
                    >
                      Reactivate
                    </button>
                  )}
                </div>

                {isEditing && (
                  <div style={{ flexBasis: "100%" }}>
                    <CaddieForm
                      tiers={tiers}
                      initial={{
                        id: c.id,
                        fullName: c.fullName,
                        phone: c.phone ?? "",
                        email: c.email ?? "",
                        tierId: c.tierId,
                        status: c.status,
                        preferredContactMethod: c.preferredContactMethod,
                        notes: c.notes,
                      }}
                      busy={busy}
                      submitLabel="Save changes"
                      onCancel={() => setEditing(null)}
                      onDelete={() =>
                        run(
                          () => deleteCaddie(c.id),
                          `${c.fullName} removed from the roster.`,
                        )
                      }
                      onSubmit={(input) =>
                        start(async () => {
                          const res = await saveCaddie(input);
                          if (res.ok) {
                            setNote({ kind: "ok", text: "Saved." });
                            setEditing(null);
                            router.refresh();
                          } else {
                            setNote({ kind: "err", text: res.error });
                          }
                        })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The handout. Shown on the counter screen for the caddie to scan.
// ---------------------------------------------------------------------------

function InvitePanel({
  caddieName,
  handout,
  onClose,
}: {
  caddieName: string;
  handout: InviteHandout;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 190,
            height: 190,
            background: "#fff",
            borderRadius: 10,
            padding: 8,
            flex: "0 0 auto",
          }}
          // Machine-generated vector data, not user content: the qrcode
          // package emits <path> elements on the server from a URL this app
          // builds itself. The encoded text never reaches the DOM as markup,
          // so there is nothing here for an injection to ride in on.
          dangerouslySetInnerHTML={{ __html: handout.qrSvg }}
        />

        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div className="ev-title" style={{ fontSize: 18 }}>
            Sign-in link for {caddieName}
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            Have them scan this with their phone camera. It signs them in for
            90 days, works once, and expires{" "}
            {new Date(handout.expiresAt).toLocaleDateString()}. Creating a new
            link cancels this one.
          </p>

          <div
            style={{
              marginTop: 10,
              padding: "8px 10px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "var(--panel)",
              fontSize: 12,
              wordBreak: "break-all",
            }}
          >
            {handout.url}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              className="btn secondary small"
              onClick={() => {
                navigator.clipboard?.writeText(handout.url).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  },
                  () => setCopied(false),
                );
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button className="btn ghost small" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CaddieForm({
  initial,
  tiers,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial: CaddieInput;
  tiers: TierRec[];
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: CaddieInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<CaddieInput>(initial);
  const set = <K extends keyof CaddieInput>(k: K, v: CaddieInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="card"
      style={{ marginTop: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
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
        <Field label="Name" grow>
          <input
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            required
            placeholder="Full name"
            style={{ ...inputStyle, minWidth: 180, width: "100%" }}
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="831 459 9155"
            inputMode="tel"
            style={{ ...inputStyle, width: 160 }}
          />
        </Field>
        <Field label="Email" grow>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="optional"
            style={{ ...inputStyle, minWidth: 180, width: "100%" }}
          />
        </Field>
        <Field label="Tier">
          <select
            value={form.tierId ?? ""}
            onChange={(e) => set("tierId", e.target.value || null)}
            style={{ ...inputStyle, width: 150 }}
          >
            <option value="">No tier</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as CaddieStatus)}
            style={{ ...inputStyle, width: 120 }}
          >
            {CADDIE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contact by">
          <select
            value={form.preferredContactMethod}
            onChange={(e) =>
              set("preferredContactMethod", e.target.value as ContactMethod)
            }
            style={{ ...inputStyle, width: 110 }}
          >
            {CONTACT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note" grow>
          <input
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional"
            style={{ ...inputStyle, minWidth: 160, width: "100%" }}
          />
        </Field>
      </div>

      <div
        style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}
      >
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn ghost small" onClick={onCancel}>
          Cancel
        </button>
        <span style={{ flex: 1 }} />
        {onDelete && (
          <button
            type="button"
            className="btn danger small"
            disabled={busy}
            onClick={onDelete}
          >
            Remove
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <label style={{ display: "block", flex: grow ? "1 1 170px" : "0 0 auto" }}>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

/** +18314599155 -> (831) 459-9155. Anything non-US stays as stored. */
function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--panel)",
  color: "var(--ink)",
  fontSize: 15,
};
