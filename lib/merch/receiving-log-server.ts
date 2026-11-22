import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleError, googleClientEmail, googleConfigured, readSheetTabs } from "./google";
import { parseLog, VENDOR_WORDS_DEFAULT } from "./receiving-log";
import { pacificToday } from "./schedule";

// Keeps receivinglog/current, the app's read-only copy of the receiving log: the rows dated on or after `since` (the
// day the log was first read), parsed by lib/merch/receiving-log.ts, plus the vendor word list the page matches with.
// Run when someone opens Orders & receiving (POST /merch/api/receiving-log) and by the daily cron. It never writes to
// the sheet. A failed read keeps the rows from the last good read and stores one plain line saying what to fix.

export const LOG_DOC = "receivinglog/current";
const SHEET_ID = () => process.env.MERCH_LOG_SHEET_ID || "1L2H5NaP_6nV1FwyYE5ThjKv8GenbvdtFulW6gYsCkSs";
const FRESH_MS = 2 * 60 * 1000;

/** Where the copy lives: merch.docs by default (writes go through put_doc, as page writes do). */
export interface LogStore {
  get(path: string): Promise<Record<string, unknown> | null>;
  put(path: string, data: Record<string, unknown>): Promise<void>;
}

export function supabaseLogStore(): LogStore {
  const supa = createAdminClient("merch");
  return {
    async get(path) {
      const { data, error } = await supa.from("docs").select("data").eq("path", path).eq("deleted", false).maybeSingle();
      if (error) throw new Error("The merch documents couldn't be read.");
      return (data?.data as Record<string, unknown>) ?? null;
    },
    async put(path, data) {
      const { error } = await supa.rpc("put_doc", { p_path: path, p_data: data, p_by: "receiving-log", p_if_version: null });
      if (error) throw new Error("The receiving log copy couldn't be saved.");
    },
  };
}

const time = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The plain line the page shows for a failed read. */
function failure(e: unknown, previousAt: string | null): string {
  if (!googleConfigured()) return "The receiving log isn't connected yet. See the setup steps.";
  const status = e instanceof GoogleError ? e.status : 0;
  if (status === 403 || status === 404) return `The app can't open the receiving log. Share it with ${googleClientEmail()} as Viewer.`;
  return previousAt ? `Google didn't answer; showing the log as of ${time(previousAt)}.` : "Google didn't answer; the receiving log will be read again shortly.";
}

export async function refreshReceivingLog(opts: { force?: boolean; fetchImpl?: typeof fetch; now?: Date; db?: LogStore } = {}): Promise<{ ok: boolean; rows?: number; skipped?: "recent"; error?: string }> {
  const db = opts.db ?? supabaseLogStore(), now = opts.now ?? new Date();
  const prev = await db.get(LOG_DOC);
  const prevAt = typeof prev?.at === "string" ? prev.at : null;
  if (!opts.force && prevAt && now.getTime() - Date.parse(prevAt) < FRESH_MS) return { ok: true, skipped: "recent" };
  const guide = await db.get("guidelines/current");
  const extra = (guide?.vendorWords && typeof guide.vendorWords === "object" ? guide.vendorWords : {}) as Record<string, unknown>;
  const words: Record<string, string[]> = { ...VENDOR_WORDS_DEFAULT };
  for (const [k, v] of Object.entries(extra)) if (Array.isArray(v)) words[k.toLowerCase()] = [...(words[k.toLowerCase()] ?? []), ...v.map(String)];
  const since = typeof prev?.since === "string" ? prev.since : pacificToday(now);
  try {
    if (!googleConfigured()) throw new GoogleError("not configured", 0);
    const tabs = await readSheetTabs(SHEET_ID(), opts.fetchImpl);
    const { rows, problems } = parseLog(tabs, { since, words });
    await db.put(LOG_DOC, { at: now.toISOString(), since, sheet: SHEET_ID(), words, rows, problems, error: null, readAt: now.toISOString() });
    return { ok: true, rows: rows.length };
  } catch (e) {
    const error = failure(e, typeof prev?.readAt === "string" ? prev.readAt : null);
    console.error("receiving log:", e instanceof Error ? e.message : e);
    await db.put(LOG_DOC, { ...(prev ?? {}), at: now.toISOString(), since: prev?.since ?? null, words, rows: prev?.rows ?? [], problems: prev?.problems ?? [], error });
    return { ok: false, error };
  }
}
