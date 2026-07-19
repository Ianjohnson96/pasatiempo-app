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
// deployment. Nothing else needs to change.
//
// TODO(domains): replace the "*.example.com" placeholders with your real
// custom domains. The "*.local" and localhost entries make dev work without
// touching your hosts file.
// ===========================================================================

export type SectionKey = "events" | "mhi" | "sombrero";

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
    key: "sombrero",
    label: "El Sombrero",
    // Static-HTML microsite (no database) served straight from /public.
    pathPrefix: "/sombrero",
    staticFile: "/sombrero.html",
    hosts: [
      "el-sombrero.example.com", // TODO: real El Sombrero domain
      "sombrero.local",
      "sombrero.local:3000",
    ],
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
