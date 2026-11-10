// Pure CSV builders for the registrations export (no React / Supabase).

import { answerText, formatSlot } from "./format";
import type { EventRec, Player, Registration } from "./types";

// A cell a spreadsheet would run as a formula gets a leading ' so it opens as
// text. A plain negative number ("-12") is left alone.
function guardFormula(v: string): string {
  if (/^[=+@\t\r]/.test(v)) return `'${v}`;
  if (v.startsWith("-") && !/^-\d+(\.\d+)?$/.test(v)) return `'${v}`;
  return v;
}

export function csvCell(raw: string): string {
  const v = guardFormula(raw);
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((c) => csvCell(String(c))).join(",")).join("\r\n");
}

function slotLabels(ev: EventRec, slotIds: string[]): string {
  return slotIds
    .map((id) => ev.slots.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => formatSlot(s))
    .join("; ");
}

export function signupRows(event: EventRec, regs: Registration[]): string[][] {
  const cols = [
    "Status",
    "Name",
    "Email",
    "Phone",
    "Party size",
    ...(event.slots.length ? ["Slot"] : []),
    ...(event.collectGuestNames ? ["Guests"] : []),
    ...event.customFields.map((f) => f.label),
    "Registered at",
  ];
  const rows = regs.map((r) => [
    r.status,
    r.name,
    r.email,
    r.phone,
    String(r.partySize),
    ...(event.slots.length ? [slotLabels(event, r.slotIds)] : []),
    ...(event.collectGuestNames ? [r.guestNames.join("; ")] : []),
    ...event.customFields.map((f) => answerText(r.answers[f.id])),
    new Date(r.createdAt).toLocaleString(),
  ]);
  return [cols, ...rows];
}

const byCreated = (a: Registration, b: Registration) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

// The one team numbering, shared by the CSV, the Manage page and the printed
// roster: every non-cancelled team (confirmed and waitlist) in entry order.
// Cancelled teams get no number.
export function teamNumbers(regs: Registration[]): Map<string, number> {
  const nums = new Map<string, number>();
  regs
    .filter((r) => r.status !== "cancelled")
    .sort(byCreated)
    .forEach((r, i) => nums.set(r.id, i + 1));
  return nums;
}

export function tournamentRows(event: EventRec, regs: Registration[]): string[][] {
  const playerFields = event.customFields.filter((f) => f.scope !== "team");
  const teamFields = event.customFields.filter((f) => f.scope === "team");
  const header = [
    "Team #",
    "Role",
    "Name",
    "Email",
    "GHIN",
    "Phone",
    ...playerFields.map((f) => f.label),
    ...teamFields.map((f) => f.label),
    "Status",
    "Registered at",
  ];

  const nums = teamNumbers(regs);
  const active = regs.filter((r) => r.status !== "cancelled").sort(byCreated);
  const cancelled = regs.filter((r) => r.status === "cancelled").sort(byCreated);

  const rows: string[][] = [];
  const emit = (r: Registration, teamNo: string) => {
    const players: Player[] = r.players?.length
      ? r.players
      : [{ role: "member", name: r.name, email: r.email, ghin: "", answers: {} }];
    const when = new Date(r.createdAt).toLocaleString();
    for (const p of players) {
      rows.push([
        teamNo,
        p.role === "member" ? "Member" : "Guest",
        p.name,
        p.email,
        p.ghin,
        p.role === "member" ? r.phone : "",
        ...playerFields.map((f) => answerText(p.answers[f.id])),
        ...teamFields.map((f) => answerText(r.answers[f.id])),
        r.status,
        when,
      ]);
    }
  };
  active.forEach((r) => emit(r, String(nums.get(r.id))));
  cancelled.forEach((r) => emit(r, ""));
  return [header, ...rows];
}

export function csvFilename(event: EventRec): string {
  const slug = event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `${slug}-${event.type === "tournament" ? "teams" : "signups"}.csv`;
}
