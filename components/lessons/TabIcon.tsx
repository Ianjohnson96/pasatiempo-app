import type { LessonTab } from "./LessonsHeader";

// One line icon per lesson book tab, drawn the way the Event Planner draws
// its own (components/events/Icon.tsx): a 16px grid, a 1.5px stroke in
// currentColor, rounded ends. They sit beside the planner's as one family,
// and colour with the label next to them - green when the tab is open,
// muted when it is not.
export default function TabIcon({ name }: { name: LessonTab }) {
  return (
    <svg
      className="lb-tab-icon"
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<LessonTab, React.ReactNode> = {
  // a clubhouse
  dashboard: <path d="M2.5 7.4 8 3l5.5 4.4V13a.5.5 0 0 1-.5.5h-3v-3.8H6v3.8H3a.5.5 0 0 1-.5-.5z" />,
  schedule: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1" />
      <path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" />
    </>
  ),
  // a ruled page: one line per lesson
  ledger: <path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5M3 4.5h.01M3 8h.01M3 11.5h.01" />,
  // a till receipt with a torn foot
  billing: (
    <>
      <path d="M4 2.5h8v11l-1.33-.9-1.34.9-1.33-.9-1.33.9-1.34-.9L4 13.5z" />
      <path d="M6 6h4M6 8.5h4" />
    </>
  ),
  clients: (
    <>
      <circle cx="6" cy="5.8" r="2.1" />
      <path d="M2.5 13c0-2 1.6-3.3 3.5-3.3s3.5 1.3 3.5 3.3" />
      <circle cx="11.3" cy="6.4" r="1.6" />
      <path d="M10.6 9.7c1.6-.1 2.9 1 2.9 2.8" />
    </>
  ),
  // an in-tray: entries waiting for an answer
  review: (
    <>
      <path d="M2.5 9.5 4.2 3.5h7.6l1.7 6V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z" />
      <path d="M2.5 9.5h3l1 1.5h3l1-1.5h3" />
    </>
  ),
};
