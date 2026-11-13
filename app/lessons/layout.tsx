// Ian's teaching book. Loads the shared design system, the same as /admin,
// then the lesson book's own layer on top: the club's "clubhouse" look from
// the Event Planner - its two faces and its palette - kept in lessons.css so
// a later change to the planner cannot reach in and break this book.
import "../globals.css";
import "./lessons.css";
import { display, text } from "@/components/events/fonts";

export const metadata = {
  title: "Lesson Book",
  // Nobody but Ian can open it, so there is nothing here worth indexing.
  robots: { index: false, follow: false },
};

export default function LessonsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `.lb` scopes everything in lessons.css; the font variables are the same
  // EB Garamond and Libre Franklin instances the Event Planner loads, so they
  // are downloaded once.
  return (
    <div className={`lb ${display.variable} ${text.variable}`}>{children}</div>
  );
}
