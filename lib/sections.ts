// ===========================================================================
// Section registry — the single source of truth for the umbrella app.
//
// Each "section" is an independent mini-app under the Pasatiempo umbrella:
//   - its own custom domain(s)      -> `hosts`
//   - its own isolated data          -> `schema` (a Postgres schema in the hub)
//   - its own internal route prefix  -> `pathPrefix`
//
// To add a new section later: add one entry here, create its schema in the hub
// project, add a route folder at app/<prefix>, and point its domain at the
// deployment. That is all a PUBLIC section needs.
//
// Access (who can use which staff app) is NOT decided here — see
// lib/hub/apps.ts (the apps and their roles) and lib/hub/access.ts (the
// checks). Staff sign in once with Supabase Auth; each app's pages call
// requireApp() and its server actions assertApp(). A super admin has every
// app. Public sites (events pages, MHI, El Sombrero) can be switched off by
// the super admin (hub.sites, enforced in proxy.ts).
//
// Caddies are not staff: the caddie portal carries its own cookie check in
// proxy.ts — see lib/caddie/session.ts.
//
// TODO(domains): replace the "*.example.com" placeholders with your real
// custom domains. The "*.local" and localhost entries make dev work without
// touching your hosts file.
// ===========================================================================

export type SectionKey = "events" | "mhi" | "sombrero" | "caddie" | "merch";

export interface Section {
  key: SectionKey;
  label: string;
  /** Postgres schema in the hub Supabase project (omit for static sections). */
  schema?: string;
  /** Internal Next.js route prefix (folder under app/). */
  pathPrefix: string;
  /** For a static-HTML section: the file in /public to serve (e.g. "/sombrero.html"). */
  staticFile?: string;
  /** Hostnames that resolve to this section (production + local aliases). */
  hosts: string[];
}

export const SECTIONS: Section[] = [
  {
    key: "events",
    label: "Event Planner",
    schema: "events",
    pathPrefix: "/events",
    hosts: [
      "pasatiempo-events.vercel.app", // current Event Planner domain
      // TODO: add a custom domain here too, e.g. "events.pasatiempo.com"
      "planner.local",
      "planner.local:3000",
    ],
  },
  {
    key: "mhi",
    label: "Marion Hollins Invitational",
    schema: "mhi",
    pathPrefix: "/mhi",
    hosts: [
      "marion-hollins-invitational-2026.vercel.app", // current MHI domain
      // TODO: add a custom domain here too, e.g. "marionhollinsinvitational.com"
      "mhi.local",
      "mhi.local:3000",
    ],
  },
  {
    key: "merch",
    label: "Pro Shop Merchandise Program",
    schema: "merch",
    pathPrefix: "/merch",
    hosts: [
      // Served by path for now: pasatiempo-app.vercel.app/merch.
      // TODO: add its own domain here later, e.g. "merch.pasatiempo.com"
      "merch.local",
      "merch.local:3000",
    ],
  },
  {
    key: "sombrero",
    label: "El Sombrero",
    // Real React route at app/sombrero (static content, no database).
    pathPrefix: "/sombrero",
    hosts: [
      "el-sombrero.example.com", // TODO: real El Sombrero domain
      "sombrero.local",
      "sombrero.local:3000",
    ],
  },
  {
    key: "caddie",
    label: "Caddie Program",
    schema: "caddie",
    // The CADDIE-FACING portal (availability, offers, my schedule). The Pro
    // Shop's dispatch board lives at /admin/caddie with the rest of staff.
    //
    // On its own subdomain because the sign-in QR codes bake the origin in
    // permanently: a link handed to a caddie today has to keep working, so the
    // address it points at should be one the club owns rather than a Vercel
    // deployment name. The umbrella host keeps serving /caddie by path as
    // well, so links issued before the domain existed do not break.
    pathPrefix: "/caddie",
    hosts: ["caddie.pasatiempo.com", "caddie.local", "caddie.local:3000"],
  },
];

/** Hostnames that serve the unified admin dashboard. */
export const ADMIN_HOSTS = [
  "admin.pasatiempo.com", // TODO: confirm / create this admin domain
  "admin.local",
  "admin.local:3000",
];

/** Localhost names where we route by PATH instead of by host (dev convenience). */
export const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

/** Strip a trailing :port so localhost:3300, localhost:3000, etc. all match. */
function hostname(host: string): string {
  return host.toLowerCase().split(":")[0];
}

/** Look up a section by an incoming Host header. Returns undefined if none match. */
export function sectionForHost(host: string | null): Section | undefined {
  if (!host) return undefined;
  const h = host.toLowerCase();
  return SECTIONS.find((s) => s.hosts.includes(h));
}

/** Look up a section by its internal path prefix (used on localhost path-routing). */
export function sectionForPath(pathname: string): Section | undefined {
  return SECTIONS.find(
    (s) => pathname === s.pathPrefix || pathname.startsWith(s.pathPrefix + "/"),
  );
}

export function isAdminHost(host: string | null): boolean {
  if (!host) return false;
  return ADMIN_HOSTS.includes(host.toLowerCase());
}

export function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  return LOCAL_HOSTS.includes(hostname(host));
}
