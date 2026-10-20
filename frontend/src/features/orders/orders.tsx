"use client";

import Link from "next/link";
import { useState } from "react";
import { Pager, errorText, useResource } from "@/features/catalog/shared";
import type { Page } from "@/features/catalog/types";
import { api } from "@/services/api";
import { cop, type Order } from "./types";

const status: Record<string, string> = {
  PENDING: "Pendiente",
  REPORTED: "Reportado",
  CONFIRMED: "Confirmado",
  REJECTED: "Rechazado",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export function OrderDetail({ number }: { number: string }) {
  const [revision, setRevision] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const resource = useResource<Order>(
    `/orders/${encodeURIComponent(number)}/`,
    revision,
  );
  const order = resource.data;

  async function handleCancel() {
    if (
      !window.confirm(
        "¿Estás seguro de que deseas cancelar este pedido? El inventario será restituido inmediatamente.",
      )
    ) {
      return;
    }
    setCancelling(true);
    setCancelError("");
    setCancelSuccess(false);
    try {
      await api<Order>(`/orders/${encodeURIComponent(number)}/cancel/`, {
        method: "POST",
        body: JSON.stringify({ reason: "Cancelado por el cliente" }),
      });
      setCancelSuccess(true);
      setRevision((n) => n + 1);
    } catch (err) {
      setCancelError(errorText(err));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="purchase-shell order-detail">
      <div className="purchase-heading">
        <h1>Detalle del pedido</h1>
        <Link href="/pedidos">Mis pedidos</Link>
        <Link href="/comprar">Comprar</Link>
      </div>
      {resource.loading && <p role="status">Cargando pedido...</p>}
      {resource.error && (
        <p role="alert">
          {resource.error}{" "}
          <button onClick={() => setRevision((n) => n + 1)}>Reintentar</button>{" "}
          <Link href="/login">Iniciar sesión</Link>
        </p>
      )}
      {order && (
        <>
          <p>
            Número: <strong>{order.number}</strong>
          </p>
          <p>Pedido: {status[order.status]}</p>
          <p>Pago: {status[order.payment.status]}</p>
          <h2>Productos</h2>
          <ul className="order-items">
            {order.items.map((line) => (
              <li key={line.variant_id}>
                <h3>{line.product_name}</h3>
                <p>
                  {line.variant_name} · SKU {line.sku}
                </p>
                <p>
                  {line.quantity} × {cop(line.unit_price)}
                </p>
                <strong>{cop(line.total)}</strong>
              </li>
            ))}
          </ul>
          <div className="purchase-layout">
            <section>
              <h2>Entrega</h2>
              {order.delivery.mode === "PICKUP" ? (
                <p>Recogida en tienda</p>
              ) : (
                <>
                  <p>{order.delivery.address.recipient_name}</p>
                  <p>{order.delivery.address.address_line}</p>
                  <p>
                    {order.delivery.address.city},{" "}
                    {order.delivery.address.state}
                  </p>
                  <p>{order.delivery.address.phone}</p>
                  <p>{order.delivery.address.notes}</p>
                </>
              )}
            </section>
            <section>
              <h2>Total</h2>
              <dl className="purchase-totals">
                <dt>Subtotal</dt>
                <dd>{cop(order.subtotal)}</dd>
                <dt>Descuentos</dt>
                <dd>{cop(order.discount)}</dd>
                <dt>Envío</dt>
                <dd>{cop(order.shipping)}</dd>
                <dt>Total COP</dt>
                <dd>
                  <strong>{cop(order.total)}</strong>
                </dd>
              </dl>
              <p>
                {order.payment.status === "REPORTED"
                  ? "Plazo de revisión:"
                  : "Plazo para reportar pago:"}{" "}
                {new Date(
                  order.payment.review_deadline_at ??
                    order.payment.report_deadline_at,
                ).toLocaleString("es-CO", { timeZone: "America/Bogota" })}{" "}
                (Bogotá)
              </p>
              <Link href={`/pedidos/${order.number}/pago`}>
                Instrucciones de pago
              </Link>
              {["PENDING", "PREPARING"].includes(order.status) && (
                <div style={{ marginTop: "1rem" }}>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    style={{
                      background: "#fee2e2",
                      color: "#991b1b",
                      border: "1px solid #f87171",
                      borderRadius: "6px",
                      padding: "8px 16px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: cancelling ? "not-allowed" : "pointer",
                    }}
                  >
                    {cancelling ? "Cancelando pedido..." : "Cancelar pedido"}
                  </button>
                </div>
              )}
              {cancelSuccess && (
                <p role="status" style={{ color: "#166534", marginTop: "0.5rem" }}>
                  Pedido cancelado exitosamente. El inventario ha sido restituido.
                </p>
              )}
              {cancelError && (
                <p role="alert" style={{ color: "#991b1b", marginTop: "0.5rem" }}>
                  {cancelError}
                </p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export function Orders() {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const resource = useResource<Page<Order>>(`/orders/?page=${page}`, revision);
  return (
    <section className="purchase-shell">
      <div className="purchase-heading">
        <h1>Mis pedidos</h1>
        <Link href="/comprar">Comprar</Link>
        <Link href="/cuenta">Mi cuenta</Link>
      </div>
      {resource.loading && <p role="status">Cargando pedidos...</p>}
      {resource.error && (
        <p role="alert">
          {resource.error}{" "}
          <button onClick={() => setRevision((n) => n + 1)}>Reintentar</button>{" "}
          <Link href="/login">Iniciar sesión</Link>
        </p>
      )}
      {resource.data?.count === 0 && <p>Todavía no tienes pedidos.</p>}
      <ul className="order-items">
        {resource.data?.results.map((order) => (
          <li key={order.number}>
            <Link href={`/pedidos/${order.number}`}>Pedido {order.number}</Link>
            <p>
              Pedido: {status[order.status]} · Pago:{" "}
              {status[order.payment.status]}
            </p>
            <strong>{cop(order.total)}</strong>
          </li>
        ))}
      </ul>
      {resource.data && (
        <Pager page={page} data={resource.data} onChange={setPage} />
      )}
    </section>
  );
}
