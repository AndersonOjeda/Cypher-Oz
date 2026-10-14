"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { api } from "@/services/api";
import { errorText, useResource } from "@/features/catalog/shared";
import { cop, type Payment } from "./types";

export function PaymentInstructions({ number }: { number: string }) {
  const [revision, setRevision] = useState(0);
  const [reference, setReference] = useState("");
  const [reported, setReported] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const result = useResource<{
    instructions: string;
    configured: boolean;
    total: string;
    report_deadline_at: string;
    order_status: string;
    payment: Payment;
  }>(`/orders/${encodeURIComponent(number)}/payment-instructions/`, revision);
  const payment = reported ?? result.data?.payment;
  async function report(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      setReported(
        await api<Payment>(
          `/orders/${encodeURIComponent(number)}/payment-report/`,
          {
            method: "POST",
            body: JSON.stringify({ reference: reference.trim() }),
          },
        ),
      );
    } catch (err) {
      setError(errorText(err));
      setRevision((value) => value + 1);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="purchase-shell order-detail">
      <h1>Instrucciones de pago</h1>
      <Link href={`/pedidos/${number}`}>Volver al pedido</Link>
      {result.loading && <p role="status">Cargando instrucciones...</p>}
      {result.error && <p role="alert">{result.error}</p>}
      {result.data && (
        <>
          <p>Pedido {number}</p>
          <p>
            Total: <strong>{cop(result.data.total)}</strong>
          </p>
          {result.data.configured ? (
            <p className="payment-instructions">{result.data.instructions}</p>
          ) : (
            <p role="status">
              La tienda aún no ha configurado las instrucciones de pago.
              Contacta con la tienda antes de transferir dinero.
            </p>
          )}
          <p>
            Plazo original para reportar:{" "}
            {new Date(result.data.report_deadline_at).toLocaleString("es-CO", {
              timeZone: "America/Bogota",
            })}{" "}
            (Bogotá)
          </p>
          {payment?.status === "REPORTED" ? (
            <section aria-label="Pago reportado">
              <h2>Pago reportado</h2>
              <p role="status">
                Pendiente de revisión. Fondos aún no confirmados.
              </p>
              <p>Referencia: {payment.reference}</p>
              <p>Plazo para reportar suspendido.</p>
              {payment.review_deadline_at && (
                <p>
                  Plazo de revisión:{" "}
                  {new Date(payment.review_deadline_at).toLocaleString(
                    "es-CO",
                    {
                      timeZone: "America/Bogota",
                    },
                  )}{" "}
                  (Bogotá)
                </p>
              )}
            </section>
          ) : payment?.status === "PENDING" &&
            result.data.order_status === "PENDING" ? (
            payment.report_window_active ? (
              <form className="payment-report" onSubmit={report}>
                <h2>Reportar pago realizado</h2>
                <label className="field">
                  Referencia del pago
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    required
                    minLength={3}
                    maxLength={120}
                    disabled={busy}
                  />
                </label>
                {error && <p role="alert">{error}</p>}
                <button
                  className="button primary"
                  type="submit"
                  disabled={busy}
                >
                  <Send size={18} aria-hidden="true" />{" "}
                  {busy ? "Enviando..." : "Reportar pago"}
                </button>
              </form>
            ) : (
              <p role="alert">
                El plazo para reportar venció. Contacta con la tienda.
              </p>
            )
          ) : (
            <p role="status">El estado actual no permite reportar un pago.</p>
          )}
        </>
      )}
    </section>
  );
}
