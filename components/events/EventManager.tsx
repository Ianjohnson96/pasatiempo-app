"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import CopyLink from "@/components/events/CopyLink";
import RegistrationEditor from "@/components/events/RegistrationEditor";
import TeamEntryForm from "@/components/events/TeamEntryForm";
import {
  csvFilename,
  signupRows,
  toCsv,
  tournamentRows,
} from "@/lib/events/csv";
import {
  adminAddTeam,
  deleteEvent,
  deleteRegistration,
  setEventStatus,
  setRegStatus,
} from "@/lib/events/actions";
import {
  answerText,
  formatSlot,
  formatSlotShort,
  formatWhen,
  TYPE_LABEL,
} from "@/lib/events/format";
import { availability } from "@/lib/events/seats";
import type { TeamInput } from "@/lib/events/tournament";
import type {
  CustomField,
  EventRec,
  Player,
  RegStatus,
  Registration,
} from "@/lib/events/types";

const STATUS_LABEL: Record<RegStatus, string> = {
  confirmed: "Confirmed",
  waitlist: "Waitlist",
  cancelled: "Cancelled",
};

export default function EventManager({
  event,
  registrations,
}: {
  event: EventRec;
  registrations: Registration[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const isTournament = event.type === "tournament";
  const avail = availability(event, registrations);

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const waitlist = registrations.filter((r) => r.status === "waitlist");
  const cancelled = registrations.filter((r) => r.status === "cancelled");
  const seats = confirmed.reduce((n, r) => n + Math.max(1, r.partySize), 0);

  // Program roster: distinct confirmed people (registrant + guests), de-duped by
  // email so multi-date sign-ups count once. Matches the public cap logic.
  const rosterPeople = (() => {
    const heads = new Map<string, number>();
    for (const r of confirmed) {
      const e = r.email.trim().toLowerCase();
      heads.set(e, Math.max(heads.get(e) ?? 0, Math.max(1, r.partySize)));
    }
    let t = 0;
    for (const n of heads.values()) t += n;
    return t;
  })();
  const rosterFull =
    event.rosterLimit != null && rosterPeople >= event.rosterLimit;

  function changeStatus(s: "draft" | "open" | "closed") {
    start(async () => {
      await setEventStatus(event.id, s);
      router.refresh();
    });
  }

  function changeReg(id: string, s: RegStatus) {
    setBusyId(id);
    start(async () => {
      await setRegStatus(id, s);
      router.refresh();
      setBusyId(null);
    });
  }

  function removeReg(id: string) {
    if (!confirm("Permanently delete this registration?")) return;
    setBusyId(id);
    start(async () => {
      await deleteRegistration(id);
      router.refresh();
      setBusyId(null);
    });
  }

  function removeEvent() {
    if (
      !confirm(
        `Delete "${event.title}" and all of its registrations? This cannot be undone.`,
      )
    )
      return;
    start(async () => {
      await deleteEvent(event.id);
      router.push("/admin/events");
      router.refresh();
    });
  }

  function exportCsv() {
    const rows =
      event.type === "tournament"
        ? tournamentRows(event, registrations)
        : signupRows(event, registrations);
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = csvFilename(event);
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // unique confirmed-registrant emails (both players on a tournament team)
  const confirmedEmails = Array.from(
    new Set(
      confirmed
        .flatMap((r) =>
          isTournament && r.players?.length
            ? r.players.map((p) => p.email)
            : [r.email],
        )
        .filter(Boolean),
    ),
  );
  const [copied, setCopied] = useState(false);

  async function copyEmails() {
    const text = confirmedEmails.join(", ");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function emailAll() {
    // open the manager's mail app with all registrants BCC'd
    const subject = encodeURIComponent(event.title);
    window.location.href = `mailto:?bcc=${encodeURIComponent(
      confirmedEmails.join(","),
    )}&subject=${subject}`;
  }

  // Edit, status moves and delete: shared by table rows and team cards.
  function regActions(r: Registration) {
    const busy = busyId === r.id;
    return (
      <>
        <button
          className="btn small secondary"
          disabled={busy}
          onClick={() => setEditId(r.id)}
        >
          Edit
        </button>
        {r.status === "waitlist" && (
          <button
            className="btn small"
            disabled={busy}
            onClick={() => changeReg(r.id, "confirmed")}
          >
            Confirm
          </button>
        )}
        {r.status === "confirmed" && (
          <button
            className="btn small secondary"
            disabled={busy}
            onClick={() => changeReg(r.id, "waitlist")}
          >
            → Waitlist
          </button>
        )}
        {r.status === "cancelled" ? (
          <button
            className="btn small secondary"
            disabled={busy}
            onClick={() => changeReg(r.id, "confirmed")}
          >
            Restore
          </button>
        ) : (
          <button
            className="btn small ghost"
            disabled={busy}
            onClick={() => changeReg(r.id, "cancelled")}
          >
            Cancel
          </button>
        )}
        <button
          className="btn small danger"
          disabled={busy}
          onClick={() => removeReg(r.id)}
          title="Delete"
        >
          ✕
        </button>
      </>
    );
  }

  async function addTeam(
    team: TeamInput,
    phone: string,
    sendEmails: boolean,
  ): Promise<string | null> {
    const res = await adminAddTeam(event.id, team, phone, sendEmails);
    if (!res.ok) return res.error ?? "Could not add the team.";
    // The form stays filled after a save, so close it before a second click
    // could add the same team again.
    setAdding(false);
    router.refresh();
    return null;
  }

  // A tournament team: both players with their answers, then team answers.
  function teamCard(r: Registration, num: number | null) {
    if (editId === r.id) {
      return (
        <RegistrationEditor
          key={r.id}
          event={event}
          reg={r}
          onClose={() => setEditId(null)}
        />
      );
    }
    const players: Player[] =
      r.players && r.players.length > 0
        ? r.players
        : [
            {
              role: "member",
              name: r.name,
              email: r.email,
              ghin: "",
              answers: {},
            },
          ];
    const playerFields = event.customFields.filter((f) => f.scope === "player");
    const teamFields = event.customFields.filter((f) => f.scope === "team");
    return (
      <div key={r.id} className={`team-card ${r.status}`}>
        <div className="tc-head">
          {num != null && <span className="tc-num">Team {num}</span>}
          <span className={`tc-status ${r.status}`}>
            {STATUS_LABEL[r.status]}
          </span>
          {r.emailFailed && (
            <span
              className="flag-warn"
              title="The confirmation email could not be sent"
            >
              Email not sent
            </span>
          )}
          <span className="tc-actions">{regActions(r)}</span>
        </div>
        <div className="tc-players">
          {players.map((p) => (
            <div className="tc-player" key={p.role}>
              <div className="tc-role">
                {p.role === "member" ? "Member" : "Guest"}
              </div>
              <div className="tc-name">{p.name}</div>
              <dl className="tc-list">
                <TcRow label="Email" value={p.email} />
                <TcRow label="GHIN #" value={p.ghin} />
                {p.role === "member" && r.phone && (
                  <TcRow label="Phone" value={r.phone} />
                )}
                {playerFields.map((f) => (
                  <TcRow
                    key={f.id}
                    label={f.label}
                    value={answerText(p.answers[f.id])}
                  />
                ))}
              </dl>
            </div>
          ))}
        </div>
        {teamFields.length > 0 && (
          <TeamAnswers fields={teamFields} answers={r.answers} />
        )}
      </div>
    );
  }

  function regRow(r: Registration) {
    const cols = event.slots.length > 0 ? 4 : 3;
    if (editId === r.id) {
      return (
        <tr key={r.id}>
          <td colSpan={cols} style={{ padding: "10px 0" }}>
            <RegistrationEditor
              event={event}
              reg={r}
              onClose={() => setEditId(null)}
            />
          </td>
        </tr>
      );
    }
    return (
      <tr key={r.id} style={{ opacity: r.status === "cancelled" ? 0.55 : 1 }}>
        <td>
          <strong>{r.name}</strong>
          {r.partySize > 1 && (
            <span className="pill" style={{ marginLeft: 8 }}>
              party of {r.partySize}
            </span>
          )}
          {r.guestNames.length > 0 && (
            <div className="muted" style={{ fontSize: 13 }}>
              + {r.guestNames.join(", ")}
            </div>
          )}
          {event.customFields.map((f) =>
            r.answers[f.id] ? (
              <div key={f.id} className="muted" style={{ fontSize: 13 }}>
                {f.label}: {answerText(r.answers[f.id])}
              </div>
            ) : null,
          )}
        </td>
        <td>
          <div>{r.email}</div>
          {r.phone && (
            <div className="muted" style={{ fontSize: 13 }}>
              {r.phone}
            </div>
          )}
        </td>
        {event.slots.length > 0 && (
          <td>
            <div className="slot-count">
              {r.slotIds.length} of {event.slots.length} dates
            </div>
            <div className="slot-chips">
              {event.slots.map((s) => {
                const going = r.slotIds.includes(s.id);
                return (
                  <span
                    key={s.id}
                    className={`slot-chip${going ? " on" : ""}`}
                    title={formatSlot(s)}
                  >
                    {formatSlotShort(s)}
                  </span>
                );
              })}
            </div>
          </td>
        )}
        <td style={{ whiteSpace: "nowrap" }}>{regActions(r)}</td>
      </tr>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div
          className="ev-header"
          style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{event.title}</h2>
              <span className={`badge ${event.status}`}>{event.status}</span>
            </div>
            <div className="ev-meta" style={{ marginTop: 6 }}>
              <span>{TYPE_LABEL[event.type]}</span>
              <span>{formatWhen(event.startsAt, event.endsAt)}</span>
              {event.location && <span>📍 {event.location}</span>}
              {event.inviteOnly && <span>🔒 Invite-only</span>}
              {event.rosterLimit != null && (
                <span style={{ color: rosterFull ? "var(--danger)" : "var(--muted)" }}>
                  👥 Roster {rosterPeople}/{event.rosterLimit}
                  {rosterFull ? " · full" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="ev-actions" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a
              href={`/events/e/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn secondary"
            >
              View page ↗
            </a>
            <Link
              href={`/admin/events/${event.id}/roster`}
              className="btn secondary"
            >
              🖨 Roster
            </Link>
            <Link
              href={`/admin/events/${event.id}/edit`}
              className="btn secondary"
            >
              Edit
            </Link>
          </div>
        </div>

        <div className="divider" />

        <div className="section-title">Share this link</div>
        <CopyLink slug={event.slug} />
        <p className="hint" style={{ marginTop: 8 }}>
          {event.status === "open"
            ? "Anyone with this link can register."
            : event.status === "draft"
              ? "This event is a draft — the link won't accept sign-ups yet. Set it to Open below."
              : "This event is closed — the link won't accept new sign-ups."}
        </p>

        <div className="divider" />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="section-title" style={{ margin: 0 }}>
            Status:
          </span>
          {(["open", "draft", "closed"] as const).map((s) => (
            <button
              key={s}
              className={`btn small ${event.status === s ? "" : "secondary"}`}
              disabled={pending || event.status === s}
              onClick={() => changeStatus(s)}
            >
              {s === "open" ? "Open" : s === "draft" ? "Draft" : "Closed"}
            </button>
          ))}
          <span className="spacer" style={{ flex: 1 }} />
          <button className="btn small danger" onClick={removeEvent}>
            Delete event
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="section-title" style={{ margin: 0 }}>
            Registrations
          </div>
          <span className="spacer" style={{ flex: 1 }} />
          {isTournament ? (
            <span className="pill">
              {avail.taken}
              {avail.capacity != null ? ` of ${avail.capacity}` : ""}{" "}
              {(avail.capacity ?? avail.taken) === 1 ? "team" : "teams"}
            </span>
          ) : (
            <span className="pill">
              {seats}
              {event.capacity ? ` / ${event.capacity}` : ""} confirmed
            </span>
          )}
          {waitlist.length > 0 && (
            <span className="pill" style={{ background: "#fff1df", color: "var(--warn)" }}>
              {waitlist.length} waitlist
            </span>
          )}
          <button
            className="btn small secondary"
            onClick={copyEmails}
            disabled={confirmedEmails.length === 0}
            title="Copy confirmed registrants' emails to paste into your email app"
          >
            {copied ? "Copied ✓" : "Copy emails"}
          </button>
          <button
            className="btn small secondary"
            onClick={emailAll}
            disabled={confirmedEmails.length === 0}
            title="Open your email app with everyone BCC'd"
          >
            Email all
          </button>
          <button
            className="btn small secondary"
            onClick={exportCsv}
            disabled={registrations.length === 0}
          >
            Export CSV
          </button>
          {isTournament && (
            <button
              className="btn small"
              onClick={() => setAdding((a) => !a)}
              aria-expanded={adding}
            >
              {adding ? "Close" : "+ Add team"}
            </button>
          )}
        </div>

        {isTournament && adding && (
          <div className="tc-add">
            <div className="section-title" style={{ marginBottom: 12 }}>
              Add a team
            </div>
            <TeamEntryForm
              event={event}
              seats={{ remaining: avail.remaining, full: avail.full, slots: [] }}
              mode="admin"
              onSubmit={addTeam}
            />
            <button
              type="button"
              className="btn secondary block"
              style={{ marginTop: 10 }}
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {registrations.length === 0 ? (
          <div className="empty">No sign-ups yet.</div>
        ) : isTournament ? (
          <>
            <div className="tc-stack">
              {confirmed.length === 0 ? (
                <div className="empty">No confirmed teams.</div>
              ) : (
                confirmed.map((r, i) => teamCard(r, i + 1))
              )}
            </div>
            {waitlist.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 22 }}>
                  Waitlist
                </div>
                <div className="tc-stack">
                  {waitlist.map((r) => teamCard(r, null))}
                </div>
              </>
            )}
            {cancelled.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 22 }}>
                  Cancelled
                </div>
                <div className="tc-stack">
                  {cancelled.map((r) => teamCard(r, null))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <table className="table" style={{ marginTop: 14 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  {event.slots.length > 0 && <th>Slot</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map(regRow)}
              </tbody>
            </table>

            {waitlist.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 22 }}>
                  Waitlist
                </div>
                <table className="table">
                  <tbody>{waitlist.map(regRow)}</tbody>
                </table>
              </>
            )}
            {cancelled.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 22 }}>
                  Cancelled
                </div>
                <table className="table">
                  <tbody>{cancelled.map(regRow)}</tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TcRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="tc-row">
      <dt>{label}</dt>
      <dd>{value.trim() || <span className="muted">—</span>}</dd>
    </div>
  );
}

function TeamAnswers({
  fields,
  answers,
}: {
  fields: CustomField[];
  answers: Registration["answers"];
}) {
  return (
    <div className="tc-team">
      <div className="tc-role">Team</div>
      <dl className="tc-list">
        {fields.map((f) => (
          <TcRow key={f.id} label={f.label} value={answerText(answers[f.id])} />
        ))}
      </dl>
    </div>
  );
}
