import Link from "next/link";

// Shared chrome for the three caddie admin screens. A server component — it
// only needs the signed-in email, which the page already has.

const TABS = [
  { href: "/admin/caddie", key: "dispatch", label: "Dispatch" },
  { href: "/admin/caddie/calendar", key: "calendar", label: "Calendar" },
  {
    href: "/admin/caddie/availability",
    key: "availability",
    label: "Who's free",
  },
  { href: "/admin/caddie/roster", key: "roster", label: "Roster" },
  { href: "/admin/caddie/rates", key: "rates", label: "Rates" },
] as const;

export type CaddieTab = (typeof TABS)[number]["key"];

export default function CaddieHeader({
  email,
  active,
}: {
  email: string;
  active: CaddieTab;
}) {
  return (
    <>
      <div className="appbar">
        <div className="appbar-inner">
          <Link href="/admin" className="brand">
            <span className="mark">P</span> Pasatiempo Admin
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
