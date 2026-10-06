"use client";

import Link from "next/link";
import { useState } from "react";
import { api, type User } from "@/services/api";
import { errorText, Pager, useResource } from "@/features/catalog/shared";
import type { Page } from "@/features/catalog/types";

type Balance = {
  variant: number;
  product_name: string;
  sku: string;
  available_quantity: number;
};
type Movement = {
  id: number;
  sku: string;
  type: string;
  quantity: number;
  resulting_quantity: number;
  reason: string;
  created_at: string;
};

function InventoryContent() {
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Balance | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const balances = useResource<Page<Balance>>(
    `/admin/inventory/?page=${page}&search=${encodeURIComponent(search)}`,
    revision,
  );
  const movements = useResource<Page<Movement>>(
    `/admin/inventory/movements/?page=${historyPage}${selected ? `&variant=${selected.variant}` : ""}`,
    revision,
  );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/admin/inventory/entries/", {
        method: "POST",
        body: JSON.stringify({
          variant: selected.variant,
          quantity: Number(quantity),
          reason,
        }),
      });
      setQuantity("1");
      setReason("");
      setRevision((n) => n + 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <label className="field">
        Buscar SKU o producto
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </label>
      {balances.loading && <p role="status">Cargando inventario...</p>}
      {(error || balances.error) && (
        <p role="alert" className="error-message">
          {error || balances.error}
        </p>
      )}
      <div className="purchase-layout">
        <section>
          <h2>Existencias</h2>
          <ul className="order-items">
            {balances.data?.results.map((balance) => (
              <li key={balance.variant}>
                <strong>{balance.product_name}</strong>
                <p>
                  {balance.sku} · {balance.available_quantity} unidades
                </p>
                <button
                  className="button primary"
                  onClick={() => {
                    setSelected(balance);
                    setHistoryPage(1);
                  }}
                >
                  Registrar entrada: {balance.sku}
                </button>
              </li>
            ))}
          </ul>
          {balances.data?.count === 0 && (
            <p>
              No hay variantes.{" "}
              <Link href="/admin/catalogo">Administrar catálogo</Link>
            </p>
          )}
          {balances.data && (
            <Pager page={page} data={balances.data} onChange={setPage} />
          )}
        </section>
        <section>
          {selected && (
            <form onSubmit={save}>
              <h2>Entrada de {selected.sku}</h2>
              <fieldset disabled={busy}>
                <label className="field">
                  Cantidad de entrada
                  <input
                    type="number"
                    min={1}
                    max={2147483647}
                    required
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                <label className="field">
                  Motivo
                  <input
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <button className="button primary">
                  {busy ? "Guardando..." : "Guardar entrada"}
                </button>
              </fieldset>
            </form>
          )}
          <h2>Movimientos</h2>
          {movements.loading && <p role="status">Cargando movimientos...</p>}
          {movements.error && <p role="alert">{movements.error}</p>}
          <ul className="order-items">
            {movements.data?.results.map((movement) => (
              <li key={movement.id}>
                <strong>
                  {movement.type} · {movement.sku}
                </strong>
                <p>
                  {movement.quantity > 0 ? "+" : ""}
                  {movement.quantity} · Saldo {movement.resulting_quantity}
                </p>
                <p>{movement.reason}</p>
              </li>
            ))}
          </ul>
          {movements.data && (
            <Pager
              page={historyPage}
              data={movements.data}
              onChange={setHistoryPage}
            />
          )}
        </section>
      </div>
    </>
  );
}

export function Inventory() {
  const user = useResource<User>("/users/me/");
  return (
    <section className="purchase-shell">
      <div className="purchase-heading">
        <h1>Inventario</h1>
        <Link href="/admin/catalogo">Catálogo</Link>
        <Link href="/comprar">Comprar</Link>
      </div>
      {user.loading ? (
        <p role="status">Comprobando acceso...</p>
      ) : user.data?.role === "ADMIN" ? (
        <InventoryContent />
      ) : (
        <p role="alert">Solo administradores pueden gestionar inventario.</p>
      )}
    </section>
  );
}
