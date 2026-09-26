// The staff apps under the Pasatiempo umbrella and the roles each one grants.
// Shared by server and client code (no imports), so the people page and the
// access checks agree on what exists.

export const APPS = {
  events: {
    label: "Event Planner",
    home: "/admin/events",
    roles: ["admin", "manager"],
    roleHelp: {
      admin: "Every event, plus financials",
      manager: "Only events they created or co-manage",
    },
  },
  caddie: {
    label: "Caddie Program",
    home: "/admin/caddie",
    roles: ["admin", "staff"],
    roleHelp: {
      admin: "Everything, plus the fair-share ledger",
      staff: "Dispatch board, roster, availability, rates and tiers",
    },
  },
  merch: {
    label: "Merchandise Program",
    home: "/merch",
    roles: ["owner", "staff", "viewer"],
    roleHelp: {
      owner: "Forecast, budgets, brand calls and month-end data",
      staff: "Orders, receipts, vendors, counts and the checklist",
      viewer: "Look only",
    },
  },
} as const;

export type AppKey = keyof typeof APPS;
export type AppRole<A extends AppKey = AppKey> = (typeof APPS)[A]["roles"][number];

export const APP_KEYS = Object.keys(APPS) as AppKey[];

/** The role that runs the app (and manages its people). A super admin has it everywhere. */
export function topRole<A extends AppKey>(app: A): AppRole<A> {
  return APPS[app].roles[0] as AppRole<A>;
}

export function isRole<A extends AppKey>(app: A, role: unknown): role is AppRole<A> {
  return (APPS[app].roles as readonly string[]).includes(role as string);
}

// Public sites the super admin can switch off.
export const SITES = {
  events: { label: "Event pages (sign-ups)", prefix: "/events" },
  mhi: { label: "Marion Hollins Invitational", prefix: "/mhi" },
  sombrero: { label: "El Sombrero", prefix: "/sombrero" },
} as const;

export type SiteKey = keyof typeof SITES;

export function siteForPath(path: string): SiteKey | null {
  for (const [k, s] of Object.entries(SITES))
    if (path === s.prefix || path.startsWith(s.prefix + "/")) return k as SiteKey;
  return null;
}
