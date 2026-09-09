"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, User } from "@/services/api";

export function Account() {
  const router = useRouter();
  const [user, setUser] = useState<User>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<User>("/users/me/")
      .then((data) => {
        if (active) setUser(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401)
          router.replace("/login");
        else setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [router]);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout/", { method: "POST" });
      setUser(undefined);
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inténtalo de nuevo.");
      setBusy(false);
    }
  }
  return (
    <section className="form-card account-card">
      <p className="eyebrow">MI CUENTA</p>
      {user ? (
        <>
          <h1>Hola, {user.name}</h1>
          <p>Tu sesión está activa.</p>
          <dl>
            <dt>Correo electrónico</dt>
            <dd>{user.email}</dd>
            <dt>Tipo de cuenta</dt>
            <dd>{user.role === "ADMIN" ? "Administrador" : "Cliente"}</dd>
          </dl>
          {user.role === "ADMIN" && (
            <Link className="button primary" href="/admin/catalogo">
              Administrar catálogo
            </Link>
          )}
          <button className="button primary" onClick={logout} disabled={busy}>
            {busy ? "Cerrando sesión…" : "Cerrar sesión"}
          </button>
        </>
      ) : (
        !error && <p role="status">Cargando tu cuenta…</p>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      <Link className="back-link" href="/">
        ← Volver al inicio
      </Link>
    </section>
  );
}
