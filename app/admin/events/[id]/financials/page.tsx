import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppBar from "@/components/events/AppBar";
import FinancialsPanel from "@/components/events/FinancialsPanel";
import { getEvent, registrationsFor } from "@/lib/events/data";
import { getFinance, listPrizes } from "@/lib/events/finance-data";
import { getViewer } from "@/lib/events/auth";

export const dynamic = "force-dynamic";

// Clinic financials — fees collected, prize spend, and what each pro is owed.
//
// Global admins ONLY. Event co-managers can run the roster but never see money,
// so this deliberately checks `isGlobalAdmin` rather than `canManageEvent`.
export default async function FinancialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!viewer.isGlobalAdmin) redirect("/admin");

  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [registrations, finance, prizes] = await Promise.all([
    registrationsFor(id),
    getFinance(id),
    listPrizes(id),
  ]);

  return (
    <>
      <AppBar admin email={viewer.email} />
      <main className="container">
        <div style={{ marginBottom: 14 }}>
          <Link
            href={`/admin/events/${event.id}`}
            className="navlink"
            style={{ color: "var(--green)" }}
          >
            ← Back to event
          </Link>
        </div>
        <div className="page-head">
          <div className="ph-text">
            <h1>Financials</h1>
            <div className="sub">{event.title}</div>
          </div>
        </div>
        <FinancialsPanel
          event={event}
          registrations={registrations}
          finance={finance}
          prizes={prizes}
        />
      </main>
    </>
  );
}
