import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { googleConfigured, readSheetTabs, serviceToken } from "./google";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KEY = { client_email: "reader@example.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
afterEach(() => { delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON; });

describe("Google service account", () => {
  it("is configured only with a key that has an email and a private key", () => {
    expect(googleConfigured()).toBe(false);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "not json";
    expect(googleConfigured()).toBe(false);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(KEY);
    expect(googleConfigured()).toBe(true);
  });
  it("signs an RS256 assertion for the read-only scope and caches the token", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ ...KEY, client_email: "cache-test@example.iam.gserviceaccount.com" });
    let tokenCalls = 0;
    const f = (async (url: string, init?: RequestInit) => {
      tokenCalls++;
      const a = new URLSearchParams(String(init!.body)).get("assertion")!;
      const [h, p, s] = a.split(".");
      expect(crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), publicKey, Buffer.from(s, "base64url"))).toBe(true);
      const claims = JSON.parse(Buffer.from(p, "base64url").toString());
      expect(claims.scope).toBe(SCOPE);
      expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
      expect(claims.exp - claims.iat).toBe(3600);
      return new Response(JSON.stringify({ access_token: "t1", expires_in: 3600 }));
    }) as unknown as typeof fetch;
    expect(await serviceToken(SCOPE, f)).toBe("t1");
    expect(await serviceToken(SCOPE, f)).toBe("t1");
    expect(tokenCalls).toBe(1);
  });
  it("reads every tab's values, and reports Google's refusal with its status", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ ...KEY, client_email: "tabs-test@example.iam.gserviceaccount.com" });
    const seen: string[] = [];
    const ok = (async (url: string) => {
      seen.push(String(url));
      if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }));
      if (String(url).includes("values:batchGet")) { expect(String(url)).toContain("A1%3AZ"); return new Response(JSON.stringify({ valueRanges: [{ values: [["REC. DATE"]] }, {}] })); }
      return new Response(JSON.stringify({ sheets: [{ properties: { title: "SHEET 4" } }, { properties: { title: "Credits" } }] }));
    }) as unknown as typeof fetch;
    const tabs = await readSheetTabs("sheet1", ok);
    expect(tabs).toEqual([{ title: "SHEET 4", values: [["REC. DATE"]] }, { title: "Credits", values: [] }]);
    expect(seen.every((u) => !/:batchUpdate|values\/.*:append|method=POST/.test(u))).toBe(true);
    const no = (async (url: string) => String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 })) : new Response("{}", { status: 403 })) as unknown as typeof fetch;
    await expect(readSheetTabs("sheet1", no)).rejects.toMatchObject({ status: 403 });
  });
});
