import Link from "next/link";
import LessonsHeader from "@/components/lessons/LessonsHeader";
import PackageCard from "@/components/lessons/PackageCard";
import { requireLessonBook } from "@/lib/lessons/auth";
import { dashboard } from "@/lib/lessons/data";

// The front page: who owes money, and whose package is about to run out.
//
// Counts, not totals. Most packages have no price recorded yet, so a money
// total would read "$0 outstanding" and imply Ian is square when he is not.
// A count of what needs attention is true today and still true once the
// prices are filled in.
export const dynamic = "force-dynamic";

export default async function LessonBookHome() {
  const viewer = await requireLessonBook();
  const d = await dashboard();

  return (
    <>
      <LessonsHeader email={viewer.email} active="dashboard" />
      <main className="container">
        <div className="fin-stats" style={{ marginBottom: 18 }}>
          <div className="fin-stat strong">
            <strong>{d.unpaidPackages}</strong>
            <span>packages unpaid</span>
          </div>
          <div className="fin-stat">
            <strong>{d.pendingPackages}</strong>
            <span>charges pending</span>
          </div>
          <div className="fin-stat">
            <strong>{d.runningOut.length}</strong>
            <span>running out</span>
          </div>
          <div className="fin-stat">
            <strong>{d.lessonsThisMonth}</strong>
            <span>lessons this month</span>
          </div>
          <div className="fin-stat">
            <strong>{d.upcoming}</strong>
            <span>booked ahead</span>
          </div>
          <div className="fin-stat">
            <strong>{d.activeClients}</strong>
            <span>active clients</span>
          </div>
        </div>

        {d.unpriced > 0 && (
          <p className="notice warn">
            {d.unpriced} of these packages have no price recorded, so no amount
            owed can be shown yet. Set a price on each and the money adds up by
            itself.
          </p>
        )}

        <h2 className="section-title" style={{ marginTop: 22 }}>
          Owed
        </h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Packages not yet paid, priciest first. Ones with no price sit at the
          bottom rather than counting as nothing.
        </p>
        {d.chase.length === 0 ? (
          <p className="empty">Nothing outstanding.</p>
        ) : (
          <div className="stack" style={{ marginTop: 12 }}>
            {d.chase.map((p) => (
              <PackageCard key={p.id} pkg={p} showClient />
            ))}
          </div>
        )}

        <h2 className="section-title" style={{ marginTop: 26 }}>
          Running out
        </h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          One lesson left or fewer &mdash; the moment to sell the next package.
        </p>
        {d.runningOut.length === 0 ? (
          <p className="empty">Nobody is about to run out.</p>
        ) : (
          <div className="stack" style={{ marginTop: 12 }}>
            {d.runningOut.map((p) => (
              <PackageCard key={p.id} pkg={p} showClient />
            ))}
          </div>
        )}

        <p style={{ marginTop: 26 }}>
          <Link className="btn secondary" href="/lessons/clients">
            All clients
          </Link>
        </p>
      </main>
    </>
  );
}
