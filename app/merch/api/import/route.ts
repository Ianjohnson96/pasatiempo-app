import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMerchViewer } from "@/lib/merch/auth";
import { logActivity } from "@/lib/hub/log";
import { IMPORTABLE, isDocPath, MAX_DOC_BYTES, topCollection } from "@/lib/merch/rules";

export const dynamic = "force-dynamic";

// POST a data file: {kind: "pasatiempo-merch-bundle", docs: {path: data}}.
// The owner loads month-end documents this way (forecast base, brand
// scorecard, suggestions, SKU history). Each document replaces the stored one,
// all in one transaction (merch.put_docs), which keeps the replaced documents
// for Undo last update (./undo); only the collections in IMPORTABLE are accepted.
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
  const note = typeof (b as { note?: unknown }).note === "string" ? (b as { note: string }).note.slice(0, 200) : null;
  // One transaction: every document or none, and what each held before is kept for Undo last update.
  const { data: importId, error } = await supa.rpc("put_docs", { p_docs: Object.fromEntries(entries), p_by: me.email, p_note: note });
  if (error) return NextResponse.json({ error: "The data couldn't be saved, and nothing was changed. Try again." }, { status: 503 });
  await logActivity({ actor: me.email, app: "merch", action: "merch.data_loaded", detail: { documents: entries.length, note, importId } });
  return NextResponse.json({ loaded: entries.length, importId });
}
