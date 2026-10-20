"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { cop, type AdminPayment } from "./types";

interface PageResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function AdminPaymentList() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("REPORTED");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modal state for rejection
  const [rejectingPayment, setRejectingPayment] = useState<AdminPayment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("q", search);

      const res = await fetch(`/api/v1/admin/payments/?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar la lista de pagos.");
      }
      const data: PageResponse<AdminPayment> = await res.json();
      setPayments(data.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void fetchPayments();
    });
    return () => {
      active = false;
    };
  }, [fetchPayments]);

  const handleConfirm = async (id: number) => {
    if (!confirm("¿Confirmas que verificaste la recepción de fondos para este pago?")) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/payments/${id}/confirm/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Error al confirmar el pago.");
      }
      setActionMessage("✅ Pago confirmado exitosamente.");
      setTimeout(() => setActionMessage(null), 4000);
      fetchPayments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al confirmar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPayment) return;
    if (!rejectReason.trim()) {
      alert("Por favor indica el motivo del rechazo.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/payments/${rejectingPayment.id}/reject/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Error al rechazar el pago.");
      }
      setActionMessage("⚠️ Pago rechazado y registrado.");
      setTimeout(() => setActionMessage(null), 4000);
      setRejectingPayment(null);
      setRejectReason("");
      fetchPayments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusBadge = (st: string) => {
    switch (st) {
      case "CONFIRMED":
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-semibold">Confirmado</span>;
      case "REPORTED":
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-semibold">Reportado</span>;
      case "REJECTED":
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-semibold">Rechazado</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded font-semibold">Pendiente</span>;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bandeja de Verificación de Pagos</h1>
          <p className="text-sm text-gray-500">Revisión de fondos transferidos y resolución de pagos.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/pedidos"
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded font-medium"
          >
            Ver Pedidos
          </Link>
          <Link
            href="/admin/clientes"
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded font-medium"
          >
            Ver Clientes
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
          <label htmlFor="status-filter" className="text-sm font-medium">Estado:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            <option value="REPORTED">Reportados (Por verificar)</option>
            <option value="CONFIRMED">Confirmados</option>
            <option value="REJECTED">Rechazados</option>
            <option value="PENDING">Pendientes de reporte</option>
            <option value="">Todos los estados</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <input
            type="search"
            placeholder="Buscar por cliente, correo o referencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm bg-white"
            aria-label="Buscar pago"
          />
        </div>

        <button
          onClick={() => fetchPayments()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded font-medium"
        >
          Filtrar
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm" role="status">Cargando pagos...</p>
      ) : payments.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white border rounded">
          No hay pagos para mostrar con los filtros seleccionados.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-3">Pedido</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Total COP</th>
                <th className="p-3">Referencia</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Fecha Reporte</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/admin/pedidos/${p.order_number}`} className="text-blue-600 hover:underline">
                      {p.order_number.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-gray-900">{p.customer_name || "Cliente"}</p>
                    <p className="text-xs text-gray-500">{p.customer_email}</p>
                  </td>
                  <td className="p-3 font-semibold text-gray-900">
                    {cop(p.order_total)}
                  </td>
                  <td className="p-3 font-mono text-xs bg-gray-50 px-2 py-1 rounded">
                    {p.reference || "Sin referencia"}
                  </td>
                  <td className="p-3">
                    {statusBadge(p.status)}
                  </td>
                  <td className="p-3 text-xs text-gray-600">
                    {p.reported_at
                      ? new Date(p.reported_at).toLocaleString("es-CO", { timeZone: "America/Bogota" })
                      : "—"}
                  </td>
                  <td className="p-3 text-center">
                    {p.status === "REPORTED" ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleConfirm(p.id)}
                          disabled={isSubmitting}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-2.5 py-1.5 rounded font-medium transition disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => {
                            setRejectingPayment(p);
                            setRejectReason("");
                          }}
                          disabled={isSubmitting}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs px-2.5 py-1.5 rounded font-medium transition disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Resuelto</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Rechazar Pago</h2>
            <p className="text-sm text-gray-600">
              Indica la razón por la cual no se valida el comprobante para el pedido{" "}
              <span className="font-mono">{rejectingPayment.order_number.slice(0, 8)}...</span>.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label htmlFor="reject-reason" className="block text-xs font-medium text-gray-700 mb-1">
                  Motivo obligatorio:
                </label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  required
                  placeholder="Ej: La referencia bancaria no aparece acreditada en la cuenta oficial..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingPayment(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded disabled:opacity-50"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

