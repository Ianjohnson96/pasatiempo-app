import { createSign } from "node:crypto";

// Google, app-only and read-only: a service account reads the receiving log (a Google Sheet the shop's account
// shares with it as Viewer). Credentials are the service account's JSON key in GOOGLE_SERVICE_ACCOUNT_JSON.
// The token is a self-signed RS256 JWT exchanged at Google's token endpoint (no Google library needed), and only the
// read-only Sheets scope is ever asked for: this module never writes to any Google file.
// Setup steps: docs/merch-receiving-log-setup.md.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
export const SHEETS_READONLY = "https://www.googleapis.com/auth/spreadsheets.readonly";

export class GoogleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

interface Key {
  client_email: string;
  private_key: string;
}

/* The key file's text as pasted into Vercel, made readable: copying from a word processor or a web page can bring
   invisible characters (a byte-order mark, zero-width or non-breaking spaces), curly quotes, a "NAME=" prefix, or quotes
   around the whole thing. None of those belong in a key file, so they are taken out before it is read. */
function parseKey(raw: string): unknown {
  let s = raw
    .replace(/[\ufeff\u200b-\u200d\u2060]/g, "")
    .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"')
    .trim();
  s = s.replace(/^GOOGLE_SERVICE_ACCOUNT_JSON\s*=\s*/, "");
  for (let i = 0; i < 2; i++) {
    let v: unknown;
    try {
      v = JSON.parse(s);
    } catch {
      const a = s.indexOf("{"), b = s.lastIndexOf("}");
      if (a < 0 || b <= a) throw new Error("not JSON");
      v = JSON.parse(s.slice(a, b + 1));
    }
    if (typeof v !== "string") return v;
    s = v.trim();   // the whole file pasted as one quoted string
  }
  throw new Error("not JSON");
}

function key(): Key | null {
  try {
    const k = parseKey(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "") as Partial<Key> | null;
    return k && typeof k.client_email === "string" && typeof k.private_key === "string" ? (k as Key) : null;
  } catch {
    return null;
  }
}

export const googleConfigured = (): boolean => key() !== null;
/** What's wrong with GOOGLE_SERVICE_ACCOUNT_JSON, or null: not set, not JSON (e.g. curly quotes from a word processor),
    or JSON without the service account's email and private key. */
export function googleKeyProblem(): "missing" | "unreadable" | "incomplete" | null {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return "missing";
  let k: unknown;
  try {
    k = parseKey(raw);
  } catch {
    return "unreadable";
  }
  const o = k as Partial<Key> | null;
  return o && typeof o.client_email === "string" && typeof o.private_key === "string" ? null : "incomplete";
}
export const googleClientEmail = (): string | null => key()?.client_email ?? null;

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const cache = new Map<string, { token: string; until: number }>();
// Google gets 15 seconds an answer: a hung request must never hold up the daily cron's reminder email.
const TIMEOUT_MS = 15000;

/** An access token for `scope`, cached until a minute before it expires. */
export async function serviceToken(scope: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const k = key();
  if (!k) throw new GoogleError("No Google service account is set up.", 0);
  const id = k.client_email + " " + scope, hit = cache.get(id), now = Date.now();
  if (hit && hit.until > now) return hit.token;
  const iat = Math.floor(now / 1000);
  const unsigned = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: k.client_email, scope, aud: TOKEN_URL, iat, exp: iat + 3600 });
  const sig = createSign("RSA-SHA256").update(unsigned).sign(k.private_key).toString("base64url");
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig }).toString(),
  });
  if (!res.ok) throw new GoogleError("Google refused the service account.", res.status);
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new GoogleError("Google gave no access token.", 502);
  cache.set(id, { token: j.access_token, until: now + Math.max(60, (j.expires_in ?? 3600) - 60) * 1000 });
  return j.access_token;
}

/** Every tab of a spreadsheet (columns A to Z, so an inserted column doesn't push one out), as the sheet shows them.
    Read-only (GET requests only). */
export async function readSheetTabs(id: string, fetchImpl: typeof fetch = fetch): Promise<{ title: string; values: string[][] }[]> {
  const token = await serviceToken(SHEETS_READONLY, fetchImpl);
  const get = async (url: string) => {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new GoogleError(`Google answered ${res.status}.`, res.status);
    return res.json();
  };
  const meta = (await get(`${SHEETS}/${encodeURIComponent(id)}?fields=sheets.properties.title`)) as { sheets?: { properties?: { title?: string } }[] };
  const titles = (meta.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
  if (!titles.length) return [];
  const q = new URLSearchParams({ valueRenderOption: "FORMATTED_VALUE", majorDimension: "ROWS" });
  for (const t of titles) q.append("ranges", `'${t.replace(/'/g, "''")}'!A1:Z`);
  const vals = (await get(`${SHEETS}/${encodeURIComponent(id)}/values:batchGet?${q}`)) as { valueRanges?: { values?: string[][] }[] };
  return titles.map((title, i) => ({ title, values: (vals.valueRanges?.[i]?.values ?? []).map((r) => r.map((c) => String(c ?? ""))) }));
}
