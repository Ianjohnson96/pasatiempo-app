import { notFound, redirect } from "next/navigation";
import AppBar from "@/components/events/AppBar";
import EventEditor from "@/components/events/EventEditor";
import { getEvent, registrationsFor } from "@/lib/events/data";
import { canManageEvent, requireEventsViewer } from "@/lib/events/auth";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireEventsViewer();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  if (!canManageEvent(viewer, event)) redirect("/admin");
  const registrationCount = (await registrationsFor(event.id)).length;

  return (
    <>
      <AppBar admin email={viewer.email} />
      <main className="container wide">
        <div className="page-head">
          <div>
            <p className="ph-eyebrow">Event Planner</p>
            <h1>Edit event</h1>
            <div className="sub">{event.title}</div>
          </div>
        </div>
        <EventEditor event={event} registrationCount={registrationCount} />
      </main>
    </>
  );
}
