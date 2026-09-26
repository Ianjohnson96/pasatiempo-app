import LoginForm from "@/components/merch/LoginForm";

export default async function MerchLoginPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const { denied } = await searchParams;
  return <LoginForm denied={!!denied} />;
}
