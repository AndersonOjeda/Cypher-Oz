import { AuthForm } from "@/features/auth/auth-form";

export default function RegisterPage() {
  return (
    <div className="auth-shell">
      <AuthForm mode="register" />
    </div>
  );
}
