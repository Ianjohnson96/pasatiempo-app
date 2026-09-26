import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { basePath, getMerchViewer, listMembers } from "@/lib/merch/auth";
import AdminClient from "@/components/merch/AdminClient";

export const dynamic = "force-dynamic";

// Owner only: who can open the program, and loading month-end data files.
export default async function MerchAdminPage() {
  const base = basePath((await headers()).get("host"));
  const me = await getMerchViewer();
  if (!me) redirect(base + "/login");
  if (me.role !== "owner") redirect(base || "/");
  return <AdminClient base={base} me={me.email} initial={await listMembers()} />;
}
