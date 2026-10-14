import { AuthForm } from "@/features/auth/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="auth-shell">
      <AuthForm
        mode="login"
        returnTo={next === "/comprar" ? "/comprar" : undefined}
      />
    </div>
  );
}
