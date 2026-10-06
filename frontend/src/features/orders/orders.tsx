"use client";

import Link from "next/link";
import { useState } from "react";
import { Pager, useResource } from "@/features/catalog/shared";
import type { Page } from "@/features/catalog/types";
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
  const resource = useResource<Order>(
    `/orders/${encodeURIComponent(number)}/`,
    revision,
  );
  const order = resource.data;
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
