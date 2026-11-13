import Link from "next/link";
import TabIcon from "./TabIcon";

// Shared chrome for the lesson book.
//
// The Review badge is the point of that tab: a queue nobody can see is a queue
// nobody answers, and anything sitting in it is counted nowhere until it is.
//
// The count is passed in rather than fetched here. Fetching it here meant a
// database trip that could only start once the page's own data had arrived;
// the pages now load both at once.
//
// On a phone the same nav becomes a bar along the bottom of the screen
// (lessons.css). Six tabs scrolled sideways across the top hid Clients and
// Review off the edge - and with them the Review badge, the one thing in this
// row that asks for attention.

const TABS = [
  // "Home", not "Dashboard": six short labels, each under its icon, have to
  // fit across a phone.
  { href: "/lessons", key: "dashboard", label: "Home" },
  { href: "/lessons/schedule", key: "schedule", label: "Schedule" },
  { href: "/lessons/ledger", key: "ledger", label: "Lessons" },
  { href: "/lessons/billing", key: "billing", label: "Billing" },
  { href: "/lessons/clients", key: "clients", label: "Clients" },
  { href: "/lessons/review", key: "review", label: "Review" },
] as const;

export type LessonTab = (typeof TABS)[number]["key"];

export default function LessonsHeader({
  email,
  active,
  waiting,
}: {
  email: string;
  active: LessonTab;
  /** Unanswered review entries, for the badge. */
  waiting: number;
}) {
  return (
    <>
      <div className="appbar">
        <div className="appbar-inner">
          <Link href="/admin" className="brand">
            <span className="mark">P</span> Lesson Book
          </Link>
          <span className="spacer" />
          <span className="navlink u-email">{email}</span>
          <form action="/auth/signout" method="post" style={{ margin: 0 }}>
            <button className="btn secondary small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="container lb-tabwrap">
        <nav className="lb-tabs" aria-label="Lesson book">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={t.key === active ? "lb-tab on" : "lb-tab"}
              aria-current={t.key === active ? "page" : undefined}
            >
              <TabIcon name={t.key} />
              <span className="lb-tab-label">{t.label}</span>
              {t.key === "review" && waiting > 0 && (
                <span
                  className="lb-tab-count"
                  aria-label={`${waiting} waiting`}
                >
                  {waiting}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
