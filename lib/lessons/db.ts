import { createClient } from "@/lib/supabase/server";

// The lesson book talks to Postgres as the SIGNED-IN USER, not service_role.
//
// This is deliberately unlike the rest of the app, where tables are reached
// through a schema-pinned service_role client. These tables carry real RLS:
// every policy calls lesson_is_owner(), which checks auth.uid() against
// public.lesson_owners. service_role would bypass the one mechanism that keeps
// this data private to Ian, and privacy is the point - what a member pays for
// lessons is nobody else's business at the club.
//
// So the page gate and the database agree, and the database has the final say.
export async function lessonBookClient() {
  return createClient();
}
