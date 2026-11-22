import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { refreshReceivingLog, type LogStore } from "./receiving-log-server";

const fx = JSON.parse(readFileSync(path.join(process.cwd(), "lib/merch/fixtures/receiving-log.json"), "utf8"));
const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
let n = 0;
const memStore = (docs: Record<string, unknown> = {}): LogStore & { docs: Record<string, unknown> } => ({
  docs, get: async (p) => (docs[p] ?? null) as never, put: async (p, d) => { docs[p] = d; },
});
// Google answers with the fixture's tabs; `status` makes the sheet read fail instead.
const google = (status = 200) => (async (url: string) => {
  if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
  if (status !== 200) return new Response("{}", { status });
  if (String(url).includes("values:batchGet")) return new Response(JSON.stringify({ valueRanges: fx.tabs.map((t: { values: string[][] }) => ({ values: t.values })) }));
  return new Response(JSON.stringify({ sheets: fx.tabs.map((t: { title: string }) => ({ properties: { title: t.title } })) }));
}) as unknown as typeof fetch;
const NOW = new Date("2026-11-22T20:00:00Z");   // Nov 22 in Pacific time

beforeEach(() => { process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: `log${n++}@example.iam.gserviceaccount.com`, private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() }); });
afterEach(() => { delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON; });

describe("refreshing the receiving log", () => {
  it("stores parsed rows, the word list and since = today on the first read", async () => {
    const db = memStore();
    const r = await refreshReceivingLog({ db, fetchImpl: google(), now: NOW });
    expect(r.ok).toBe(true);
    const doc = db.docs["receivinglog/current"] as { since: string; rows: { date: string }[]; words: Record<string, string[]>; error: null };
    expect(doc.since).toBe("2026-11-22");
    expect(doc.error).toBeNull();
    expect(doc.words.footjoy).toContain("fj");
    expect(doc.rows.every((x) => x.date >= "2026-11-22")).toBe(true);
  });
  it("keeps an earlier since, and adds the owner's vendor words", async () => {
    const db = memStore({ "receivinglog/current": { since: "2026-01-01", at: "2026-11-01T00:00:00Z", rows: [] }, "guidelines/current": { vendorWords: { melin: ["melin"] } } });
    await refreshReceivingLog({ db, fetchImpl: google(), now: NOW });
    const doc = db.docs["receivinglog/current"] as { since: string; rows: { invoice: string; brand: string | null }[] };
    expect(doc.since).toBe("2026-01-01");
    expect(doc.rows.find((x) => x.invoice === "2387808")!.brand).toBe("melin");
  });
  it("skips a read under 2 minutes old unless forced", async () => {
    const db = memStore({ "receivinglog/current": { since: "2026-01-01", at: new Date(NOW.getTime() - 60000).toISOString(), rows: [] } });
    expect(await refreshReceivingLog({ db, fetchImpl: google(), now: NOW })).toEqual({ ok: true, skipped: "recent" });
    expect((await refreshReceivingLog({ db, fetchImpl: google(), now: NOW, force: true })).skipped).toBeUndefined();
  });
  it("keeps the previous rows and says what to fix when access is refused", async () => {
    const prev = [{ key: "k", date: "2026-11-20" }];
    const db = memStore({ "receivinglog/current": { since: "2026-01-01", at: "2026-11-01T00:00:00Z", rows: prev } });
    const r = await refreshReceivingLog({ db, fetchImpl: google(403), now: NOW });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Share it with log\d+@example\.iam\.gserviceaccount\.com as Viewer/);
    expect((db.docs["receivinglog/current"] as { rows: unknown[]; error: string }).rows).toEqual(prev);
  });
  it("says Google didn't answer when it is down", async () => {
    const r = await refreshReceivingLog({ db: memStore(), fetchImpl: google(503), now: NOW });
    expect(r.error).toMatch(/Google didn't answer/);
  });
  it("says the log isn't connected when there are no credentials", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const db = memStore();
    const r = await refreshReceivingLog({ db, fetchImpl: google(), now: NOW });
    expect(r.error).toMatch(/isn't connected yet/);
    expect((db.docs["receivinglog/current"] as { error: string }).error).toMatch(/isn't connected yet/);
  });
});
