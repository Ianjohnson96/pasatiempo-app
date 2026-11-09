import type { InfoIcon, TabKey } from "./content";

// Thin line icons for the Invitational page (tabs and the Info cards).

const PATHS: Record<TabKey | InfoIcon, React.ReactNode> = {
  home: <path d="M4 11 12 4l8 7v9H4zM10 20v-5h4v5" />,
  schedule: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="1.5" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  flights: <path d="M5 21V4M5 4h12l-2.5 3.5L17 11H5" />,
  format: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  field: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.4c.6-.3 1.3-.4 2-.4 2.8 0 4 2 4 5" />
    </>
  ),
  wagering: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 15a2.5 2.5 0 0 0 5 0c0-3-5-2-5-5a2.5 2.5 0 0 1 5 0M12 6.5v1.5M12 16.5V18" />
    </>
  ),
  prizes: (
    <>
      <path d="M8 21h8M12 17v4M6 4h12v3a6 6 0 0 1-12 0V4Z" />
      <path d="M6 6H3v2a4 4 0 0 0 4 4M18 6h3v2a4 4 0 0 1-4 4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  entry: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  guest: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7M19 4v4M17 6h4" />
    </>
  ),
  dress: <path d="M9 3 4 6l2 4 2-1v12h8V9l2 1 2-4-5-3c0 1.7-1.3 3-3 3S9 4.7 9 3Z" />,
  range: (
    <>
      <path d="M6 21V3l9 3.5L6 10" />
      <ellipse cx="12" cy="20" rx="8" ry="1.6" />
    </>
  ),
  cart: (
    <>
      <path d="M3 6h3l2 9h10l2-6H7" />
      <circle cx="9" cy="19" r="1.6" />
      <circle cx="17" cy="19" r="1.6" />
    </>
  ),
  bed: <path d="M3 19V6M3 13h18v6M21 13a3 3 0 0 0-3-3h-7v3M7.5 11.5a1.5 1.5 0 1 0 0-.01" />,
};

export function Icon({ name, size = 22 }: { name: TabKey | InfoIcon; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
