import Link from "next/link";
import { createHubClient } from "@/lib/supabase/admin";
import { requireSuper } from "@/lib/hub/access";
import { APPS, SITES } from "@/lib/hub/apps";

export const dynamic = "force-dynamic";

// Super admin: the most recent changes to access, passwords, site switches and
// month-end data (hub.activity, written by lib/hub/log.ts).

const FILTERS: Record<string, string> = {
  all: "Everything",
  hub: "People",
  events: APPS.events.label,
  caddie: APPS.caddie.label,
  merch: APPS.merch.label,
  sites: "Public sites",
};

interface Row {
  id: number;
  at: string;
  actor: string | null;
  app: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
}

const appName = (a: string | null) => (a && a in APPS ? APPS[a as keyof typeof APPS].label : a === "sites" ? "Public sites" : "");

function describe(r: Row, who: (e: string | null) => string): string {
  const t = who(r.target);
  const d = r.detail || {};
  switch (r.action) {
    case "person.add": return `added ${t}`;
    case "person.remove": return `removed ${t} from every app`;
    case "person.restore": return `restored ${t}`;
    case "super.grant": return `made ${t} a super admin`;
    case "super.remove": return `removed ${t}'s super admin access`;
    case "password.set": return `set a new password for ${t}`;
    case "password.reset_requested": return `${t} asked for a password reset email`;
    case "password.reset_done": return `${t} set a new password from a reset email`;
    case "access.grant": return `gave ${t} ${d.role} in the ${appName(r.app)}`;
    case "access.change": return `changed ${t} from ${d.from} to ${d.role} in the ${appName(r.app)}`;
    case "access.remove": return `removed ${t}'s access to the ${appName(r.app)}${d.from ? ` (was ${d.from})` : ""}`;
    case "site.off": return `switched off ${SITES[r.target as keyof typeof SITES]?.label ?? r.target}`;
    case "site.on": return `switched on ${SITES[r.target as keyof typeof SITES]?.label ?? r.target}`;
    case "merch.data_loaded": return `loaded month-end data (${d.documents} documents)${d.note ? ` — ${d.note}` : ""}`;
    default: return r.action;
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ app?: string }> }) {
  const me = await requireSuper();
  const { app } = await searchParams;
  const filter = app && app in FILTERS ? app : "all";
  const hub = createHubClient();
  let q = hub.from("activity").select("id, at, actor, app, action, target, detail").order("at", { ascending: false }).limit(300);
  if (filter !== "all") q = q.eq("app", filter);
  const [{ data, error }, { data: people }] = await Promise.all([q, hub.from("people").select("email, name")]);
  const names = new Map((people ?? []).map((p) => [p.email, p.name]));
  const who = (e: string | null) => (e ? names.get(e) || e : "Someone");
  const rows = (data ?? []) as Row[];

  return (
    <>
      <div className="appbar">
        <div className="appbar-inner">
          <Link href="/admin" className="brand">
            <span className="mark">P</span> Pasatiempo Admin
          </Link>
          <span className="spacer" />
          <Link href="/admin" className="navlink">Dashboard</Link>
          <Link href="/admin/people" className="navlink">People &amp; access</Link>
          <span className="navlink">{me.email}</span>
        </div>
      </div>
      <main className="container">
        <div className="page-head">
          <div>
            <h1>Activity</h1>
            <div className="sub">Who changed access, passwords, public sites and month-end data. Times are Pacific. Latest 300.</div>
          </div>
        </div>
        <div className="seg" style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(FILTERS).map(([k, label]) => (
            <Link key={k} href={k === "all" ? "/admin/activity" : `/admin/activity?app=${k}`} className={"btn small " + (k === filter ? "" : "secondary")}>
              {label}
            </Link>
          ))}
        </div>
        {error && <div className="notice">The activity log couldn&apos;t be loaded. Reload to try again.</div>}
        {!error && !rows.length && <div className="notice">Nothing recorded yet.</div>}
        {!!rows.length && (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 560 }}>
              <thead>
                <tr><th>When</th><th>Who</th><th>What</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{when(r.at)}</td>
                    <td>{r.actor ? who(r.actor) : <span className="muted">System</span>}</td>
                    <td>{describe(r, who)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
