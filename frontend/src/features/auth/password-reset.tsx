"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/services/api";

export function PasswordResetRequest() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ message: string }>(
        "/auth/password-reset/request/",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      );
      setMessage(result.message);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos procesar la solicitud.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card">
      <p className="eyebrow">RECUPERA TU CUENTA</p>
      <h1>Restablece tu contraseña</h1>
      <p>Ingresa el correo asociado a tu cuenta.</p>
      {message ? (
        <>
          <p role="status">{message}</p>
          <Link className="button primary" href="/login">
            Volver al inicio de sesión
          </Link>
        </>
      ) : (
        <form onSubmit={submit} aria-busy={busy}>
          <div className="field">
            <label htmlFor="reset-email">Correo electrónico</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Enviando..." : "Enviar instrucciones"}
          </button>
        </form>
      )}
      <Link className="back-link" href="/login">
        Volver al inicio de sesión
      </Link>
    </div>
  );
}

export function PasswordResetConfirm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ message: string }>(
        "/auth/password-reset/confirm/",
        {
          method: "POST",
          body: JSON.stringify({
            token,
            password,
            password_confirm: confirmation,
          }),
        },
      );
      setMessage(result.message);
    } catch (err) {
      if (err instanceof ApiError && err.details.password?.length)
        setError(err.details.password.join(" "));
      else
        setError(
          err instanceof Error
            ? err.message
            : "No pudimos cambiar la contraseña.",
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card">
      <p className="eyebrow">SEGURIDAD DE LA CUENTA</p>
      <h1>Nueva contraseña</h1>
      {!token ? (
        <p role="alert" className="error-message">
          El enlace de recuperación está incompleto.
        </p>
      ) : message ? (
        <>
          <p role="status">{message}</p>
          <Link className="button primary" href="/login">
            Iniciar sesión
          </Link>
        </>
      ) : (
        <form onSubmit={submit} aria-busy={busy}>
          <div className="field">
            <label htmlFor="new-password">Nueva contraseña</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirmar contraseña</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      )}
      <Link className="back-link" href="/login">
        Volver al inicio de sesión
      </Link>
    </div>
  );
}
