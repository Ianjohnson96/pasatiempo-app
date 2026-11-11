import type { EventType } from "@/lib/events/types";

// One line-icon per event type, shared by the editor's type tiles and the
// events list cards. Draws in currentColor.
export default function TypeIcon({
  type,
  size = 26,
}: {
  type: EventType;
  size?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (type) {
    case "tournament": // flag on the green
      return (
        <svg {...props}>
          <path d="M7 20V3.5" />
          <path d="M7 4l10 3.75L7 11.5" />
          <ellipse cx="11" cy="20" rx="7" ry="1.6" />
        </svg>
      );
    case "dinner": // wine glass
      return (
        <svg {...props}>
          <path d="M7.5 3h9l-.6 5.2a3.95 3.95 0 0 1-7.8 0z" />
          <path d="M12 12v8" />
          <path d="M8.5 20.5h7" />
        </svg>
      );
    case "clinic": // calendar
      return (
        <svg {...props}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
          <path d="M8 14h2M14 14h2M8 17h2" />
        </svg>
      );
    default: // anything else
      return (
        <svg {...props}>
          <rect x="4" y="4" width="7" height="7" rx="1.6" />
          <rect x="13" y="4" width="7" height="7" rx="1.6" />
          <rect x="4" y="13" width="7" height="7" rx="1.6" />
          <rect x="13" y="13" width="7" height="7" rx="1.6" />
        </svg>
      );
  }
}
