"use client";

import { TYPE_TILES } from "@/lib/events/editor";
import TypeIcon from "@/components/events/TypeIcon";
import type { EventType } from "@/lib/events/types";

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
