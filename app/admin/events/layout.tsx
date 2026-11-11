// The Event Planner admin pages. app/admin/layout.tsx still wraps these (it
// loads globals.css); this adds only the planner's scoped layer and fonts.
import "../../event-planner.css";
import { plannerClass } from "@/components/events/fonts";

export default function AdminEventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={plannerClass}>{children}</div>;
}
