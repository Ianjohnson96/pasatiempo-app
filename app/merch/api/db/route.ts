import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMerchViewer } from "@/lib/merch/auth";
import { canWrite, isDocPath, MAX_DOC_BYTES, NOT_LOADED, topCollection } from "@/lib/merch/rules";

export const dynamic = "force-dynamic";

const PAGE = 1000;

interface DocRow {
  path: string;
  data: unknown;
  deleted: boolean;
  version: number;
  rev: number;
}

// GET ?since=REV — every document changed after REV (all live documents when
// REV is 0), plus tombstones for deletes, and the highest rev seen.
export async function GET(request: NextRequest) {
  const viewer = await getMerchViewer();
  if (!viewer) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const since = Math.max(0, Number(request.nextUrl.searchParams.get("since")) || 0);
  const supa = createAdminClient("merch");
  const docs: DocRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supa.from("docs").select("path, data, deleted, version, rev").gt("rev", since).order("rev").range(from, from + PAGE - 1);
    if (since === 0) q = q.eq("deleted", false);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    docs.push(...(data as DocRow[]));
    if (!data || data.length < PAGE) break;
  }
  const out = docs.filter((d) => !NOT_LOADED.has(topCollection(d.path)));
  let rev = since;
  for (const d of docs) rev = Math.max(rev, Number(d.rev));
  if (since === 0 && !docs.length) {
    const { data } = await supa.from("docs").select("rev").order("rev", { ascending: false }).limit(1);
    rev = Number(data?.[0]?.rev ?? 0);
  }
  return NextResponse.json(
    { rev, docs: out.map((d) => ({ path: d.path, data: d.deleted ? null : d.data, version: d.version })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// POST {path, data | null, ifVersion?} — write (or, with data null, delete) one document.
export async function POST(request: NextRequest) {
  const viewer = await getMerchViewer();
  if (!viewer) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  let body: { path?: unknown; data?: unknown; ifVersion?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const path = typeof body.path === "string" ? body.path : "";
  if (!isDocPath(path)) return NextResponse.json({ error: "bad_path" }, { status: 400 });
  if (!canWrite(viewer.role, path)) return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  const data = body.data ?? null;
  if (data !== null && (typeof data !== "object" || Array.isArray(data)))
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (data !== null && JSON.stringify(data).length > MAX_DOC_BYTES)
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  const ifVersion = Number.isInteger(body.ifVersion) ? (body.ifVersion as number) : null;
  const { data: rows, error } = await createAdminClient("merch").rpc("put_doc", {
    p_path: path,
    p_data: data,
    p_by: viewer.email,
    p_if_version: ifVersion,
  });
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const row = (rows as DocRow[] | null)?.[0];
  if (!row) return NextResponse.json({ error: "version_conflict" }, { status: 409 });
  return NextResponse.json({ path: row.path, version: row.version, rev: Number(row.rev) });
}
