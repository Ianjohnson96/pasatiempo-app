import { notFound, redirect } from "next/navigation";
import AppBar from "@/components/events/AppBar";
import EventEditor from "@/components/events/EventEditor";
import { getEvent } from "@/lib/events/data";
import { canManageEvent, getViewer } from "@/lib/events/auth";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
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

  return (
    <>
      <AppBar admin email={viewer.email} />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>Edit event</h1>
            <div className="sub">{event.title}</div>
          </div>
        </div>
        <EventEditor event={event} />
      </main>
    </>
  );
}
