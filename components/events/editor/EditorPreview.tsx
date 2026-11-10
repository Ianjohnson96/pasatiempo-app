"use client";

import { memo, useEffect, useRef } from "react";
import RegistrationForm from "@/components/events/RegistrationForm";
import TeamEntryForm from "@/components/events/TeamEntryForm";
import { previewSeats } from "@/lib/events/editor";
import { TYPE_LABEL, formatWhen } from "@/lib/events/format";
import type { EventRec } from "@/lib/events/types";

// The sign-up form as members will see it, built from the editor's unsaved
// state. Read-only: TeamEntryForm has a preview mode; the standard form sits in
// an inert wrapper so nothing can be typed into or submitted.
export const PreviewBody = memo(function PreviewBody({
  event,
}: {
  event: EventRec;
}) {
  const seats = previewSeats(event);
  const when =
    event.scheduleMode === "slots"
      ? event.slots.length === 0
        ? "No dates yet"
        : `${event.slots.length} date${event.slots.length === 1 ? "" : "s"} to choose from`
      : formatWhen(event.startsAt, event.endsAt);
  const capacity =
    event.capacity == null
      ? null
      : event.type === "tournament"
        ? `${event.capacity} teams`
        : `${event.capacity} spots`;

  return (
    <div className="ep-body">
      <div className="ep-hero">
        <span className="ep-kicker">{TYPE_LABEL[event.type]}</span>
        <div className="ep-title">{event.title}</div>
        <div className="ep-meta">
          <span>{when}</span>
          {event.location && <span>{event.location}</span>}
          {capacity && <span>{capacity}</span>}
        </div>
      </div>
      <div className="ep-form">
        {event.type === "tournament" ? (
          <TeamEntryForm event={event} seats={seats} mode="preview" />
        ) : (
          <div inert className="ep-inert">
            {/* remount when the choices change so the default pick follows */}
            <RegistrationForm
              key={`${event.scheduleMode}:${event.allowMultiSlot}:${event.slots
                .map((s) => s.id)
                .join(",")}`}
              event={event}
              seats={seats}
            />
          </div>
        )}
      </div>
    </div>
  );
});

function PreviewHead({
  publicHref,
  onClose,
}: {
  publicHref: string | null;
  onClose?: () => void;
}) {
  return (
    <div className="ep-head">
      <span className="ep-head-title">
        <span className="ep-dot" aria-hidden />
        Live preview
      </span>
      <span className="ep-head-tools">
        {publicHref && (
          <a href={publicHref} target="_blank" rel="noopener noreferrer">
            Open saved page ↗
          </a>
        )}
        {onClose && (
          <button
            type="button"
            className="ep-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            ✕
          </button>
        )}
      </span>
    </div>
  );
}

// The right-hand column on wide screens.
export function PreviewPanel({
  event,
  publicHref,
}: {
  event: EventRec;
  publicHref: string | null;
}) {
  return (
    <aside className="editor-preview" aria-label="Live preview">
      <div className="ep-frame">
        <PreviewHead publicHref={publicHref} />
        <div className="ep-scroll">
          <PreviewBody event={event} />
        </div>
      </div>
    </aside>
  );
}

// The "Preview" button's overlay on narrower screens.
export function PreviewOverlay({
  event,
  publicHref,
  onClose,
}: {
  event: EventRec;
  publicHref: string | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const back = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      back?.focus();
    };
  }, [onClose]);

  return (
    <div className="ep-overlay" onClick={onClose}>
      <div
        className="ep-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Live preview"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <PreviewHead publicHref={publicHref} onClose={onClose} />
        <div className="ep-scroll">
          <PreviewBody event={event} />
        </div>
      </div>
    </div>
  );
}
