"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Modal } from "@/components/modal";
import { Pager } from "@/features/catalog/shared";
import { api } from "@/services/api";
import { cop, type AdminOrder } from "./types";

interface PageResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function AdminOrderList({ initialOrderNumber }: { initialOrderNumber?: string } = {}) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PageResponse<unknown>>({count: 0, next: null, previous: null, results: []});
  const requestVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Selected order for detailed modal
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  // Cancel dialog
  const [cancellingOrder, setCancellingOrder] = useState<AdminOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!initialOrderNumber) return;
    const controller = new AbortController();
    api<AdminOrder>(`/admin/orders/${encodeURIComponent(initialOrderNumber)}/`, {signal: controller.signal})
      .then((order) => { if (!controller.signal.aborted) setSelectedOrder(order); })
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Pedido no disponible"); });
    return () => controller.abort();
  }, [initialOrderNumber]);

  const fetchOrders = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({page: String(page)});
      if (statusFilter) params.set("status", statusFilter);
      if (deliveryFilter) params.set("delivery_mode", deliveryFilter);
      if (search) params.set("q", search);

      const data = await api<PageResponse<AdminOrder>>(`/admin/orders/?${params.toString()}`);
      if (version !== requestVersion.current) return;
      setPagination(data);
      setOrders(data.results);
    } catch (err: unknown) {
      if (version === requestVersion.current) setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [statusFilter, deliveryFilter, search, page]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void fetchOrders();
    });
    return () => {
      active = false;
    };
  }, [fetchOrders]);

  const handleTransition = async (orderNumber: string, targetStatus: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api(`/admin/orders/${orderNumber}/transition/`, {
        method: "POST",
        body: JSON.stringify({ target_status: targetStatus }),
      });
      setActionMessage(`✅ Pedido actualizado a estado ${targetStatus}.`);
      setTimeout(() => setActionMessage(null), 4000);
      fetchOrders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar la transición");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api(`/orders/${cancellingOrder.number}/cancel/`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason || "Cancelación administrativa" }),
      });
      setActionMessage("⚠️ Pedido cancelado e inventario restituido con éxito.");
      setTimeout(() => setActionMessage(null), 4000);
      setCancellingOrder(null);
      setCancelReason("");
      fetchOrders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const orderBadge = (st: string) => {
    switch (st) {
      case "PENDING":
        return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-semibold">Pendiente</span>;
      case "PREPARING":
        return <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded font-semibold">En preparación</span>;
      case "SHIPPED":
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-semibold">Enviado</span>;
      case "DELIVERED":
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-semibold">Entregado</span>;
      case "CANCELLED":
        return <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded font-semibold">Cancelado</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded font-semibold">{st}</span>;
    }
  };

  const paymentBadge = (st: string) => {
    switch (st) {
      case "CONFIRMED":
        return <span className="text-green-700 font-medium">Pago Confirmado</span>;
      case "REPORTED":
        return <span className="text-blue-700 font-medium">Pago Reportado</span>;
      case "REJECTED":
        return <span className="text-red-700 font-medium">Pago Rechazado</span>;
      default:
        return <span className="text-yellow-700 font-medium">Pago Pendiente</span>;
    }
  };

  const deliveryBadge = (mode?: string) => {
    switch (mode) {
      case "PICKUP":
        return <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-medium">🏪 Recogida en tienda</span>;
      case "URBAN":
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-medium">🚚 Envío urbano</span>;
      case "SPECIAL":
        return <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded font-medium">📍 Zona especial</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded">{mode || "N/A"}</span>;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión Administrativa de Pedidos</h1>
          <p className="text-sm text-gray-500">Control de estados, alistamiento, despachos y entregas.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/pagos"
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium"
          >
            Bandeja de Pagos
          </Link>
          <Link
            href="/admin/clientes"
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded font-medium"
          >
            Clientes
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div role="status" className="p-4 bg-green-50 border border-green-200 text-green-800 rounded text-sm">
          {actionMessage}
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-gray-50 p-4 rounded border">
        <div className="flex items-center gap-2">
          <label htmlFor="order-status-filter" className="text-sm font-medium">Estado:</label>
          <select
            id="order-status-filter"
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="PREPARING">En preparación</option>
            <option value="SHIPPED">Enviados</option>
            <option value="DELIVERED">Entregados</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="order-delivery-filter" className="text-sm font-medium">Entrega:</label>
          <select
            id="order-delivery-filter"
            value={deliveryFilter}
            onChange={(e) => { setPage(1); setDeliveryFilter(e.target.value); }}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            <option value="">Todas</option>
            <option value="URBAN">Envío urbano</option>
            <option value="PICKUP">Recogida en tienda</option>
            <option value="SPECIAL">Zona especial</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Buscar por cliente, correo o número de pedido..."
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            className="w-full border rounded px-3 py-1.5 text-sm bg-white"
            aria-label="Buscar pedido"
          />
        </div>

        <button
          onClick={() => fetchOrders()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded font-medium"
        >
          Filtrar
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm" role="status">Cargando pedidos...</p>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white border rounded">
          No hay pedidos que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-3">Pedido</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Entrega</th>
                <th className="p-3">Total COP</th>
                <th className="p-3">Estado Pedido</th>
                <th className="p-3">Estado Pago</th>
                <th className="p-3">Fecha</th>
                <th className="p-3 text-center">Acciones y Transición</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => {
                const canPrepare = o.status === "PENDING" && o.payment.status === "CONFIRMED";
                const isPendingUnconfirmed = o.status === "PENDING" && o.payment.status !== "CONFIRMED";

                return (
                  <tr key={o.number} className="hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs">
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="text-blue-600 hover:underline font-bold text-left"
                      >
                        {o.number.slice(0, 8)}...
                      </button>
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-gray-900">{o.customer_name || "Cliente"}</p>
                      <p className="text-xs text-gray-500">{o.customer_email}</p>
                    </td>
                    <td className="p-3">
                      {deliveryBadge(o.delivery?.mode)}
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      {cop(o.total)}
                    </td>
                    <td className="p-3">
                      {orderBadge(o.status)}
                    </td>
                    <td className="p-3 text-xs">
                      {paymentBadge(o.payment.status)}
                    </td>
                    <td className="p-3 text-xs text-gray-600">
                      {new Date(o.created_at).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {/* Transition actions */}
                        {canPrepare && (
                          <button
                            onClick={() => handleTransition(o.number, "PREPARING")}
                            disabled={isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-2.5 py-1 rounded font-medium disabled:opacity-50"
                          >
                            Preparar
                          </button>
                        )}
                        {isPendingUnconfirmed && (
                          <span
                            className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded cursor-not-allowed"
                            title="Requiere pago confirmado"
                          >
                            Sin validar
                          </span>
                        )}
                        {o.status === "PREPARING" && (
                          <button
                            onClick={() => handleTransition(o.number, "SHIPPED")}
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1 rounded font-medium disabled:opacity-50"
                          >
                            Despachar
                          </button>
                        )}
                        {o.status === "SHIPPED" && (
                          <button
                            onClick={() => handleTransition(o.number, "DELIVERED")}
                            disabled={isSubmitting}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs px-2.5 py-1 rounded font-medium disabled:opacity-50"
                          >
                            Entregar
                          </button>
                        )}
                        {/* Cancel action */}
                        {(o.status === "PENDING" || o.status === "PREPARING") && o.payment.status !== "CONFIRMED" && (
                          <button
                            onClick={() => {
                              setCancellingOrder(o);
                              setCancelReason("");
                            }}
                            disabled={isSubmitting}
                            className="bg-gray-100 hover:bg-red-50 text-red-600 text-xs px-2 py-1 rounded border border-red-200"
                          >
                            Cancelar
                          </button>
                        )}
                        {/* Detail modal button */}
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="text-xs text-gray-600 hover:text-gray-900 border px-2 py-1 rounded bg-white"
                        >
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} data={pagination} onChange={setPage} />

      {/* Order Detail Modal */}
      {selectedOrder && (
        <Modal label="Detalle del pedido" onClose={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Pedido {selectedOrder.number}
                </h2>
                <p className="text-xs text-gray-500">
                  Cliente: {selectedOrder.customer_name} ({selectedOrder.customer_email})
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="border p-3 rounded">
                <p className="text-xs font-semibold text-gray-500">ESTADO PEDIDO</p>
                <div className="mt-1">{orderBadge(selectedOrder.status)}</div>
              </div>
              <div className="border p-3 rounded">
                <p className="text-xs font-semibold text-gray-500">ESTADO PAGO</p>
                <div className="mt-1">{paymentBadge(selectedOrder.payment.status)}</div>
                {selectedOrder.payment.reference && (
                  <p className="text-xs font-mono mt-1 text-gray-600">
                    Ref: {selectedOrder.payment.reference}
                  </p>
                )}
              </div>
            </div>

            {/* Products */}
            <div>
              <h3 className="font-semibold text-sm text-gray-800 mb-2">Productos ({selectedOrder.items?.length || 0})</h3>
              <ul className="divide-y border rounded text-xs">
                {selectedOrder.items?.map((item, idx) => (
                  <li key={idx} className="p-2.5 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{item.product_name} - {item.variant_name}</p>
                      <p className="text-gray-500">SKU: {item.sku} · Cantidad: {item.quantity}</p>
                    </div>
                    <span className="font-semibold">{cop(item.total)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Delivery Logistics Details - CO-71 HU-29 */}
            {selectedOrder.delivery && (
              <div className="border p-3.5 rounded-lg bg-gray-50/50 space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm text-gray-800">
                    Logística y Despacho de Entrega
                  </h3>
                  <div>{deliveryBadge(selectedOrder.delivery.mode)}</div>
                </div>
                {selectedOrder.delivery.mode === "PICKUP" ? (
                  <p className="text-xs text-gray-600">
                    Recogida directa en tienda por el cliente. Sin despacho por mensajería.
                  </p>
                ) : (
                  <div className="text-xs text-gray-700 space-y-1 bg-white p-3 rounded border">
                    <p>
                      <strong>Destinatario:</strong>{" "}
                      {selectedOrder.delivery.address?.recipient_name || selectedOrder.customer_name}
                    </p>
                    <p>
                      <strong>Dirección:</strong>{" "}
                      {selectedOrder.delivery.address?.address_line || "No especificada"}
                    </p>
                    <p>
                      <strong>Ciudad / Departamento:</strong>{" "}
                      {selectedOrder.delivery.address?.city || "Pasto"},{" "}
                      {selectedOrder.delivery.address?.state || "Nariño"}
                    </p>
                    <p>
                      <strong>Teléfono:</strong>{" "}
                      {selectedOrder.delivery.address?.phone || "No especificado"}
                    </p>
                    {selectedOrder.delivery.address?.notes && (
                      <p>
                        <strong>Notas / Indicaciones:</strong>{" "}
                        {selectedOrder.delivery.address.notes}
                      </p>
                    )}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const addr = selectedOrder.delivery.address || {};
                          const text = `DESTINATARIO: ${addr.recipient_name || selectedOrder.customer_name}\nDIRECCIÓN: ${addr.address_line || ""}\nCIUDAD: ${addr.city || "Pasto"}, ${addr.state || "Nariño"}\nTEL: ${addr.phone || ""}\nNOTAS: ${addr.notes || "N/A"}\nPEDIDO: #${selectedOrder.number}`;
                          navigator.clipboard.writeText(text);
                          setActionMessage("📋 Datos de despacho copiados al portapapeles.");
                          setTimeout(() => setActionMessage(null), 3000);
                        }}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 border px-2.5 py-1 rounded inline-flex items-center gap-1 font-medium"
                      >
                        📋 Copiar rótulo de despacho
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Totals */}
            <div className="bg-gray-50 p-3 rounded text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{cop(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Envío:</span>
                <span>{cop(selectedOrder.shipping)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total:</span>
                <span>{cop(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Status History Tracking */}
            {selectedOrder.history && selectedOrder.history.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm text-gray-800 mb-2">Historial de Transiciones</h3>
                <ol className="border-l-2 border-blue-500 ml-2 space-y-2 text-xs pl-3">
                  {selectedOrder.history.map((h) => (
                    <li key={h.id} className="relative">
                      <div className="font-medium text-gray-900">{h.status}</div>
                      <div className="text-gray-500">
                        {new Date(h.created_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · por {h.actor_email}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Order Modal */}
      {cancellingOrder && (
        <Modal label="Confirmar accion" onClose={() => setCancellingOrder(null)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Cancelar Pedido</h2>
            <p className="text-sm text-gray-600">
              ¿Estás seguro de cancelar el pedido{" "}
              <span className="font-mono">{cancellingOrder.number.slice(0, 8)}...</span>? El inventario reservado será restituido de inmediato.
            </p>
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label htmlFor="admin-cancel-reason" className="block text-xs font-medium text-gray-700 mb-1">
                  Motivo de cancelación:
                </label>
                <textarea
                  id="admin-cancel-reason"
                  rows={2}
                  placeholder="Ej: Solicitud administrativa, stock dañado..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancellingOrder(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded disabled:opacity-50"
                >
                  Confirmar Cancelación
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

