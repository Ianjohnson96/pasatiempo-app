import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { MerchViewer } from "./auth";

// The Merchandise Program page is plain HTML/JS kept in merchandise/app/src
// (it also publishes as a standalone page). Here it's assembled for the club
// app: no data baked in, and a small shim (merchandise/app/host/club-shim.js)
// that points its database at /api/db and its user at the signed-in member.

const ROOT = path.join(process.cwd(), "merchandise", "app");

let cached: { head: string; body: string; js: string; shim: string } | null = null;

function parts() {
  if (cached && process.env.NODE_ENV === "production") return cached;
  const src = path.join(ROOT, "src");
  const shell = readFileSync(path.join(src, "shell.html"), "utf8");
  const cut = shell.indexOf('<div class="wrap">');
  const js = readdirSync(src)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => readFileSync(path.join(src, f), "utf8"))
    .join("\n");
  cached = {
    head: shell.slice(0, cut),
    body: shell.slice(cut),
    js,
    shim: readFileSync(path.join(ROOT, "host", "club-shim.js"), "utf8"),
  };
  return cached;
}

// JSON that is safe inside a <script> element.
const inline = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, " ");

const EMPTY = { base: null, plan: null, brands: null, inventory: { asOf: "", cats: {} }, insights: { asOf: "", items: [] } };

export function programHtml(viewer: MerchViewer, members: Record<string, string>, base: string): string {
  const p = parts();
  const host = { base, me: viewer, members };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="icon" href="/favicon.png">
${p.head}
</head>
<body>
${p.body}
<script>window.MERCH_HOST = ${inline(host)};</script>
<script>${p.shim}</script>
<script>${p.js.replace("__FALLBACK__", inline(EMPTY))}</script>
</body>
</html>`;
}
