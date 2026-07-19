import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppBar from "@/components/events/AppBar";
import EventManager from "@/components/events/EventManager";
import PhotoManager from "@/components/events/PhotoManager";
import { getEvent, registrationsFor } from "@/lib/events/data";
import { canManageEvent, getViewer } from "@/lib/events/auth";

export const dynamic = "force-dynamic";

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  if (!canManageEvent(viewer, event)) redirect("/admin");
  const registrations = await registrationsFor(id);

  return (
    <>
      <AppBar admin email={viewer.email} />
      <main className="container">
        <div style={{ marginBottom: 14 }}>
          <Link href="/admin/events" className="navlink" style={{ color: "var(--green)" }}>
            ← All events
          </Link>
        </div>
        <EventManager event={event} registrations={registrations} />
        <div style={{ height: 18 }} />
        <PhotoManager
          eventId={event.id}
          photos={event.photos}
          mode={event.galleryMode}
        />
      </main>
    </>
  );
}
