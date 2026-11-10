"use client";

import Link from "next/link";
import { Modal } from "@/components/modal";
import { useState } from "react";
import { Pager, useResource } from "@/features/catalog/shared";
import type { Page } from "@/features/catalog/types";
import { OrderWhatsAppButton } from "@/components/whatsapp-button";
import { api } from "@/services/api";
import { cop, type Order } from "./types";
import { OrderReviewForm } from "@/features/reviews/reviews";

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

const orderStatusBadgeClass = (st: string) => {
  switch (st) {
    case "DELIVERED":
      return "bg-emerald-100 text-emerald-800 border border-emerald-200";
    case "SHIPPED":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "PREPARING":
      return "bg-indigo-100 text-indigo-800 border border-indigo-200";
    case "CANCELLED":
      return "bg-slate-200 text-slate-700 border border-slate-300";
    default:
      return "bg-amber-100 text-amber-800 border border-amber-200";
  }
};

const paymentStatusBadgeClass = (st?: string) => {
  switch (st) {
    case "CONFIRMED":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "REPORTED":
      return "bg-blue-50 text-blue-800 border border-blue-200";
    case "REJECTED":
      return "bg-red-50 text-red-800 border border-red-200";
    default:
      return "bg-yellow-50 text-yellow-800 border border-yellow-200";
  }
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
                <li key={line.id ?? line.variant_id} className="py-3 flex justify-between items-start gap-4 flex-wrap">
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
                  {line.id && line.review_eligibility?.can_review && (
                    <OrderReviewForm
                      orderItemId={line.order_item_id ?? line.id}
                      existing={line.review_eligibility.existing_review}
                      onSaved={() => setRevision((n) => n + 1)}
                    />
                  )}
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
                    className="button primary inline-flex items-center justify-center w-full text-center text-sm"
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

  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  const handleListCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;
    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await api(`/orders/${cancellingOrder.number}/cancel/`, {
        method: "POST",
        body: JSON.stringify({
          reason: cancelReason || "Cancelado por el cliente",
        }),
      });
      setCancelSuccess("Pedido cancelado exitosamente y stock restituido.");
      setCancellingOrder(null);
      setCancelReason("");
      setRevision((n) => n + 1);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <section className="purchase-shell max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="purchase-heading flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mis pedidos</h1>
          <p className="text-sm text-gray-500">Historial, pagos, cancelaciones y seguimiento de tus compras.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/catalogo" className="text-blue-600 hover:underline">
            Catálogo
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/cuenta" className="text-blue-600 hover:underline">
            Mi cuenta
          </Link>
        </div>
      </div>

      {cancelSuccess && (
        <div role="status" className="p-4 bg-green-50 border border-green-200 text-green-800 rounded text-sm">
          {cancelSuccess}
        </div>
      )}

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
          <p className="text-gray-500 text-sm mb-3">Todavía no has realizado pedidos.</p>
          <Link
            href="/catalogo"
            className="button primary inline-flex items-center justify-center !w-auto px-5 py-2 text-sm"
          >
            Explorar catálogo
          </Link>
        </div>
      )}

      {resource.data && resource.data.results.length > 0 && (
        <ul className="order-items order-cards-list">
          {resource.data.results.map((order) => {
            const canCancel =
              order.status === "PENDING" && order.payment?.status !== "CONFIRMED";
            const canReportPayment =
              order.status === "PENDING" &&
              (order.payment?.status === "PENDING" || order.payment?.status === "REJECTED") &&
              order.payment?.report_window_active;

            return (
              <li
                key={order.number}
                className="shadow-sm hover:border-blue-300 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/pedidos/${order.number}`}
                      className="font-mono text-sm font-bold text-blue-600 hover:underline"
                    >
                      Pedido #{order.number.slice(0, 8)}
                    </Link>
                    <span className="text-xs text-slate-400">
                      ·{" "}
                      {new Date(order.created_at).toLocaleString("es-CO", {
                        timeZone: "America/Bogota",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {order.items && order.items.length > 0 && (
                    <p className="text-sm text-slate-700 font-medium m-0">
                      {order.items
                        .map((item) => `${item.product_name} × ${item.quantity}`)
                        .join(" · ")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-medium ${orderStatusBadgeClass(order.status)}`}
                    >
                      Pedido: {status[order.status] || order.status}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-medium ${paymentStatusBadgeClass(order.payment?.status)}`}
                    >
                      Pago: {status[order.payment?.status] || order.payment?.status || "Pendiente"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end justify-between w-full sm:w-auto gap-2.5 shrink-0">
                  <strong className="text-lg font-bold text-slate-900">{cop(order.total)}</strong>
                  <div className="flex flex-wrap items-center gap-2">
                    {canReportPayment && (
                      <Link
                        href={`/pedidos/${order.number}/pago`}
                        className="button primary !w-auto !min-h-0 px-3 py-1.5 text-xs"
                      >
                        Pagar / Reportar
                      </Link>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancellingOrder(order);
                          setCancelError(null);
                          setCancelReason("");
                        }}
                        className="bg-red-50 hover:bg-red-100 text-red-700 text-xs px-3 py-1.5 rounded font-medium border border-red-200"
                      >
                        Cancelar pedido
                      </button>
                    )}
                    <Link
                      href={`/pedidos/${order.number}`}
                      className="button secondary !w-auto !min-h-0 px-3 py-1.5 text-xs"
                    >
                      Ver seguimiento →
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {resource.data && (
        <Pager page={page} data={resource.data} onChange={setPage} />
      )}

      {cancellingOrder && (
        <Modal label="Confirmar cancelación" onClose={() => setCancellingOrder(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">¿Deseas cancelar este pedido?</h2>
            <p className="text-sm text-gray-600">
              Se cancelará el pedido <strong>#{cancellingOrder.number.slice(0, 8)}</strong> y las unidades volverán al inventario disponible.
            </p>
            {cancelError && <p role="alert" className="text-xs text-red-600">{cancelError}</p>}
            <form onSubmit={handleListCancelSubmit} className="space-y-4">
              <div>
                <label htmlFor="list-cancel-reason" className="block text-xs font-medium text-gray-700 mb-1">
                  Motivo (opcional):
                </label>
                <textarea
                  id="list-cancel-reason"
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
                  onClick={() => setCancellingOrder(null)}
                  disabled={cancelSubmitting}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Volver
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
