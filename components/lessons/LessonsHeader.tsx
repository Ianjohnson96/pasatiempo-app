import Link from "next/link";

// Shared chrome for the lesson book.
//
// The Review badge is the point of that tab: a queue nobody can see is a queue
// nobody answers, and anything sitting in it is counted nowhere until it is.
//
// The count is passed in rather than fetched here. Fetching it here meant a
// database trip that could only start once the page's own data had arrived;
// the pages now load both at once.

const TABS = [
  // "Home", not "Dashboard": five tabs have to fit across a phone.
  { href: "/lessons", key: "dashboard", label: "Home" },
  { href: "/lessons/schedule", key: "schedule", label: "Schedule" },
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

      <div className="container" style={{ paddingBottom: 0 }}>
        <nav className="seg lb-tabs" style={{ marginTop: 18 }}>
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={t.key === active ? "segbtn on" : "segbtn"}
              aria-current={t.key === active ? "page" : undefined}
            >
              {t.label}
              {t.key === "review" && waiting > 0 && (
                <span className="badge open">{waiting}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
