"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/events/Icon";
import { calendarEntries, googleCalendarUrl, icsText } from "@/lib/events/calendar";
import type { EventRec } from "@/lib/events/types";

// "Add to calendar" beside Share in the hero: Google, or an .ics file for
// Apple Calendar and Outlook. Single-date events only (a multi-date clinic
// adds the dates someone picks, on the confirmation screen).
export default function CalendarMenu({ event }: { event: EventRec }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const entries = event.scheduleMode === "single" ? calendarEntries(event, []) : [];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (entries.length === 0) return null;

  function downloadIcs() {
    const blob = new Blob([icsText(entries, `${event.slug}-event`)], {
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
    setOpen(false);
  }

  return (
    <div className="cal-menu" ref={wrap}>
      <button
        type="button"
        className="share-btn"
        aria-expanded={open}
        aria-controls="cal-pop"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" />
        <span>Add to calendar</span>
      </button>
      {open && (
        // a plain show/hide list (not an ARIA menu, which promises arrow keys)
        <div className="cal-pop" id="cal-pop">
          <a
            href={googleCalendarUrl(entries[0])}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            Google Calendar
          </a>
          <button type="button" onClick={downloadIcs}>
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
