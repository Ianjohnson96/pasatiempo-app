import { createClient } from "@/lib/supabase/server";

/** True when someone is signed in to Supabase Auth, member or not. */
export async function isSignedIn(): Promise<boolean> {
  try {
    const supa = await createClient();
    const {
      data: { user },
    } = await supa.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}
