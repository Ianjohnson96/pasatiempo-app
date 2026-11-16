import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMerchViewer } from "@/lib/merch/auth";
import { logActivity } from "@/lib/hub/log";

export const dynamic = "force-dynamic";

// Month-end -> Undo last update. GET: the latest data load that can still be
// undone ({last: {id, at, note, by} | null}). POST {id}: put back what that load
// replaced (merch.undo_import), only if it is still the latest. Deliveries the
// load recorded on orders stay; they're edited on the order.
export async function GET() {
  const me = await getMerchViewer();
  if (!me || me.role !== "owner") return NextResponse.json({ last: null });
  const { data, error } = await createAdminClient("merch")
    .from("imports").select("id, at, note, by_email").is("undone_at", null).order("id", { ascending: false }).limit(1);
  if (error) return NextResponse.json({ last: null });
  const r = data?.[0];
  return NextResponse.json({ last: r ? { id: r.id, at: r.at, note: r.note, by: r.by_email } : null });
}

export async function POST(request: NextRequest) {
  const me = await getMerchViewer();
  if (!me || me.role !== "owner") return NextResponse.json({ error: "Only the owner can undo an update." }, { status: 403 });
  let id: unknown;
  try {
    id = (await request.json())?.id;
  } catch {
    id = null;
  }
  if (typeof id !== "number" || !Number.isInteger(id)) return NextResponse.json({ error: "Which update?" }, { status: 400 });
  const { data, error } = await createAdminClient("merch").rpc("undo_import", { p_id: id, p_by: me.email });
  if (error) return NextResponse.json({ error: "That update can't be undone: it isn't the latest one any more. Reload the page." }, { status: 409 });
  await logActivity({ actor: me.email, app: "merch", action: "merch.data_undone", detail: { importId: id, documents: data } });
  return NextResponse.json({ restored: data });
}
