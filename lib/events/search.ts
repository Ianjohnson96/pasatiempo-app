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
