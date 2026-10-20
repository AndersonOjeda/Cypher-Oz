"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, MapPin, Store, Truck } from "lucide-react";
import { api, ApiError } from "@/services/api";
import { cop } from "./types";

export type DeliveryModeKey = "PICKUP" | "URBAN" | "SPECIAL";

export interface DeliveryQuoteResult {
  mode: DeliveryModeKey;
  cost: string | null;
  can_confirm: boolean;
  label: string;
  message: string;
  free_shipping_threshold: string;
  is_free?: boolean;
}

interface DeliverySelectorProps {
  subtotal: number;
  selectedMode: DeliveryModeKey;
  onModeChange: (mode: DeliveryModeKey, quote: DeliveryQuoteResult | null) => void;
  disabled?: boolean;
}

export function DeliverySelector({
  subtotal,
  selectedMode,
  onModeChange,
  disabled = false,
}: DeliverySelectorProps) {
  const [quote, setQuote] = useState<DeliveryQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = useCallback(
    async (mode: DeliveryModeKey) => {
      setLoading(true);
      setError(null);
      try {
        const result = await api<DeliveryQuoteResult>("/delivery/quote/", {
          method: "POST",
          body: JSON.stringify({ mode, subtotal }),
        });
        setQuote(result);
        onModeChange(mode, result);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Error al cotizar entrega.";
        setError(msg);
        setQuote(null);
        onModeChange(mode, null);
      } finally {
        setLoading(false);
      }
    },
    [subtotal, onModeChange],
  );

  useEffect(() => {
    void fetchQuote(selectedMode);
  }, [selectedMode, fetchQuote]);

  const options: { key: DeliveryModeKey; title: string; subtitle: string; icon: React.ReactNode }[] = [
    {
      key: "PICKUP",
      title: "Recogida en tienda",
      subtitle: "Centro de Pasto · Sin costo de envío",
      icon: <Store size={20} aria-hidden="true" />,
    },
    {
      key: "URBAN",
      title: "Domicilio urbano en Pasto",
      subtitle: "Tarifa plana · Gratis en compras desde $100.000 COP",
      icon: <Truck size={20} aria-hidden="true" />,
    },
    {
      key: "SPECIAL",
      title: "Zona especial / Corregimientos",
      subtitle: "Tarifa pendiente de cotización según cobertura",
      icon: <MapPin size={20} aria-hidden="true" />,
    },
  ];

  return (
    <fieldset className="delivery-selector" disabled={disabled} style={{ margin: "16px 0" }}>
      <legend style={{ fontWeight: 600, fontSize: "15px", marginBottom: "8px" }}>
        Modalidad y costo de entrega
      </legend>

      <div style={{ display: "grid", gap: "8px" }} role="radiogroup" aria-label="Modalidad de entrega">
        {options.map((opt) => {
          const isSelected = selectedMode === opt.key;
          return (
            <label
              key={opt.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                borderRadius: "8px",
                backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              <input
                type="radio"
                name="delivery_mode"
                value={opt.key}
                checked={isSelected}
                onChange={() => void fetchQuote(opt.key)}
                disabled={disabled}
                style={{ marginTop: "4px" }}
              />
              <div style={{ color: isSelected ? "#1d4ed8" : "#64748b", marginTop: "2px" }}>
                {opt.icon}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: "14px", display: "block" }}>
                  {opt.title}
                </span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{opt.subtitle}</span>
              </div>
            </label>
          );
        })}
      </div>

      {loading && (
        <p role="status" style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>
          Calculando costo de entrega...
        </p>
      )}

      {error && (
        <p role="alert" className="error-message" style={{ marginTop: "8px" }}>
          {error}
        </p>
      )}

      {quote && !loading && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            borderRadius: "6px",
            fontSize: "13px",
            backgroundColor: quote.can_confirm ? "#f0fdf4" : "#fffbeb",
            border: quote.can_confirm ? "1px solid #bbf7d0" : "1px solid #fde68a",
            color: quote.can_confirm ? "#166534" : "#92400e",
          }}
        >
          {quote.mode === "PICKUP" && (
            <p style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
              <CheckCircle2 size={16} /> <strong>Costo de entrega:</strong> Gratis (Recogida local en Pasto).
            </p>
          )}

          {quote.mode === "URBAN" && (
            <div>
              <p style={{ display: "flex", alignItems: "center", gap: "6px", margin: "0 0 4px 0" }}>
                <CheckCircle2 size={16} /> <strong>Costo de envío:</strong>{" "}
                {quote.is_free ? (
                  <span style={{ fontWeight: 600, color: "#16a34a" }}>¡Gratis! (supera el umbral)</span>
                ) : (
                  <span>{quote.cost ? cop(quote.cost) : "$ 5.000 COP"}</span>
                )}
              </p>
              {!quote.is_free && quote.free_shipping_threshold && (
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  * Envío gratis para compras superiores a {cop(quote.free_shipping_threshold)}.
                </span>
              )}
            </div>
          )}

          {quote.mode === "SPECIAL" && (
            <div>
              <p
                role="alert"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 600,
                  margin: "0 0 4px 0",
                  color: "#b45309",
                }}
              >
                <AlertTriangle size={16} /> Tarifa pendiente de confirmación
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#78350f" }}>
                {quote.message ||
                  "Para zonas especiales o fuera del área urbana de Pasto, el costo de entrega debe acordarse previamente. La confirmación del pedido quedará pausada hasta que se confirme la tarifa."}
              </p>
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}

