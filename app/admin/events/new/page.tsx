import { redirect } from "next/navigation";
import AppBar from "@/components/events/AppBar";
import EventEditor from "@/components/events/EventEditor";
import { getViewer } from "@/lib/events/auth";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return (
    <>
      <AppBar admin email={viewer.email} />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>New event</h1>
            <div className="sub">
              You can edit any of this later. A private link is created when you
              save.
            </div>
          </div>
        </div>
        <EventEditor />
      </main>
    </>
  );
}
