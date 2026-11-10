"use client";

import { TYPE_TILES } from "@/lib/events/editor";
import type { EventType } from "@/lib/events/types";

const ICON_PROPS = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function TypeIcon({ type }: { type: EventType }) {
  switch (type) {
    case "tournament": // flag on the green
      return (
        <svg {...ICON_PROPS}>
          <path d="M7 20V3.5" />
          <path d="M7 4l10 3.75L7 11.5" />
          <ellipse cx="11" cy="20" rx="7" ry="1.6" />
        </svg>
      );
    case "dinner": // wine glass
      return (
        <svg {...ICON_PROPS}>
          <path d="M7.5 3h9l-.6 5.2a3.95 3.95 0 0 1-7.8 0z" />
          <path d="M12 12v8" />
          <path d="M8.5 20.5h7" />
        </svg>
      );
    case "clinic": // calendar
      return (
        <svg {...ICON_PROPS}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
          <path d="M8 14h2M14 14h2M8 17h2" />
        </svg>
      );
    default: // anything else
      return (
        <svg {...ICON_PROPS}>
          <rect x="4" y="4" width="7" height="7" rx="1.6" />
          <rect x="13" y="4" width="7" height="7" rx="1.6" />
          <rect x="4" y="13" width="7" height="7" rx="1.6" />
          <rect x="13" y="13" width="7" height="7" rx="1.6" />
        </svg>
      );
  }
}

export default function TypeTiles({
  value,
  onChange,
  isDisabled,
  describedBy,
}: {
  value: EventType;
  onChange: (t: EventType) => void;
  isDisabled?: (t: EventType) => boolean;
  describedBy?: string;
}) {
  return (
    <div
      className="type-tiles"
      role="radiogroup"
      aria-label="Event type"
      aria-describedby={describedBy}
    >
      {TYPE_TILES.map((t) => {
        const on = value === t.type;
        const off = !on && (isDisabled?.(t.type) ?? false);
        return (
          <label
            key={t.type}
            className={`type-tile${on ? " on" : ""}${off ? " disabled" : ""}`}
          >
            <input
              type="radio"
              name="event-type"
              value={t.type}
              checked={on}
              disabled={off}
              onChange={() => onChange(t.type)}
            />
            <span className="type-tile-ico">
              <TypeIcon type={t.type} />
            </span>
            <span className="type-tile-text">
              <span className="type-tile-label">{t.label}</span>
              <span className="type-tile-blurb">{t.blurb}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
