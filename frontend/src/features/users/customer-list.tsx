"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Search, Users } from "lucide-react";
import { api, ApiError } from "@/services/api";

export interface Customer {
  id: number;
  name: string;
  email: string;
  created_at: string;
  order_count: number;
}

export function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query = "") => {
    setLoading(true);
    setError(null);
    try {
      const path = query.trim()
        ? `/admin/customers/?q=${encodeURIComponent(query.trim())}`
        : "/admin/customers/";
      const data = await api<Customer[]>(path);
      setCustomers(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setError("No tienes permisos para consultar clientes.");
      } else if (err instanceof ApiError && err.status === 401) {
        setError("Sesión expirada. Inicia sesión nuevamente.");
      } else {
        setError(err instanceof Error ? err.message : "Error al cargar la lista de clientes.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void load(search);
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <section className="catalog-shell" aria-labelledby="customers-heading">
      <div className="catalog-heading">
        <h1 id="customers-heading" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Users size={24} aria-hidden="true" /> Clientes registrados
        </h1>
        <Link href="/cuenta" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <ArrowLeft size={16} /> Volver a mi cuenta
        </Link>
      </div>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "8px", margin: "16px 0" }}>
        <label htmlFor="customer-search-input" className="sr-only">
          Buscar cliente
        </label>
        <input
          id="customer-search-input"
          name="customer-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo electrónico..."
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            fontSize: "14px",
          }}
          aria-label="Buscar cliente"
        />
        <button
          type="submit"
          className="button primary"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Search size={16} aria-hidden="true" /> Buscar
        </button>
        {search && (
          <button
            type="button"
            className="button subtle"
            onClick={() => {
              setSearch("");
              void load("");
            }}
          >
            Limpiar
          </button>
        )}
      </form>

      {error && (
        <div role="alert" className="error-message" style={{ margin: "16px 0" }}>
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => void load(search)}
            style={{ marginTop: "8px" }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {loading && (
        <p role="status" style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
          Cargando clientes...
        </p>
      )}

      {!loading && !error && customers.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
          <p>No se encontraron clientes {search ? `para "${search}"` : "registrados"}.</p>
        </div>
      )}

      {!loading && !error && customers.length > 0 && (
        <div style={{ overflowX: "auto", margin: "16px 0" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "10px 12px" }}>ID</th>
                <th style={{ padding: "10px 12px" }}>Nombre completo</th>
                <th style={{ padding: "10px 12px" }}>Correo electrónico</th>
                <th style={{ padding: "10px 12px" }}>Fecha de registro</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>#{c.id}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: "10px 12px", color: "#334155" }}>{c.email}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>
                    {formatDate(c.created_at)}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: c.order_count > 0 ? "#e0f2fe" : "#f1f5f9",
                        color: c.order_count > 0 ? "#0369a1" : "#64748b",
                      }}
                    >
                      {c.order_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "12px" }}>
            Total: {customers.length} cliente(s) listado(s).
          </p>
        </div>
      )}
    </section>
  );
}
