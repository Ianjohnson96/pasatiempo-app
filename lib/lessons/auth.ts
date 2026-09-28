import { assertApp, requireApp } from "@/lib/hub/access";

// The lesson book is Ian's alone. One role, `owner`, granted to nobody in
// hub.access - a super admin holds it automatically (see lib/hub/apps.ts), so
// it needs no grant row and stays invisible to the rest of the staff.
//
// Pages call requireLessonBook(); every server action calls assertLessonBook().
// A page check is not a permission: server actions are public endpoints.

export interface LessonViewer {
  email: string;
}

export async function requireLessonBook(): Promise<LessonViewer> {
  const p = await requireApp("lessons");
  return { email: p.email };
}

export async function assertLessonBook(): Promise<LessonViewer> {
  const p = await assertApp("lessons");
  return { email: p.email };
}
