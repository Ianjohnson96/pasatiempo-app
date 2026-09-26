import { redirect } from "next/navigation";
import { signedInEmail } from "@/lib/hub/access";
import PasswordForm from "@/components/hub/PasswordForm";

export const dynamic = "force-dynamic";

// Set a new password: after following a reset email, or any time from the dashboard.
export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const email = await signedInEmail();
  if (!email) redirect("/login?next=/account/password");
  const { reset } = await searchParams;
  return <PasswordForm email={email} fromReset={reset === "1"} />;
}
