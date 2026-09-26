import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMerchViewer } from "@/lib/merch/auth";
import { reportTicket } from "@/lib/merch/ticket";

export const dynamic = "force-dynamic";

// Step 1 of a month-end refresh from the Month-end page. The owner gets a
// pass for the report reader (api/merch/reports.py) and last month's
// documents, which the reader builds on: the forecast base, the SKU history
// and any saved forecast assumptions. The reader returns a data file, and the
// page loads it through /merch/api/import once the owner confirms.
export async function POST() {
  const me = await getMerchViewer();
  if (!me || me.role !== "owner")
    return NextResponse.json({ error: "Only the owner can update the program from reports." }, { status: 403 });
  const supa = createAdminClient("merch");
  const [named, hist] = await Promise.all([
    supa.from("docs").select("path, data").eq("deleted", false).in("path", ["base/current", "plan/assumptions"]),
    supa.from("docs").select("path, data").eq("deleted", false).like("path", "skuhist/%"),
  ]);
  if (named.error || hist.error)
    return NextResponse.json({ error: "Last month's data couldn't be loaded. Try again." }, { status: 503 });
  const prior = Object.fromEntries([...(named.data ?? []), ...(hist.data ?? [])].map((d) => [d.path, d.data]));
  return NextResponse.json({ ticket: reportTicket(me.email), prior });
}
