import Link from "next/link";
import { pendingCount } from "@/lib/lessons/data";

// Shared chrome for the three lesson-book screens. A server component: it needs
// only the signed-in email, which the page already has, plus the confirm count.

const TABS = [
  { href: "/lessons", key: "students", label: "Students" },
  { href: "/lessons/log", key: "log", label: "Lessons" },
  { href: "/lessons/confirm", key: "confirm", label: "Confirm" },
] as const;

export type LessonTab = (typeof TABS)[number]["key"];

export default async function LessonsHeader({
  email,
  active,
}: {
  email: string;
  active: LessonTab;
}) {
  // The badge is the whole point of the Confirm tab: with no number on it there
  // is nothing to prompt Ian to go and answer the queue.
  const waiting = await pendingCount();

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
              {t.key === "confirm" && waiting > 0 && (
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
