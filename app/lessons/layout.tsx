// Ian's teaching book. Loads the shared design system, the same as /admin.
import "../globals.css";

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
  return children;
}
