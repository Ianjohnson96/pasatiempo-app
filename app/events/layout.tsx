// Loads the events design system for all /events routes only, then the Event
// Planner's own scoped layer (fonts + `.ep` overrides) on top of it.
import "../globals.css";
import "../event-planner.css";
import { plannerClass } from "@/components/events/fonts";

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={plannerClass}>{children}</div>;
}
