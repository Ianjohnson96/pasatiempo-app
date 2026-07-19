"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import CopyLink from "@/components/events/CopyLink";
import {
  deleteEvent,
  deleteRegistration,
  setEventStatus,
  setRegStatus,
} from "@/lib/events/actions";
import { formatSlot, formatWhen, TYPE_LABEL } from "@/lib/events/format";
import type { EventRec, RegStatus, Registration } from "@/lib/events/types";

function slotLabels(ev: EventRec, slotIds: string[]): string {
  return slotIds
    .map((id) => ev.slots.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => formatSlot(s))
    .join("; ");
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

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

  const confirmed = registrations.filter((r) => r.status === "confirmed");
  const waitlist = registrations.filter((r) => r.status === "waitlist");
  const cancelled = registrations.filter((r) => r.status === "cancelled");
  const seats = confirmed.reduce((n, r) => n + Math.max(1, r.partySize), 0);

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
    const cols = [
      "Status",
      "Name",
      "Email",
      "Phone",
      "Party size",
      ...(event.slots.length ? ["Slot"] : []),
      ...(event.collectGuestNames ? ["Guests"] : []),
      ...event.customFields.map((f) => f.label),
      "Registered at",
    ];
    const rows = registrations.map((r) => [
      r.status,
      r.name,
      r.email,
      r.phone,
      String(r.partySize),
      ...(event.slots.length ? [slotLabels(event, r.slotIds)] : []),
      ...(event.collectGuestNames ? [r.guestNames.join("; ")] : []),
      ...event.customFields.map((f) => r.answers[f.id] ?? ""),
      new Date(r.createdAt).toLocaleString(),
    ]);
    const csv = [cols, ...rows]
      .map((row) => row.map((c) => csvCell(String(c))).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-signups.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // unique confirmed-registrant emails
  const confirmedEmails = Array.from(
    new Set(confirmed.map((r) => r.email).filter(Boolean)),
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

  function regRow(r: Registration) {
    const busy = busyId === r.id;
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
                {f.label}: {r.answers[f.id]}
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
        {event.slots.length > 0 && <td>{slotLabels(event, r.slotIds)}</td>}
        <td style={{ whiteSpace: "nowrap" }}>
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
        </td>
      </tr>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
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
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a
              href={`/events/e/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn secondary"
            >
              View page ↗
            </a>
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
          <span className="pill">
            {seats}
            {event.capacity ? ` / ${event.capacity}` : ""} confirmed
          </span>
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
        </div>

        {registrations.length === 0 ? (
          <div className="empty">No sign-ups yet.</div>
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
