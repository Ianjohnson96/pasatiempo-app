import Link from "next/link";

// Shared chrome for the lesson book. A server component - it only needs the
// signed-in email, which the page already has.

const TABS = [
  { href: "/lessons", key: "dashboard", label: "Dashboard" },
  { href: "/lessons/clients", key: "clients", label: "Clients" },
] as const;

export type LessonTab = (typeof TABS)[number]["key"];

export default function LessonsHeader({
  email,
  active,
}: {
  email: string;
  active: LessonTab;
}) {
  return (
    <>
      <div className="appbar">
        <div className="appbar-inner">
          <Link href="/admin" className="brand">
            <span className="mark">P</span> Lesson Book
          </Link>
          <span className="spacer" />
          <span className="navlink">{email}</span>
          <form action="/auth/signout" method="post" style={{ margin: 0 }}>
            <button className="btn secondary small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 0 }}>
        <div className="seg" style={{ marginTop: 18 }}>
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={t.key === active ? "segbtn on" : "segbtn"}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
