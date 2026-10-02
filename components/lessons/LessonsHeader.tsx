import Link from "next/link";
import { reviewCount } from "@/lib/lessons/data";

// Shared chrome for the lesson book.
//
// The Review badge is the point of that tab: a queue nobody can see is a queue
// nobody answers, and anything sitting in it is counted nowhere until it is.

const TABS = [
  { href: "/lessons", key: "dashboard", label: "Dashboard" },
  { href: "/lessons/clients", key: "clients", label: "Clients" },
  { href: "/lessons/review", key: "review", label: "Review" },
] as const;

export type LessonTab = (typeof TABS)[number]["key"];

export default async function LessonsHeader({
  email,
  active,
}: {
  email: string;
  active: LessonTab;
}) {
  const waiting = await reviewCount();

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
              {t.key === "review" && waiting > 0 && (
                <span className="badge open" style={{ marginLeft: 6 }}>
                  {waiting}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
