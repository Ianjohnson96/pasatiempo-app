import { createAdminClient as createSectionAdmin } from "@/lib/supabase/admin";

// MHI reads its tables through the hub's service_role client, PINNED to the
// `mhi` schema. This thin wrapper lets the ported teams.ts keep importing
// `./supabase` unchanged.
export function createAdminClient() {
  return createSectionAdmin("mhi");
}

// True when the server-side Supabase env vars are present. Lets the page render
// the "TBA" placeholder gracefully if the DB isn't reachable.
export function hasSupabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
