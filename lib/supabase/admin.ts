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
