import { EmailVerification } from "@/features/auth/email-verification";

export default async function VerifyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <main className="auth-page"><EmailVerification token={token} /></main>;
}
