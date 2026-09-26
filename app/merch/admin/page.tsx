import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { basePath, getMerchViewer } from "@/lib/merch/auth";
import DataLoader from "@/components/merch/DataLoader";

export const dynamic = "force-dynamic";

// Owner only: load month-end data files. People are managed at /admin/people.
export default async function MerchAdminPage() {
  const base = basePath((await headers()).get("host"));
  const me = await getMerchViewer();
  if (!me) redirect(base + "/login");
  if (me.role !== "owner") redirect(base || "/");
  // People & access lives on the hub, which is only reachable when served by path.
  return <DataLoader base={base} peopleHref={base ? "/admin/people" : null} />;
}
