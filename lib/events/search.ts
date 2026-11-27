// The Manage page's search box: does a sign-up match what staff typed?
import type { Registration } from "./types";

const digits = (s: string) => s.replace(/\D/g, "");

/** Every word of the query must appear in the sign-up's names, emails, GHINs or phone. */
export function matchesRegSearch(r: Registration, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [
    r.name,
    r.email,
    r.phone,
    ...r.guestNames,
    ...(r.players ?? []).flatMap((p) => [p.name, p.email, p.ghin]),
  ]
    .join(" ")
    .toLowerCase();
  const phone = digits(r.phone);
  return words.every(
    (w) => text.includes(w) || (w.length >= 4 && digits(w) === w && phone.includes(w)),
  );
}

export type RegFilter = "all" | "confirmed" | "waitlist" | "cancelled" | "email";
export const REG_FILTERS: { id: RegFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "confirmed", label: "Confirmed" },
  { id: "waitlist", label: "Waitlist" },
  { id: "cancelled", label: "Cancelled" },
  { id: "email", label: "Email not sent" },
];

/** The Manage page's filter buttons. "Email not sent" ignores cancelled sign-ups. */
export function matchesRegFilter(r: Registration, f: RegFilter): boolean {
  if (f === "all") return true;
  if (f === "email") return r.emailFailed && r.status !== "cancelled";
  return r.status === f;
}

export function regFilterCounts(regs: Registration[]): Record<RegFilter, number> {
  const out = { all: 0, confirmed: 0, waitlist: 0, cancelled: 0, email: 0 };
  for (const r of regs)
    for (const f of REG_FILTERS) if (matchesRegFilter(r, f.id)) out[f.id]++;
  return out;
}
