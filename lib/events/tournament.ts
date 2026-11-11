// Pure rules for tournament teams (a Member + a Guest): GHIN handling, answer
// checks, team validation and duplicate detection. No database access.
import type {
  Answer,
  Answers,
  CustomField,
  EventRec,
  FieldScope,
  Player,
  PlayerRole,
  RegStatus,
  Registration,
} from "./types";

export interface TeamInput {
  players: Player[];
  teamAnswers: Answers;
}

const ROLES: PlayerRole[] = ["member", "guest"];
const ROLE_LABEL: Record<PlayerRole, string> = {
  member: "Member",
  guest: "Guest",
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeGhin(s: string): string {
  return s.replace(/[\s-]/g, "").trim();
}

export function isValidGhin(s: string): boolean {
  const g = normalizeGhin(s);
  return g !== "" && /^\d+$/.test(g);
}

export function isAnswered(a: Answer | undefined): boolean {
  if (a === undefined) return false;
  if (Array.isArray(a)) return a.some((x) => x.trim() !== "");
  return a.trim() !== "";
}

// First required field in scope that has no answer, or null.
export function missingRequired(
  fields: CustomField[],
  answers: Answers,
  scope: FieldScope | "all",
): CustomField | null {
  for (const f of fields) {
    if (!f.required) continue;
    if (scope !== "all" && f.scope !== scope) continue;
    if (!isAnswered(answers[f.id])) return f;
  }
  return null;
}

function cleanAnswers(
  answers: Answers,
  fields: CustomField[],
  scope: FieldScope,
): Answers {
  const out: Answers = {};
  for (const f of fields) {
    if (f.scope !== scope) continue;
    const a = answers?.[f.id];
    if (a === undefined) continue;
    out[f.id] = Array.isArray(a)
      ? a.map((x) => x.trim()).filter((x) => x !== "")
      : a.trim();
  }
  return out;
}

// Server actions receive client data. Keep only string or string[] answers so
// the trim-based checks below can't throw on null, numbers or objects.
export function coerceAnswers(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v))
      out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

// Shape untrusted input into a TeamInput: exactly two players (missing ones
// empty), string fields, string/string[] answers. Roles follow position.
export function coerceTeam(raw: unknown): TeamInput {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.players) ? r.players.slice(0, 2) : [];
  const players = ROLES.map((role, i) => {
    const p = (list[i] && typeof list[i] === "object" ? list[i] : {}) as Record<
      string,
      unknown
    >;
    return {
      role,
      name: String(p.name ?? ""),
      email: String(p.email ?? ""),
      ghin: String(p.ghin ?? ""),
      answers: coerceAnswers(p.answers),
    };
  });
  return { players, teamAnswers: coerceAnswers(r.teamAnswers) };
}

export function cleanTeam(input: TeamInput, fields: CustomField[]): TeamInput {
  const players = ROLES.map((role, i) => {
    const p = input.players[i];
    return {
      role,
      name: (p?.name ?? "").trim(),
      email: (p?.email ?? "").trim().toLowerCase(),
      ghin: normalizeGhin(p?.ghin ?? ""),
      answers: cleanAnswers(p?.answers ?? {}, fields, "player"),
    };
  });
  return {
    players,
    teamAnswers: cleanAnswers(input.teamAnswers ?? {}, fields, "team"),
  };
}

function playerError(p: Player): string | null {
  if (!p.name.trim()) return "please enter a name.";
  if (!EMAIL_RE.test(p.email.trim())) return "please enter a valid email.";
  if (!normalizeGhin(p.ghin)) return "please enter a GHIN number.";
  if (!isValidGhin(p.ghin)) return "GHIN numbers are digits only.";
  return null;
}

export function validateTeam(
  event: EventRec,
  team: TeamInput,
  opts: { enforceRequired: boolean },
): string | null {
  const players = ROLES.map((role, i) => ({ role, p: team.players[i] }));
  for (const { role, p } of players) {
    const err = p ? playerError(p) : "please enter a name.";
    if (err) return `${ROLE_LABEL[role]}: ${err}`;
  }
  const [m, g] = team.players;
  if (
    m.email.trim().toLowerCase() === g.email.trim().toLowerCase() ||
    normalizeGhin(m.ghin) === normalizeGhin(g.ghin)
  ) {
    return "The member and guest can't be the same person.";
  }
  if (opts.enforceRequired) {
    for (const { role, p } of players) {
      const f = missingRequired(event.customFields, p.answers, "player");
      if (f) return `${ROLE_LABEL[role]}: please answer ${f.label}.`;
    }
    const f = missingRequired(event.customFields, team.teamAnswers, "team");
    if (f) return `Please answer ${f.label}.`;
  }
  return null;
}

// The first incoming player (member first) already on another live team.
export function findDuplicate(
  regs: Registration[],
  team: TeamInput,
  excludeRegId?: string,
): PlayerRole | null {
  const others = regs.filter(
    (r) =>
      r.players != null &&
      r.id !== excludeRegId &&
      (r.status === "confirmed" || r.status === "waitlist"),
  );
  const emails = new Set<string>();
  const ghins = new Set<string>();
  for (const r of others) {
    for (const p of r.players ?? []) {
      const e = p.email.trim().toLowerCase();
      const g = normalizeGhin(p.ghin);
      if (e) emails.add(e);
      if (g) ghins.add(g);
    }
  }
  for (const role of ROLES) {
    const p = team.players.find((x) => x.role === role);
    if (!p) continue;
    const e = p.email.trim().toLowerCase();
    const g = normalizeGhin(p.ghin);
    if ((e && emails.has(e)) || (g && ghins.has(g))) return role;
  }
  return null;
}

// A status change that brings a cancelled team back onto the live list
// (confirmed or waitlist) must be checked for duplicates first: its players
// may have entered another team while it was cancelled.
export function needsDuplicateCheck(from: RegStatus, to: RegStatus): boolean {
  return from === "cancelled" && (to === "confirmed" || to === "waitlist");
}

export function duplicateMessage(role: PlayerRole): string {
  return role === "guest"
    ? "That guest is already entered on another team. Questions? Contact the golf shop."
    : "You're already entered on another team. Questions? Contact the golf shop.";
}
