import StaffLogin from "@/components/hub/StaffLogin";

// Staff sign-in for every Pasatiempo app (form in components/hub/StaffLogin).
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <StaffLogin notice={reset === "expired" ? "That reset link has expired or was already used. Ask for a new one below." : undefined} />
  );
}
