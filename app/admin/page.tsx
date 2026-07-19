import Link from "next/link";
import { SECTIONS } from "@/lib/sections";

// Unified admin dashboard — one place to manage every section.
// All admins see every section; access is gated by the proxy (signed-in user).
export const dynamic = "force-dynamic";

// Which sections have a management UI wired up yet.
const ADMIN_ROUTE: Record<string, string | null> = {
  events: "/admin/events",
  mhi: null, // built in a later phase
};

export default function AdminHome() {
  return (
    <main className="wrap">
      <p className="eyebrow">Pasatiempo</p>
      <h1>Admin</h1>
      <p className="lead">
        Manage every section from one place. Each section&apos;s tools read and
        write only its own data.
      </p>

      <div className="evlist">
        {SECTIONS.map((s) => {
          const route = ADMIN_ROUTE[s.key];
          const inner = (
            <div className="evrow">
              <div className="ev-main">
                <div className="ev-title">{s.label}</div>
                <div className="ev-meta">
                  <span>schema: {s.schema}</span>
                  <span>{route ? "manage →" : "coming soon"}</span>
                </div>
              </div>
            </div>
          );
          return route ? (
            <Link key={s.key} href={route} style={{ color: "inherit" }}>
              {inner}
            </Link>
          ) : (
            <div key={s.key} style={{ opacity: 0.6 }}>
              {inner}
            </div>
          );
        })}
      </div>

      <form action="/auth/signout" method="post" style={{ marginTop: 28 }}>
        <button className="btn secondary small" type="submit">
          Sign out
        </button>
      </form>
    </main>
  );
}
