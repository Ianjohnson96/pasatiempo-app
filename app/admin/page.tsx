import "../hub.css";
import { redirect } from "next/navigation";
import { createAdminClient, createHubClient } from "@/lib/supabase/admin";
import { getPerson, hasApp, isAppAdmin, roleIn, signedInEmail } from "@/lib/hub/access";
import { APPS, type AppKey } from "@/lib/hub/apps";
import HubView from "@/components/hub/HubView";
import { listClientSummaries, listPackages } from "@/lib/lessons/data";
import { reportStatus } from "@/lib/merch/reminders";
import { pacificToday } from "@/lib/merch/schedule";

// Staff dashboard — one home for every Pasatiempo app. The proxy makes sure
// someone is signed in; each tile below appears only for people with access to
// that app (lib/hub/access.ts). The super admin also sees the public-site
// switches and People & access.
//
// Every tile carries a photograph of the course rather than an icon. The club
// is the brand, and a hub that looks like any other dashboard tells staff
// nothing about where they are.
export const dynamic = "force-dynamic";

async function eventsStats() {
  try {
    const s = createAdminClient("events");
    const [{ count: events }, { count: regs }] = await Promise.all([
      s.from("events").select("*", { count: "exact", head: true }),
      s.from("registrations").select("*", { count: "exact", head: true }),
    ]);
    return { events: events ?? 0, regs: regs ?? 0, ok: true };
  } catch {
    return { events: 0, regs: 0, ok: false };
  }
}

async function mhiStats() {
  try {
    const s = createAdminClient("mhi");
    const [{ count: teams }, { count: players }] = await Promise.all([
      s.from("teams").select("*", { count: "exact", head: true }),
      s.from("team_players").select("*", { count: "exact", head: true }),
    ]);
    return { teams: teams ?? 0, players: players ?? 0, ok: true };
  } catch {
    return { teams: 0, players: 0, ok: false };
  }
}

async function caddieStats() {
  try {
    const s = createAdminClient("caddie");
    const [{ count: caddies }, { count: open }] = await Promise.all([
      s
        .from("caddies")
        .select("*", { count: "exact", head: true })
        .eq("status", "Active"),
      s
        .from("loops")
        .select("*", { count: "exact", head: true })
        .in("status", ["Unassigned", "Partially Assigned"]),
    ]);
    return { caddies: caddies ?? 0, open: open ?? 0, ok: true };
  } catch {
    return { caddies: 0, open: 0, ok: false };
  }
}

// Ian's teaching book. Counts rather than money: most packages still have no
// price recorded, so a total would read "$0 owed" and imply he is square when
// he is not.
//
// Wrapped like the rest, and the catch matters here - these tables are
// RLS-protected, so a reader outside lesson_owners gets nothing back, and an
// unguarded throw would take the whole hub down rather than one tile.
async function lessonStats() {
  try {
    const [packages, clients] = await Promise.all([
      listPackages(),
      listClientSummaries(),
    ]);
    return {
      clients: clients.filter((c) => c.active).length,
      unpaid: packages.filter((p) => p.paymentStatus === "unpaid").length,
      pending: packages.filter((p) => p.paymentStatus === "pending").length,
      runningOut: packages.filter((p) => !p.isComplete && p.remaining <= 1)
        .length,
      ok: true,
    };
  } catch {
    return { clients: 0, unpaid: 0, pending: 0, runningOut: 0, ok: false };
  }
}

async function siteSwitches(): Promise<Record<string, boolean>> {
  const { data } = await createHubClient().from("sites").select("key, enabled");
  return Object.fromEntries((data ?? []).map((s) => [s.key, s.enabled]));
}

// The Pro Shop's reporting calendar: what's due or overdue right now (lib/merch/schedule.ts).
async function merchReports() {
  try {
    const open = await reportStatus(pacificToday());
    return open.filter((r) => r.status === "due" || r.status === "overdue");
  } catch {
    return [];
  }
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  const person = await getPerson();
  const email = person?.email ?? (await signedInEmail());
  // The proxy already sends signed-out visitors to /login; this keeps the page safe on its own.
  if (!email) redirect("/login");
  const see = (app: AppKey) => hasApp(person, app);
  const isSuper = !!person?.isSuper;
  const managesPeople = !!person && (isSuper || (Object.keys(APPS) as AppKey[]).some((a) => isAppAdmin(person, a)));

  const [ev, mhi, cad, sites, reports, lsn] = await Promise.all([
    see("events") ? eventsStats() : null,
    isSuper ? mhiStats() : null,
    see("caddie") ? caddieStats() : null,
    isSuper ? siteSwitches() : Promise.resolve({} as Record<string, boolean>),
    see("merch") ? merchReports() : Promise.resolve([]),
    // Nobody is granted `lessons`, so only a super admin gets this far.
    see("lessons") ? lessonStats() : null,
  ]);
  const keys = Object.keys(APPS) as AppKey[];
  return (
    <HubView
      email={email}
      isSuper={isSuper}
      managesPeople={managesPeople}
      denied={denied}
      apps={Object.fromEntries(keys.map((k) => [k, see(k)]))}
      roles={Object.fromEntries(keys.map((k) => [k, roleIn(person, k) ?? ""]).filter(([, r]) => r))}
      ev={ev}
      mhi={mhi}
      cad={cad}
      sites={sites}
      reports={reports}
      lsn={lsn}
    />
  );
}
