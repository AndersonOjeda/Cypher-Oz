"use client";

import Link from "next/link";
import { Modal } from "@/components/modal";
import { useState } from "react";
import { Pager, useResource } from "@/features/catalog/shared";
import type { Page } from "@/features/catalog/types";
import { OrderWhatsAppButton } from "@/components/whatsapp-button";
import { api } from "@/services/api";
import { cop, type Order } from "./types";

const status: Record<string, string> = {
  PENDING: "Pendiente",
  REPORTED: "Reportado",
  CONFIRMED: "Confirmado",
  REJECTED: "Rechazado",
  PREPARING: "En preparación",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function OrderDetail({ number }: { number: string }) {
  const [revision, setRevision] = useState(0);
  const resource = useResource<Order>(
    `/orders/${encodeURIComponent(number)}/`,
    revision,
  );
  const order = resource.data;

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const canCancel =
    order &&
    order.status === "PENDING" &&
    order.payment.status !== "CONFIRMED";

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await api(`/orders/${order.number}/cancel/`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason || "Cancelado por el cliente" }),
      });
      setCancelSuccess("Pedido cancelado exitosamente.");
      setShowCancelModal(false);
      setRevision((n) => n + 1);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <section className="purchase-shell order-detail max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="purchase-heading flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Detalle del pedido</h1>
          <p className="text-xs font-mono text-gray-500">{number}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/pedidos" className="text-blue-600 hover:underline">
            Mis pedidos
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/comprar" className="text-blue-600 hover:underline">
            Catálogo
          </Link>
        </div>
      </div>

      {resource.loading && <p role="status" className="text-gray-500">Cargando pedido...</p>}
      {resource.error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-800 rounded">
          <p>{resource.error}</p>
          <div className="mt-2 flex gap-3 text-sm">
            <button onClick={() => setRevision((n) => n + 1)} className="font-semibold underline">
              Reintentar
            </button>
            <Link href="/login" className="underline">
              Iniciar sesión
            </Link>
          </div>
        </div>
      )}

      {cancelSuccess && (
        <div role="status" className="p-4 bg-green-50 border border-green-200 text-green-800 rounded text-sm">
          {cancelSuccess}
        </div>
      )}

      {order && (
        <>
          {/* Order Status Banners */}
          {order.status === "CANCELLED" && (
            <div className="p-4 bg-gray-100 border border-gray-300 text-gray-800 rounded text-sm">
              <span className="font-bold">⚠️ Pedido Cancelado:</span> Este pedido ha sido cancelado y su inventario reservado fue restituido.
            </div>
          )}

          {/* Stepper / Tracking visual */}
          <div className="bg-white border rounded-lg p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Seguimiento del pedido
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div
                className={`p-2.5 rounded border ${
                  order.status !== "CANCELLED" ? "bg-green-50 border-green-300 text-green-800 font-semibold" : "bg-gray-50 text-gray-400"
                }`}
              >
                1. Registrado
              </div>
              <div
                className={`p-2.5 rounded border ${
                  order.payment.status === "REPORTED" || order.payment.status === "CONFIRMED"
                    ? "bg-green-50 border-green-300 text-green-800 font-semibold"
                    : order.payment.status === "REJECTED"
                    ? "bg-red-50 border-red-300 text-red-800 font-semibold"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                2. Pago {order.payment.status === "REPORTED" ? "Reportado" : order.payment.status === "REJECTED" ? "Rechazado" : order.payment.status === "CONFIRMED" ? "Verificado" : "Pendiente"}
              </div>
              <div
                className={`p-2.5 rounded border ${
                  order.status === "PREPARING" || order.status === "SHIPPED" || order.status === "DELIVERED"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-800 font-semibold"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                3. Preparación
              </div>
              <div
                className={`p-2.5 rounded border ${
                  order.status === "SHIPPED" || order.status === "DELIVERED"
                    ? "bg-blue-50 border-blue-300 text-blue-800 font-semibold"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                4. En camino
              </div>
              <div
                className={`p-2.5 rounded border ${
                  order.status === "DELIVERED"
                    ? "bg-green-50 border-green-300 text-green-800 font-semibold"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                5. Entregado
              </div>
            </div>

            <div className="flex flex-wrap justify-between items-center pt-2 text-sm border-t gap-3">
              <div>
                <span className="text-gray-500">Estado Pedido: </span>
                <strong className="text-gray-900">{status[order.status]}</strong>
              </div>
              <div>
                <span className="text-gray-500">Estado Pago: </span>
                <strong className="text-gray-900">{status[order.payment.status]}</strong>
              </div>
              <div className="flex items-center gap-2">
                <OrderWhatsAppButton orderNumber={order.number} />
                {canCancel && (
                  <button
                    onClick={() => {
                      setShowCancelModal(true);
                      setCancelError(null);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-700 text-xs px-3 py-1.5 rounded font-medium border border-red-200"
                  >
                    Cancelar pedido
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Products List */}
          <div className="bg-white border rounded-lg p-5 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Productos comprados</h2>
            <ul className="order-items divide-y text-sm">
              {order.items.map((line) => (
                <li key={line.variant_id} className="py-3 flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{line.product_name}</h3>
                    <p className="text-xs text-gray-500">
                      {line.variant_name} · SKU {line.sku}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {line.quantity} × {cop(line.unit_price)}
                    </p>
                  </div>
                  <strong className="text-sm font-semibold text-gray-900">{cop(line.total)}</strong>
                </li>
              ))}
            </ul>
          </div>

          {/* Delivery & Summary Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="bg-white border rounded-lg p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Datos de Entrega
              </h2>
              {order.delivery.mode === "PICKUP" ? (
                <p className="text-sm text-gray-700">Recogida en tienda (Gratis)</p>
              ) : (
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="font-medium">{order.delivery.address.recipient_name}</p>
                  <p>{order.delivery.address.address_line}</p>
                  <p>
                    {order.delivery.address.city}, {order.delivery.address.state}
                  </p>
                  <p className="text-xs text-gray-500">Teléfono: {order.delivery.address.phone}</p>
                  {order.delivery.address.notes && (
                    <p className="text-xs text-gray-500 italic">Notas: {order.delivery.address.notes}</p>
                  )}
                </div>
              )}
            </section>

            <section className="bg-white border rounded-lg p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Resumen de Compra
              </h2>
              <dl className="purchase-totals text-sm space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Subtotal</dt>
                  <dd>{cop(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Descuentos</dt>
                  <dd className="text-green-600">-{cop(order.discount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Envío</dt>
                  <dd>{cop(order.shipping)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold text-base text-gray-900">
                  <dt>Total COP</dt>
                  <dd>{cop(order.total)}</dd>
                </div>
              </dl>

              {(order.payment.status === "PENDING" || order.payment.status === "REJECTED") && order.status !== "CANCELLED" && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 space-y-2">
                  <p>
                    <strong>Plazo para reportar pago:</strong>{" "}
                    {new Date(order.payment.report_deadline_at).toLocaleString("es-CO", {
                      timeZone: "America/Bogota",
                    })}{" "}
                    (Bogotá)
                  </p>
                  <Link
                    href={`/pedidos/${order.number}/pago`}
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded"
                  >
                    Instrucciones y Reporte de Pago
                  </Link>
                </div>
              )}
            </section>
          </div>

          {/* Timeline / Historial */}
          {order.history && order.history.length > 0 && (
            <div className="bg-white border rounded-lg p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Historial de Cambios
              </h2>
              <ul className="border-l-2 border-blue-400 ml-2 space-y-2 text-xs pl-3">
                {order.history.map((h) => (
                  <li key={h.id}>
                    <span className="font-semibold text-gray-900">{status[h.status] || h.status}</span>
                    <span className="text-gray-500"> — {new Date(h.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Customer Cancellation Modal */}
      {showCancelModal && order && (
        <Modal label="Confirmar accion" onClose={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">¿Deseas cancelar este pedido?</h2>
            <p className="text-sm text-gray-600">
              Esta acción liberará de inmediato los productos reservados para que otros clientes puedan comprarlos.
            </p>
            {cancelError && <p role="alert" className="text-xs text-red-600">{cancelError}</p>}
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label htmlFor="cancel-reason" className="block text-xs font-medium text-gray-700 mb-1">
                  Motivo (opcional):
                </label>
                <textarea
                  id="cancel-reason"
                  rows={2}
                  placeholder="Ej: Cambio de opinión, error en la dirección..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelSubmitting}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Volver al pedido
                </button>
                <button
                  type="submit"
                  disabled={cancelSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded disabled:opacity-50"
                >
                  Confirmar Cancelación
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function Orders() {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const resource = useResource<Page<Order>>(`/orders/?page=${page}`, revision);

  return (
    <section className="purchase-shell max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="purchase-heading flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mis pedidos</h1>
          <p className="text-sm text-gray-500">Historial y seguimiento de tus compras en línea.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/comprar" className="text-blue-600 hover:underline">
            Comprar
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/cuenta" className="text-blue-600 hover:underline">
            Mi cuenta
          </Link>
        </div>
      </div>

      {resource.loading && <p role="status" className="text-gray-500">Cargando pedidos...</p>}
      {resource.error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
          <p>{resource.error}</p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => setRevision((n) => n + 1)} className="font-semibold underline">
              Reintentar
            </button>
            <Link href="/login" className="underline">
              Iniciar sesión
            </Link>
          </div>
        </div>
      )}

      {resource.data?.count === 0 && (
        <div className="text-center py-12 bg-white border rounded-lg">
          <p className="text-gray-500 text-sm">Todavía no has realizado pedidos.</p>
          <Link
            href="/comprar"
            className="mt-3 inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded font-medium"
          >
            Explorar catálogo
          </Link>
        </div>
      )}

      {resource.data && resource.data.results.length > 0 && (
        <ul className="order-items space-y-3">
          {resource.data.results.map((order) => (
            <li
              key={order.number}
              className="bg-white border rounded-lg p-4 shadow-sm hover:border-blue-300 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
            >
              <div className="space-y-1">
                <Link
                  href={`/pedidos/${order.number}`}
                  className="font-mono text-sm font-bold text-blue-600 hover:underline"
                >
                  Pedido #{order.number.slice(0, 8)}...
                </Link>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                    Pedido: {status[order.status] || order.status}
                  </span>
                  <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded">
                    Pago: {status[order.payment?.status] || order.payment?.status || "Pendiente"}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleDateString("es-CO", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                <strong className="text-base font-bold text-gray-900">{cop(order.total)}</strong>
                <Link
                  href={`/pedidos/${order.number}`}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Ver seguimiento →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {resource.data && (
        <Pager page={page} data={resource.data} onChange={setPage} />
      )}
    </section>
  );
}
