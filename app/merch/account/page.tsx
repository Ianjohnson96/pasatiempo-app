import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { basePath, getMerchViewer } from "@/lib/merch/auth";
import AccountForm from "@/components/merch/AccountForm";

export const dynamic = "force-dynamic";

export default async function MerchAccountPage() {
  const base = basePath((await headers()).get("host"));
  if (!(await getMerchViewer())) redirect(base + "/login");
  return <AccountForm base={base} />;
}
