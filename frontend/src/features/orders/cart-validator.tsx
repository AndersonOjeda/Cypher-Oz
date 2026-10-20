"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/services/api";
import { cop, type CartLine } from "./types";

export interface RevalidationItemResult {
  variant_id: number;
  product_name?: string;
  variant_name?: string;
  sku?: string;
  status: "ok" | "price_changed" | "out_of_stock" | "insufficient_stock" | "inactive";
  message: string | null;
  current_price: string | null;
  available_qty: number;
}

export interface RevalidationResponse {
  items: RevalidationItemResult[];
  has_changes: boolean;
}

interface CartValidatorProps {
  cart: CartLine[];
  onValidationComplete?: (response: RevalidationResponse) => void;
  disabled?: boolean;
}

export function CartValidator({
  cart,
  onValidationComplete,
  disabled = false,
}: CartValidatorProps) {
  const [results, setResults] = useState<RevalidationItemResult[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revalidate = useCallback(async () => {
    if (cart.length === 0) {
      setResults([]);
      setHasChanges(false);
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      items: cart.map((line) => ({
        variant_id: line.variant_id,
        quantity: line.quantity,
      })),
    };

    try {
      const response = await api<RevalidationResponse>("/checkout/validate/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResults(response.items);
      setHasChanges(response.has_changes);
      onValidationComplete?.(response);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "No pudimos validar la disponibilidad de tu carrito.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [cart, onValidationComplete]);

  useEffect(() => {
    void revalidate();
  }, [revalidate]);

  if (cart.length === 0) return null;

  return (
    <div
      className="cart-validator"
      style={{
        margin: "16px 0",
        padding: "14px",
        borderRadius: "8px",
        border: hasChanges ? "1px solid #fde68a" : "1px solid #bbf7d0",
        backgroundColor: hasChanges ? "#fffbeb" : "#f0fdf4",
        fontSize: "13px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: results.length > 0 ? "8px" : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {loading ? (
            <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
          ) : hasChanges ? (
            <AlertTriangle size={18} color="#b45309" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} color="#16a34a" aria-hidden="true" />
          )}
          <span style={{ fontWeight: 600, color: hasChanges ? "#92400e" : "#166534" }}>
            {loading
              ? "Revalidando disponibilidad y precios..."
              : hasChanges
                ? "Atención: Tu carrito presenta cambios de inventario o precio"
                : "Disponibilidad y precios confirmados con la tienda"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void revalidate()}
          disabled={disabled || loading}
          style={{
            background: "none",
            border: "none",
            color: "#2563eb",
            cursor: "pointer",
            fontSize: "12px",
            textDecoration: "underline",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          aria-label="Revalidar carrito ahora"
        >
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      {error && (
        <p role="alert" className="error-message" style={{ margin: "4px 0" }}>
          {error}
        </p>
      )}

      {hasChanges && (
        <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px", color: "#78350f" }}>
          {results
            .filter((r) => r.status !== "ok")
            .map((item) => (
              <li key={item.variant_id} style={{ marginBottom: "4px" }}>
                <strong>
                  {item.product_name || `Variante #${item.variant_id}`}
                  {item.variant_name ? ` (${item.variant_name})` : ""}:
                </strong>{" "}
                {item.status === "price_changed" && (
                  <span>
                    El precio se actualizó a {item.current_price ? cop(item.current_price) : ""}.
                  </span>
                )}
                {item.status === "out_of_stock" && (
                  <span style={{ color: "#dc2626", fontWeight: 500 }}>
                    Agotado temporalmente. Debes retirarlo para continuar.
                  </span>
                )}
                {item.status === "insufficient_stock" && (
                  <span>
                    Solo quedan {item.available_qty} unidad(es) disponibles.
                  </span>
                )}
                {item.status === "inactive" && (
                  <span style={{ color: "#dc2626" }}>
                    Este producto ya no está a la venta.
                  </span>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

