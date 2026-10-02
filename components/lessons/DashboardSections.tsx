import Link from "next/link";
import BarChart from "./BarChart";
import { SellNextItem, UnpaidItem } from "./QuickActions";
import SyncNow from "./SyncNow";
import { courseDay, delta, seqLabel } from "@/lib/lessons/calc";
import {
  formatDay,
  formatTime,
  money,
  PAYMENT_BADGE,
  PAYMENT_LABEL,
  type DashboardData,
  type PackageRec,
} from "@/lib/lessons/types";

// The front page's sections, in the order Ian reads them on the tee:
// who is next, what money is out, who needs a call, how much he teaches.

const SHOW = 6;

function monthName(ym: string, style: "short" | "long"): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: style,
    ...(style === "long" ? { year: "numeric" } : {}),
  });
}

function compactMoney(cents: number): string {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(d >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(d)}`;
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (24 * 3600 * 1000),
  );
}

function ago(iso: string, now: string): string {
  const mins = Math.round(
    (new Date(now).getTime() - new Date(iso).getTime()) / 60000,
  );
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 36) return `${h}h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/* ---- Next up ----------------------------------------------------------- */

export function NextUp({ d }: { d: DashboardData }) {
  const n = d.next;
  if (!n) {
    return (
      <div className="card lb-next">
        <div className="lb-kicker">Next up</div>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Nothing booked. New calendar lessons appear after the nightly sync.
        </p>
      </div>
    );
  }
  const day = courseDay(n.startsAt);
  const when =
    day === courseDay(d.now)
      ? `Today · ${formatTime(n.startsAt)}`
      : `${formatDay(n.startsAt)} · ${formatTime(n.startsAt)}`;
  const seq = seqLabel(n);

  return (
    <Link
      href={n.clientId ? `/lessons/clients/${n.clientId}` : "/lessons/schedule"}
      className="card lb-next"
    >
      <div className="lb-kicker">Next up</div>
      <div className="lb-next-name">{n.clientName || n.titleRaw}</div>
      <div className="lb-next-when">{when}</div>
      <div className="lb-chips">
        {seq && (
          <span className="badge gray">
            {seq === "one-off" ? "One-off" : `Lesson ${seq}`}
          </span>
        )}
        {n.paymentStatus && (
          <span className={PAYMENT_BADGE[n.paymentStatus]}>
            {PAYMENT_LABEL[n.paymentStatus]}
          </span>
        )}
        {n.seq !== null && n.packageSize !== null && n.seq === n.packageSize && (
          <span className="badge open">Last of the package</span>
        )}
      </div>
    </Link>
  );
}

/* ---- Money ------------------------------------------------------------- */

function amount(cents: number, count: number): string {
  // A count with no money behind it is unpriced packages, not a zero balance.
  if (cents > 0) return money(cents);
  return count > 0 ? "—" : "$0";
}

export function MoneyTiles({ d }: { d: DashboardData }) {
  const m = d.money;
  return (
    <>
      <div className="lb-tiles">
        <div className="fin-stat strong">
          <div className="n">{amount(m.owedCents, m.unpaidCount)}</div>
          <div className="l">Owed · {m.unpaidCount} unpaid</div>
        </div>
        <div className="fin-stat">
          <div className="n">{amount(m.pendingCents, m.pendingCount)}</div>
          <div className="l">Pending · {m.pendingCount} charges</div>
        </div>
        <div className="fin-stat">
          <div className="n">{money(m.collectedMonthCents)}</div>
          <div className="l">Collected this month</div>
        </div>
        <div className="fin-stat">
          <div className="n">{money(m.collectedSeasonCents)}</div>
          <div className="l">Collected this season</div>
        </div>
      </div>
      {m.unpriced > 0 && (
        <Link href="/lessons/prices" className="notice warn lb-banner">
          <span>
            <strong>
              {m.unpriced} package{m.unpriced === 1 ? " has" : "s have"} no
              price
            </strong>
            , so the amounts above leave {m.unpriced === 1 ? "it" : "them"} out.
          </span>
          <span className="lb-banner-go">Set prices &rarr;</span>
        </Link>
      )}
    </>
  );
}

/* ---- Follow up --------------------------------------------------------- */

function Capped<T>({
  items,
  render,
}: {
  items: T[];
  render: (t: T) => React.ReactNode;
}) {
  const head = items.slice(0, SHOW);
  const rest = items.slice(SHOW);
  return (
    <ul className="lb-flist">
      {head.map(render)}
      {rest.length > 0 && (
        <li className="lb-more">
          <details>
            <summary>Show {rest.length} more</summary>
            <ul className="lb-flist">{rest.map(render)}</ul>
          </details>
        </li>
      )}
    </ul>
  );
}

function pkgName(p: PackageRec): string {
  return p.label || `${p.size}-lesson package`;
}

function PkgLink({ p, children }: { p: PackageRec; children: React.ReactNode }) {
  return (
    <Link href={`/lessons/clients/${p.clientId}`} className="lb-frow">
      <span className="lb-name">{p.clientName}</span>
      <span className="lb-sub">{children}</span>
    </Link>
  );
}

export function FollowUps({ d }: { d: DashboardData }) {
  return (
    <div className="lb-follow">
      <section className="card">
        <h3 className="lb-ftitle">
          Running out <span className="badge open">{d.runningOut.length}</span>
        </h3>
        <p className="lb-fhint">One lesson left: time to sell the next package.</p>
        {d.runningOut.length === 0 ? (
          <p className="empty">Nobody is about to run out.</p>
        ) : (
          <Capped
            items={d.runningOut}
            render={(p) => (
              <SellNextItem
                key={p.id}
                p={p}
                standardCents={d.standardPrices[p.size]}
              >
                <PkgLink p={p}>
                  {p.used} of {p.size} used
                  {p.booked > 0 && ` · ${p.booked} booked`}
                  {p.lastLessonAt && ` · last ${formatDay(p.lastLessonAt)}`}
                </PkgLink>
              </SellNextItem>
            )}
          />
        )}
      </section>

      <section className="card">
        <h3 className="lb-ftitle">
          Unpaid <span className="badge closed">{d.unpaid.length}</span>
        </h3>
        <p className="lb-fhint">Oldest first.</p>
        {d.unpaid.length === 0 ? (
          <p className="empty">Every package is paid or pending.</p>
        ) : (
          <Capped
            items={d.unpaid}
            render={(p) => (
              <UnpaidItem key={p.id} p={p}>
                <PkgLink p={p}>
                  {pkgName(p)} ·{" "}
                  {p.priceCents === null ? "no price" : money(p.priceCents)}
                  {p.soldOn && ` · sold ${formatDay(p.soldOn)}`}
                </PkgLink>
              </UnpaidItem>
            )}
          />
        )}
      </section>

      <section className="card">
        <h3 className="lb-ftitle">
          Not seen lately <span className="badge gray">{d.notSeen.length}</span>
        </h3>
        <p className="lb-fhint">
          Last lesson 30 days to 6 months ago, nothing booked.
        </p>
        {d.notSeen.length === 0 ? (
          <p className="empty">Everyone recent has something booked.</p>
        ) : (
          <Capped
            items={d.notSeen}
            render={(c) => (
              <li key={c.id}>
                <Link href={`/lessons/clients/${c.id}`} className="lb-frow">
                  <span className="lb-name">{c.name}</span>
                  <span className="lb-sub">
                    {formatDay(c.lastLessonAt)} ·{" "}
                    {daysBetween(c.lastLessonAt, d.now)} days
                  </span>
                </Link>
              </li>
            )}
          />
        )}
      </section>
    </div>
  );
}

/* ---- Teaching volume --------------------------------------------------- */

export function Volume({ d }: { d: DashboardData }) {
  const months = d.months;
  if (!months.length) return null;
  const cur = months[months.length - 1];
  const prev = months.length > 1 ? months[months.length - 2] : null;
  const lastYear = months.length === 13 ? months[0] : null;
  const vsPrev = prev ? delta(prev.lessons, months[months.length - 3]?.lessons ?? 0) : null;
  const revenue = months.some((m) => m.revenueCents > 0);
  const season = d.split.member + d.split.guest;

  const points = (pick: (m: (typeof months)[number]) => number) =>
    months.map((m, i) => ({
      label: monthName(m.month, "long"),
      short: monthName(m.month, "short"),
      value: pick(m),
      highlight: i === months.length - 1,
    }));

  return (
    <div className="card">
      <div className="lb-vol-head">
        <div>
          <div className="lb-hero">{cur.lessons}</div>
          <div className="lb-sub">
            {/* Counts booked ones later this month too, so say so. */}
            lessons taught &amp; booked in{" "}
            {monthName(cur.month, "long").split(" ")[0]}
          </div>
        </div>
        <div className="lb-vol-cmp">
          {prev && (
            <div>
              {monthName(prev.month, "long").split(" ")[0]}:{" "}
              <strong>{prev.lessons}</strong>
              {vsPrev && months.length > 2 && (
                <span className="muted">
                  {" "}
                  ({vsPrev.diff >= 0 ? "+" : ""}
                  {vsPrev.diff} on the month before)
                </span>
              )}
            </div>
          )}
          {lastYear && (
            <div>
              {monthName(lastYear.month, "long")}:{" "}
              <strong>{lastYear.lessons}</strong>
            </div>
          )}
        </div>
      </div>

      <BarChart
        points={points((m) => m.lessons)}
        ariaLabel="Lessons per month, last 13 months"
      />

      <div className="lb-vol-grid">
        <div>
          <h3 className="lb-ftitle">Top clients this season</h3>
          {d.topClients.length === 0 ? (
            <p className="empty">No lessons yet this season.</p>
          ) : (
            <ol className="lb-top">
              {d.topClients.map((c) => (
                <li key={c.id}>
                  <Link href={`/lessons/clients/${c.id}`}>{c.name}</Link>
                  <span className="lb-sub">{c.lessons}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h3 className="lb-ftitle">Members vs guests</h3>
          {season === 0 ? (
            <p className="empty">No lessons yet this season.</p>
          ) : (
            <>
              <div className="lb-split" aria-hidden="true">
                {d.split.member > 0 && (
                  <span style={{ flex: d.split.member }} className="m" />
                )}
                {d.split.guest > 0 && (
                  <span style={{ flex: d.split.guest }} className="g" />
                )}
              </div>
              <div className="lb-sub" style={{ marginTop: 6 }}>
                Members <strong>{d.split.member}</strong> · Guests{" "}
                <strong>{d.split.guest}</strong> this season
              </div>
              {d.split.member === 0 && (
                <p className="lb-fhint" style={{ marginTop: 6 }}>
                  No clients are marked as members yet &mdash; tick
                  &ldquo;Club member&rdquo; under a client&apos;s Details.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <h3 className="lb-ftitle" style={{ marginTop: 18 }}>
        Collected by month
      </h3>
      {revenue ? (
        <BarChart
          points={points((m) => m.revenueCents)}
          ariaLabel="Money collected per month, last 13 months"
          format={compactMoney}
          labels="key"
        />
      ) : (
        <p className="empty">
          Fills in as packages are marked paid &mdash; each one counts in the
          month it was paid.
        </p>
      )}
    </div>
  );
}

/* ---- Sync -------------------------------------------------------------- */

export function SyncLine({ d }: { d: DashboardData }) {
  const s = d.sync;
  const ok = s?.lastStatus === "ok";
  return (
    <div className="lb-syncline">
      <p className={!s?.lastSyncedAt || ok ? "lb-sync" : "lb-sync bad"}>
        {!s?.lastSyncedAt
          ? "Calendar sync has not run yet."
          : `Calendar synced ${ago(s.lastSyncedAt, d.now)} · ${ok ? "ok" : s.lastStatus}`}
        <br />
        <span>Runs nightly at 2am; tap to pull it now.</span>
      </p>
      <SyncNow />
    </div>
  );
}
