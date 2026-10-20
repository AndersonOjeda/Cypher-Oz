"use client";

import { useEffect, useState, useCallback, useSyncExternalStore, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addToComparison,
  clearComparison,
  getComparisonItems,
  isInComparison,
  removeFromComparison,
  type ComparisonItem,
} from "./comparison-storage";
import { cop } from "@/features/orders/types";

function subscribeComparison(onChange: () => void) {
  window.addEventListener("comparison-updated", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("comparison-updated", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export interface ComparisonProduct {
  id: number;
  name: string;
  slug: string;
  category: { id: number; name: string; slug: string };
  brand: { id: number; name: string; slug: string };
  image_url: string | null;
  description: string;
  warranty: string;
  min_price: string;
  max_price: string;
  promotional_min_price: string | null;
  has_promotion: boolean;
  total_stock: number;
  is_available: boolean;
  attributes: Record<string, { name: string; value: string }>;
}

export interface ComparisonResponse {
  category: { id: number; name: string; slug: string };
  attributes: { code: string; name: string }[];
  products: ComparisonProduct[];
}

/**
 * Button to toggle a product into/out of comparison list.
 */
export function CompareButton({
  item,
  className = "",
}: {
  item: ComparisonItem;
  className?: string;
}) {
  const selected = useSyncExternalStore(subscribeComparison, () => isInComparison(item.id), () => false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selected) {
      removeFromComparison(item.id);
    } else {
      const res = addToComparison(item);
      if (!res.success) {
        setFeedback(res.error || "No se pudo agregar");
        setTimeout(() => setFeedback(null), 3500);
      }
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={selected}
        title={selected ? "Quitar de la comparación" : "Agregar a la comparación (máx 4 de la misma categoría)"}
        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded transition font-medium border ${
          selected
            ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-blue-600"
        } ${className}`}
      >
        <span>{selected ? "✓" : "⚖️"}</span>
        <span>{selected ? "En comparación" : "Comparar"}</span>
      </button>

      {feedback && (
        <div
          role="alert"
          className="absolute bottom-full mb-1 left-0 z-50 whitespace-nowrap bg-red-600 text-white text-xs px-2.5 py-1 rounded shadow-lg"
        >
          {feedback}
        </div>
      )}
    </div>
  );
}

/**
 * Floating bar showing selected products and quick link to /comparar.
 */
export function ComparisonFloatingBar() {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribeComparison, () => JSON.stringify(getComparisonItems()), () => "[]");
  const items: ComparisonItem[] = useMemo(() => JSON.parse(snapshot), [snapshot]);

  if (items.length === 0) return null;

  const canCompare = items.length >= 2;

  const handleGoCompare = () => {
    const ids = items.map((i) => i.id).join(",");
    router.push(`/comparar?ids=${ids}`);
  };

  return (
    <aside
      aria-label="Barra de comparación de productos"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 text-white backdrop-blur px-4 py-3 rounded-xl shadow-2xl flex flex-wrap items-center gap-4 max-w-2xl w-[94vw] border border-gray-700"
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-sm">⚖️ Comparar ({items.length}/4)</span>
        <span className="text-gray-400 hidden sm:inline">
          {items[0]?.category_name ? `(${items[0].category_name})` : ""}
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto flex-1 py-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs shrink-0"
          >
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.name}
                width={20}
                height={20}
                unoptimized
                className="w-5 h-5 rounded object-cover"
              />
            ) : (
              <span className="w-5 h-5 bg-gray-700 rounded flex items-center justify-center text-[10px]">📦</span>
            )}
            <span className="max-w-[100px] truncate">{item.name}</span>
            <button
              type="button"
              onClick={() => removeFromComparison(item.id)}
              className="text-gray-400 hover:text-red-400 ml-1 font-bold"
              aria-label={`Quitar ${item.name}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs shrink-0">
        <button
          type="button"
          onClick={handleGoCompare}
          disabled={!canCompare}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-3.5 py-1.5 rounded transition"
        >
          {canCompare ? `Comparar (${items.length})` : "Elige al menos 2"}
        </button>
        <button
          type="button"
          onClick={() => clearComparison()}
          className="text-gray-400 hover:text-white underline text-xs"
        >
          Limpiar
        </button>
      </div>
    </aside>
  );
}

/**
 * Full page comparison matrix component for /comparar.
 */
export function ProductComparisonView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams?.get("ids") ?? "";
  const slugsParam = searchParams?.get("slugs") ?? "";

  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);

    let query = idsParam ? `ids=${encodeURIComponent(idsParam)}` : "";
    if (!query && slugsParam) {
      query = `slugs=${encodeURIComponent(slugsParam)}`;
    }

    // Fallback to storage if no query in URL
    if (!query) {
      const stored = getComparisonItems();
      if (stored.length >= 2) {
        query = `ids=${stored.map((i) => i.id).join(",")}`;
      } else {
        setLoading(false);
        setError("Debes seleccionar al menos 2 productos para comparar.");
        return;
      }
    }

    try {
      const res = await fetch(`/api/v1/products/compare/?${query}`, { signal });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || "Error al comparar productos.");
      }
      if (!signal.aborted) setData(json);
    } catch (err: unknown) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [idsParam, slugsParam]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => { if (!controller.signal.aborted) void fetchComparison(controller.signal); });
    return () => controller.abort();
  }, [fetchComparison]);

  const handleRemoveProduct = (productId: number) => {
    removeFromComparison(productId);
    if (!data) return;
    const remaining = data.products.filter((p) => p.id !== productId);
    if (remaining.length < 2) {
      setData(null);
      setError("Debes seleccionar al menos 2 productos para comparar.");
      router.push("/catalogo");
    } else {
      setData({
        ...data,
        products: remaining,
      });
      router.replace(`/comparar?ids=${remaining.map((p) => p.id).join(",")}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Comparador de Productos
          </h1>
          <p className="text-sm text-gray-500">
            {data?.category
              ? `Comparando ${data.products.length} productos en la categoría ${data.category.name}`
              : "Compara especificaciones técnicas, precio y disponibilidad"}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/catalogo"
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded font-medium transition"
          >
            ← Volver al catálogo
          </Link>
          {data && (
            <button
              onClick={() => {
                clearComparison();
                router.push("/catalogo");
              }}
              className="text-xs text-red-600 hover:text-red-700 px-3 py-2 rounded font-medium"
            >
              Limpiar comparación
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500" role="status">
          Cargando matriz comparativa...
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm space-y-3">
          <p className="font-semibold">{error}</p>
          <p className="text-xs text-amber-800">
            Puedes explorar el catálogo y marcar hasta 4 productos de la misma categoría haciendo clic en el botón <strong>Comparar</strong>.
          </p>
          <Link
            href="/catalogo"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded font-medium transition"
          >
            Explorar catálogo
          </Link>
        </div>
      )}

      {/* Comparison Matrix Table */}
      {data && data.products.length >= 2 && !loading && !error && (
        <div className="overflow-x-auto bg-white border rounded-xl shadow-sm">
          <table className="w-full border-collapse text-sm text-left">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th scope="col" className="p-4 w-48 min-w-[180px] font-semibold text-gray-600 uppercase text-xs tracking-wider">
                  Característica
                </th>
                {data.products.map((p) => (
                  <th key={p.id} scope="col" className="p-4 min-w-[240px] max-w-[300px] align-top border-l">
                    <div className="space-y-3 text-center">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(p.id)}
                          className="text-gray-400 hover:text-red-500 text-xs font-bold"
                          title="Quitar de la comparación"
                          aria-label={`Quitar ${p.name}`}
                        >
                          ✕ Quitar
                        </button>
                      </div>

                      <div className="w-36 h-36 mx-auto bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            width={140}
                            height={140}
                            unoptimized
                            className="object-contain w-full h-full"
                          />
                        ) : (
                          <span className="text-3xl text-gray-300">📦</span>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-blue-600 font-semibold">{p.brand.name}</p>
                        <h2 className="font-bold text-gray-900 text-sm leading-tight hover:text-blue-600">
                          <Link href={`/catalogo/${p.slug}`}>{p.name}</Link>
                        </h2>
                      </div>

                      {/* Price */}
                      <div>
                        {p.has_promotion && p.promotional_min_price ? (
                          <div className="space-y-0.5">
                            <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">¡Oferta!</span>
                            <p className="text-lg font-extrabold text-red-600">
                              {cop(p.promotional_min_price)}
                            </p>
                            <p className="text-xs text-gray-400 line-through">
                              {cop(p.min_price)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-gray-900">
                            {cop(p.min_price)}
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/catalogo/${p.slug}`}
                        className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 rounded transition"
                      >
                        Ver producto
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y text-xs">
              {/* Row: Disponibilidad */}
              <tr className="hover:bg-gray-50/50">
                <th scope="row" className="p-3.5 font-semibold text-gray-700 bg-gray-50/60">
                  Disponibilidad
                </th>
                {data.products.map((p) => (
                  <td key={p.id} className="p-3.5 border-l">
                    {p.is_available ? (
                      <span className="text-emerald-700 font-semibold">
                        ✓ En stock ({p.total_stock} disponibles)
                      </span>
                    ) : (
                      <span className="text-red-600 font-semibold">✕ Agotado</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Row: Marca */}
              <tr className="hover:bg-gray-50/50">
                <th scope="row" className="p-3.5 font-semibold text-gray-700 bg-gray-50/60">
                  Marca
                </th>
                {data.products.map((p) => (
                  <td key={p.id} className="p-3.5 border-l font-medium">
                    {p.brand.name}
                  </td>
                ))}
              </tr>

              {/* Row: Garantía */}
              <tr className="hover:bg-gray-50/50">
                <th scope="row" className="p-3.5 font-semibold text-gray-700 bg-gray-50/60">
                  Garantía
                </th>
                {data.products.map((p) => (
                  <td key={p.id} className="p-3.5 border-l text-gray-700">
                    {p.warranty || "Garantía estándar del fabricante"}
                  </td>
                ))}
              </tr>

              {/* Section Header: Especificaciones Técnicas */}
              {data.attributes.length > 0 && (
                <tr className="bg-gray-100 font-bold text-gray-800">
                  <td colSpan={data.products.length + 1} className="p-3 uppercase text-[11px] tracking-wider">
                    Especificaciones Técnicas — {data.category.name}
                  </td>
                </tr>
              )}

              {/* Dynamic Attribute Rows */}
              {data.attributes.map((attr) => (
                <tr key={attr.code} className="hover:bg-gray-50/50">
                  <th scope="row" className="p-3.5 font-semibold text-gray-700 bg-gray-50/60">
                    {attr.name}
                  </th>
                  {data.products.map((p) => {
                    const val = p.attributes[attr.code]?.value || "N/A";
                    return (
                      <td key={p.id} className="p-3.5 border-l text-gray-800">
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Row: Descripción */}
              <tr className="hover:bg-gray-50/50">
                <th scope="row" className="p-3.5 font-semibold text-gray-700 bg-gray-50/60">
                  Descripción
                </th>
                {data.products.map((p) => (
                  <td key={p.id} className="p-3.5 border-l text-gray-600 line-clamp-3">
                    {p.description}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
