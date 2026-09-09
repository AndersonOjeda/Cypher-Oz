"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/services/api";

const schema = z.object({
  name: z.string().optional(),
  email: z.email("Ingresa un correo válido.").max(254),
  password: z
    .string()
    .min(1, "Ingresa tu contraseña.")
    .max(128, "Usa máximo 128 caracteres."),
});
type Values = z.infer<typeof schema>;

export function AuthForm({ mode }: { mode: "register" | "login" }) {
  const router = useRouter();
  const registerMode = mode === "register";
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    setError: fieldError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function submit(values: Values) {
    setError("");
    if (registerMode && !values.name?.trim()) {
      fieldError("name", { message: "Ingresa tu nombre." });
      return;
    }
    if (registerMode && values.password.length < 8) {
      fieldError("password", { message: "Usa al menos 8 caracteres." });
      return;
    }
    try {
      await api(`/auth/${mode}/`, {
        method: "POST",
        body: JSON.stringify(
          registerMode
            ? values
            : { email: values.email, password: values.password },
        ),
      });
      if (registerMode) setSuccess(true);
      else {
        router.push("/cuenta");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error. Inténtalo de nuevo.",
      );
      if (err instanceof ApiError) {
        for (const key of ["name", "email", "password"] as const) {
          if (Array.isArray(err.details?.[key]))
            fieldError(key, { message: err.details[key].join(" ") });
        }
      }
    }
  }

  if (success)
    return (
      <div className="form-card">
        <div className="success-icon" aria-hidden="true">
          ✓
        </div>
        <h1>Tu cuenta está lista</h1>
        <p role="status">
          Te registraste correctamente. Inicia sesión para acceder a tu cuenta.
        </p>
        <Link className="button primary" href="/login">
          Iniciar sesión
        </Link>
      </div>
    );

  return (
    <div className="form-card">
      <p className="eyebrow">TU ESPACIO EN TTI</p>
      <h1>{registerMode ? "Crea tu cuenta" : "Qué bueno verte de nuevo"}</h1>
      <p>
        {registerMode
          ? "Un paso más cerca de la tecnología que necesitas."
          : "Ingresa a tu cuenta con tu correo y contraseña."}
      </p>
      <form onSubmit={handleSubmit(submit)} noValidate aria-busy={isSubmitting}>
        {registerMode && (
          <div className="field">
            <label htmlFor="name">Nombre completo</label>
            <input
              id="name"
              autoComplete="name"
              maxLength={150}
              {...register("name")}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <span id="name-error" className="field-error">
                {errors.name.message}
              </span>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            {...register("email")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <span id="email-error" className="field-error">
              {errors.email.message}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete={registerMode ? "new-password" : "current-password"}
            maxLength={128}
            {...register("password")}
            aria-invalid={!!errors.password}
            aria-describedby="password-help"
          />
          <span
            id="password-help"
            className={errors.password ? "field-error" : "field-hint"}
          >
            {errors.password?.message ??
              (registerMode
                ? "Mínimo 8 caracteres. Evita contraseñas comunes, solo números o similares a tus datos."
                : "")}
          </span>
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button
          className="button primary"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? "Un momento…"
            : registerMode
              ? "Crear cuenta"
              : "Iniciar sesión"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="form-switch">
        {registerMode ? "¿Ya tienes una cuenta?" : "¿Primera vez en TTI?"}{" "}
        <Link href={registerMode ? "/login" : "/registro"}>
          {registerMode ? "Inicia sesión" : "Crea tu cuenta"}
        </Link>
      </p>
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
    </div>
  );
}
