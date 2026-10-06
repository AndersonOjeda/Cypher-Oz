"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError, type User } from "@/services/api";
import { useResource } from "@/features/catalog/shared";

type Settings = {
  payment_instructions?: string;
  whatsapp_enabled: boolean;
  whatsapp_number: string;
  whatsapp_message: string;
  unpaid_order_timeout_hours: number;
  reported_payment_timeout_hours: number;
  urban_flat_shipping_rate: number;
  free_shipping_threshold: number;
  anonymous_cart_ttl_days: number;
};
const numericFields = [
  ["unpaid_order_timeout_hours", "Plazo para reportar pago (horas)", 1],
  ["reported_payment_timeout_hours", "Plazo para revisar pago (horas)", 1],
  ["urban_flat_shipping_rate", "Tarifa urbana (COP)", 0],
  ["free_shipping_threshold", "Envío gratis desde (COP)", 0],
  ["anonymous_cart_ttl_days", "Vigencia del carrito (días)", 1],
] as const;

function SettingsForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setErrors({});
    try {
      setForm(
        await api<Settings>("/admin/settings/", {
          method: "PATCH",
          body: JSON.stringify(form),
        }),
      );
      setMessage("Configuración guardada.");
      window.dispatchEvent(new Event("focus"));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No pudimos guardar los cambios.",
      );
      if (err instanceof ApiError) setErrors(err.details ?? {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} aria-busy={busy} className="settings-form">
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="catalog-success">
          {message}
        </p>
      )}
      <fieldset disabled={busy}>
        <legend>Operación</legend>
        {numericFields.map(([key, label, min]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <input
              id={key}
              name={key}
              type="number"
              min={min}
              step={1}
              required
              value={Number.isNaN(form[key]) ? "" : form[key]}
              onChange={(e) =>
                setForm({ ...form, [key]: e.target.valueAsNumber })
              }
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? `${key}-error` : undefined}
            />
            {errors[key] && (
              <span className="field-error" id={`${key}-error`}>
                {errors[key].join(" ")}
              </span>
            )}
          </div>
        ))}
      </fieldset>
      <fieldset disabled={busy}>
        <legend>WhatsApp</legend>
        <label className="catalog-check">
          <input
            type="checkbox"
            checked={form.whatsapp_enabled}
            onChange={(e) =>
              setForm({ ...form, whatsapp_enabled: e.target.checked })
            }
          />
          Canal habilitado
        </label>
        <div className="field">
          <label htmlFor="whatsapp-number">Número con código de país</label>
          <input
            id="whatsapp-number"
            type="tel"
            maxLength={15}
            required={form.whatsapp_enabled}
            value={form.whatsapp_number}
            onChange={(e) =>
              setForm({ ...form, whatsapp_number: e.target.value })
            }
            aria-invalid={!!errors.whatsapp_number}
            aria-describedby={
              errors.whatsapp_number ? "whatsapp-number-error" : undefined
            }
          />
          {errors.whatsapp_number && (
            <span className="field-error" id="whatsapp-number-error">
              {errors.whatsapp_number.join(" ")}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="whatsapp-message">Mensaje inicial</label>
          <input
            id="whatsapp-message"
            maxLength={500}
            required
            value={form.whatsapp_message}
            onChange={(e) =>
              setForm({ ...form, whatsapp_message: e.target.value })
            }
            aria-invalid={!!errors.whatsapp_message}
            aria-describedby={
              errors.whatsapp_message ? "whatsapp-message-error" : undefined
            }
          />
          {errors.whatsapp_message && (
            <span className="field-error" id="whatsapp-message-error">
              {errors.whatsapp_message.join(" ")}
            </span>
          )}
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Pago externo</legend>
        <div className="field">
          <label htmlFor="payment-instructions">Instrucciones de pago</label>
          <textarea
            id="payment-instructions"
            rows={5}
            maxLength={2000}
            value={form.payment_instructions ?? ""}
            onChange={(event) =>
              setForm({ ...form, payment_instructions: event.target.value })
            }
          />
        </div>
      </fieldset>
      <button className="button primary" disabled={busy}>
        {busy ? "Guardando..." : "Guardar configuración"}
      </button>
    </form>
  );
}

function SettingsResource() {
  const [revision, setRevision] = useState(0);
  const resource = useResource<Settings>("/admin/settings/", revision);
  if (resource.loading) return <p role="status">Cargando configuración...</p>;
  if (!resource.data)
    return (
      <div>
        <p role="alert" className="error-message">
          {resource.error}
        </p>
        <button onClick={() => setRevision((v) => v + 1)}>Reintentar</button>
      </div>
    );
  return <SettingsForm initial={resource.data} />;
}

export function SettingsManager() {
  const user = useResource<User>("/users/me/");
  return (
    <section className="catalog-shell">
      <div className="catalog-heading">
        <h1>Configuración</h1>
        <Link href="/cuenta">Mi cuenta</Link>
      </div>
      {user.loading ? (
        <p role="status">Comprobando acceso...</p>
      ) : user.data?.role === "ADMIN" ? (
        <SettingsResource />
      ) : (
        <>
          <p role="alert">
            {user.error ||
              "Tu cuenta no tiene permisos para administrar la configuración."}
          </p>
          <Link href="/login">Iniciar sesión</Link>
        </>
      )}
    </section>
  );
}
