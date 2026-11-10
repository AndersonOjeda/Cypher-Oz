"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";

export function EmailVerification({ token }: { token?: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Confirmando tu correo…" : "El enlace de verificación está incompleto.");
  const verifiedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || verifiedTokenRef.current === token) return;
    verifiedTokenRef.current = token;
    let active = true;

    api<{ message: string }>("/auth/verify-email/", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        if (!active) return;
        setStatus("success");
        setMessage(data.message || "Correo confirmado. Ya puedes iniciar sesión.");
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "No pudimos confirmar tu correo.");
      });

    return () => {
      active = false;
    };
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
