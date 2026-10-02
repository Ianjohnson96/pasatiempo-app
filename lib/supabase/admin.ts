import { createClient as createSbClient } from "@supabase/supabase-js";
import type { SectionKey } from "@/lib/sections";
import { SECTIONS } from "@/lib/sections";

// Server-only client using the service_role key. Bypasses Row Level Security.
// Every section does its table reads/writes through this client, PINNED to its
// own Postgres schema so data never crosses between sections.
//
// Usage:  const supa = createAdminClient("events");   // -> events.* tables
//         const supa = createAdminClient("mhi");       // -> mhi.* tables
export function createAdminClient(section: SectionKey) {
  const schema = SECTIONS.find((s) => s.key === section)?.schema;
  if (!schema) throw new Error(`Unknown section: ${section}`);

  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// The lesson book has no factory here on purpose. Its tables carry real RLS
// tied to lesson_owners, so it talks to Postgres as the signed-in user via
// lib/lessons/db.ts - service_role would bypass the one thing keeping that
// data private from the rest of the staff.

// Server-only client for the hub's own schema: people, per-app access and
// public-site switches (lib/hub/access.ts). Same service_role key.
export function createHubClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "hub" },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
