import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client — used ONLY for the admin login flow (sign in / out).
// All section data goes through server code, never this client.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
