"use client";

import { calendarEntries, googleCalendarUrl, icsText } from "@/lib/events/calendar";
import { formatSlot, formatWhen } from "@/lib/events/format";
import { eventContact } from "@/lib/events/theme";
import type { EventRec } from "@/lib/events/types";

// What a member needs after signing up, under the "You're registered" heading:
// when and where, add to calendar, change or cancel, and who to ask.
export default function Confirmation({
  event,
  status,
  email,
  slotIds,
}: {
  event: EventRec;
  status: "confirmed" | "waitlist";
  email: string;
  slotIds: string[];
}) {
  const contact = eventContact(event);
  const entries = status === "confirmed" ? calendarEntries(event, slotIds) : [];
  const dates =
    event.scheduleMode === "slots"
      ? event.slots.filter((s) => slotIds.includes(s.id)).map(formatSlot)
      : [formatWhen(event.startsAt, event.endsAt)];

  function downloadIcs() {
    const uid = `${event.slug}-${email.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const blob = new Blob([icsText(entries, uid)], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.slug}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function manage() {
    window.dispatchEvent(new CustomEvent("ep:manage", { detail: { email } }));
  }

  return (
    <div className="confirm-extras">
      {status === "confirmed" && (
        <dl className="confirm-facts">
          <div>
            <dt>When</dt>
            <dd>
              {dates.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </dd>
          </div>
          {event.location && (
            <div>
              <dt>Where</dt>
              <dd>{event.location}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="confirm-actions">
        {entries.length > 0 && (
          <div className="confirm-cal" role="group" aria-label="Add to calendar">
            <span className="confirm-cal-lbl">Add to calendar</span>
            {entries.length === 1 && (
              <a
                className="btn secondary small"
                href={googleCalendarUrl(entries[0])}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google
              </a>
            )}
            <button type="button" className="btn secondary small" onClick={downloadIcs}>
              {entries.length === 1 ? "Apple / Outlook (.ics)" : `All ${entries.length} dates (.ics)`}
            </button>
          </div>
        )}
        <button type="button" className="btn ghost small" onClick={manage}>
          Change or cancel
        </button>
      </div>

      <p className="confirm-contact">
        Questions? Contact {contact.name} at{" "}
        <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
    </div>
  );
}
