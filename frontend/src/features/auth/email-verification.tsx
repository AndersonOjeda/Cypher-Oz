"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function EmailVerification({ token }: { token?: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Confirmando tu correo…" : "El enlace de verificación está incompleto.");

  useEffect(() => {
    if (!token) return;
    fetch("/api/v1/auth/verify-email/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "El enlace no es válido o ya venció.");
        setStatus("success");
        setMessage(data.message);
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "No pudimos confirmar tu correo.");
      });
  }, [token]);

  return (
    <div className="form-card">
      <div className="success-icon" aria-hidden="true">{status === "success" ? "✓" : "✉"}</div>
      <h1>{status === "success" ? "Correo confirmado" : "Verificación de correo"}</h1>
      <p role={status === "error" ? "alert" : "status"}>{message}</p>
      <Link className="button primary" href="/login">Ir a iniciar sesión</Link>
    </div>
  );
}
