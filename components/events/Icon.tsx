// Small line icons for the Event Planner, drawn in currentColor at a 1.5px
// stroke. They replace the emoji the planner used to lean on, so every glyph
// shares one weight and one colour with the type beside it.
export type IconName =
  | "calendar"
  | "pin"
  | "lock"
  | "people"
  | "print"
  | "external"
  | "check"
  | "close"
  | "up"
  | "down"
  | "repeat";

export default function Icon({
  name,
  size = 16,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    className: className ? `ep-icon ${className}` : "ep-icon",
  };
  switch (name) {
    case "calendar":
      return (
        <svg {...props}>
          <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="1" />
          <path d="M2.25 6.5h11.5M5.25 1.75v3M10.75 1.75v3" />
        </svg>
      );
    case "pin":
      return (
        <svg {...props}>
          <path d="M8 14.25s-4.5-4.1-4.5-7.5a4.5 4.5 0 0 1 9 0c0 3.4-4.5 7.5-4.5 7.5z" />
          <circle cx="8" cy="6.75" r="1.6" />
        </svg>
      );
    case "lock":
      return (
        <svg {...props}>
          <rect x="3" y="7" width="10" height="7" rx="1" />
          <path d="M5.25 7V5a2.75 2.75 0 0 1 5.5 0v2" />
        </svg>
      );
    case "people":
      return (
        <svg {...props}>
          <circle cx="6" cy="5.25" r="2.25" />
          <path d="M1.75 13.5c.4-2.4 2.1-3.75 4.25-3.75s3.85 1.35 4.25 3.75" />
          <path d="M10.5 3.2a2.25 2.25 0 0 1 0 4.1M12 9.9c1.2.5 2 1.6 2.25 3.6" />
        </svg>
      );
    case "print":
      return (
        <svg {...props}>
          <path d="M4.25 6V1.75h7.5V6" />
          <rect x="1.75" y="6" width="12.5" height="5.5" rx="1" />
          <path d="M4.25 9.5h7.5v4.75h-7.5z" />
        </svg>
      );
    case "external":
      return (
        <svg {...props}>
          <path d="M9.5 2.25h4.25V6.5M13.5 2.5 7.5 8.5" />
          <path d="M12 9.5v3.25a1 1 0 0 1-1 1H3.25a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1H6.5" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M3 8.5l3.25 3.25L13 4.75" />
        </svg>
      );
    case "close":
      return (
        <svg {...props}>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      );
    case "up":
      return (
        <svg {...props}>
          <path d="M8 13V3M4 7l4-4 4 4" />
        </svg>
      );
    case "down":
      return (
        <svg {...props}>
          <path d="M8 3v10M4 9l4 4 4-4" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...props}>
          <path d="M2.75 7.25V6a2.5 2.5 0 0 1 2.5-2.5h8M11 1.25l2.25 2.25L11 5.75" />
          <path d="M13.25 8.75V10a2.5 2.5 0 0 1-2.5 2.5h-8M5 14.75 2.75 12.5 5 10.25" />
        </svg>
      );
  }
}
