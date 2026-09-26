import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMerchViewer } from "@/lib/merch/auth";
import { IMPORTABLE, isDocPath, MAX_DOC_BYTES, topCollection } from "@/lib/merch/rules";

export const dynamic = "force-dynamic";

// POST a data file: {kind: "pasatiempo-merch-bundle", docs: {path: data}}.
// The owner loads month-end documents this way (forecast base, brand
// scorecard, suggestions, SKU history). Each document replaces the stored one;
// only the collections in IMPORTABLE are accepted.
export async function POST(request: NextRequest) {
  const me = await getMerchViewer();
  if (!me || me.role !== "owner") return NextResponse.json({ error: "Only the owner can load data." }, { status: 403 });
  let b: { kind?: unknown; docs?: unknown };
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "That file isn't a data file." }, { status: 400 });
  }
  if (b.kind !== "pasatiempo-merch-bundle" || !b.docs || typeof b.docs !== "object")
    return NextResponse.json({ error: "That file isn't a Merchandise Program data file." }, { status: 400 });
  const entries = Object.entries(b.docs as Record<string, unknown>);
  for (const [path, data] of entries) {
    if (!isDocPath(path) || !data || typeof data !== "object" || Array.isArray(data))
      return NextResponse.json({ error: `The file has a bad entry: ${path}` }, { status: 400 });
    if (!IMPORTABLE.has(topCollection(path)))
      return NextResponse.json({ error: `A data file can't replace ${path}.` }, { status: 400 });
    if (JSON.stringify(data).length > MAX_DOC_BYTES)
      return NextResponse.json({ error: `${path} is too large.` }, { status: 413 });
  }
  const supa = createAdminClient("merch");
  let done = 0;
  for (const [path, data] of entries) {
    const { error } = await supa.rpc("put_doc", { p_path: path, p_data: data, p_by: me.email, p_if_version: null });
    if (error) return NextResponse.json({ error: `Stopped at ${path} after ${done} documents. Try again.` }, { status: 503 });
    done++;
  }
  return NextResponse.json({ loaded: done });
}
