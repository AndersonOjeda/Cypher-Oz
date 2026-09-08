import { AuthForm } from "@/features/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <AuthForm mode="login" />
    </div>
  );
}
