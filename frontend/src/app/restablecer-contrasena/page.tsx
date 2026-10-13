import { PasswordResetConfirm } from "@/features/auth/password-reset";

export default async function PasswordResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <main className="auth-page">
      <PasswordResetConfirm token={token} />
    </main>
  );
}
