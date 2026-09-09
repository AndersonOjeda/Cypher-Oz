"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/services/api";
import type { Page, Taxonomy } from "./types";

export function errorText(error: unknown): string {
  if (
    error instanceof ApiError &&
    error.details &&
    typeof error.details === "object"
  ) {
    const fields: Record<string, string> = {
      name: "Nombre",
      slug: "Identificador",
      category: "Categoría",
      brand: "Marca",
      file: "Imagen",
      alt_text: "Descripción de imagen",
      description: "Descripción",
      warranty: "Garantía",
      sku: "SKU",
      price: "Precio",
      attributes: "Atributos",
      code: "Código",
      is_active: "Estado",
      attribute: "Atributo",
      value: "Valor",
    };
    function describe(value: unknown): string {
      if (Array.isArray(value)) return value.map(describe).join(" ");
      if (value && typeof value === "object")
        return Object.entries(value)
          .map(
            ([field, detail]) =>
              `${fields[field] ?? field}: ${describe(detail)}`,
          )
          .join(" · ");
      return String(value ?? "");
    }
    const details = Object.entries(error.details)
      .map(([field, value]) => `${fields[field] ?? field}: ${describe(value)}`)
      .join(" · ");
    if (details) return details;
  }
  return error instanceof Error
    ? error.message
    : "No pudimos guardar los cambios.";
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function useResource<T>(path: string, revision = 0) {
  const [state, setState] = useState<{
    data?: T;
    error: string;
    loading: boolean;
  }>({ error: "", loading: true });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    // Clear stale data before the next response can be used for editing.
    Promise.resolve().then(() => {
      if (active) setState({ error: "", loading: true });
    });
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (active) setState({ data, error: "", loading: false });
      })
      .catch((err) => {
        if (active) setState({ error: errorText(err), loading: false });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, revision]);
  return state;
}

export async function allTaxonomy(kind: "categories" | "brands") {
  const records: Taxonomy[] = [];
  let page = 1;
  while (true) {
    const response = await api<Page<Taxonomy>>(
      `/admin/${kind}/?page_size=100&page=${page}`,
    );
    records.push(...response.results);
    if (!response.next) return records;
    page++;
  }
}

export function Feedback({
  error,
  message,
}: {
  error: string;
  message: string;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="catalog-success">
          {message}
        </p>
      )}
    </>
  );
}

export function Pager({
  page,
  data,
  onChange,
}: {
  page: number;
  data: Page<unknown>;
  onChange: (page: number) => void;
}) {
  return (
    <div className="catalog-pager">
      <span>
        {data.count} registros · Página {page}
      </span>
      <button
        type="button"
        disabled={!data.previous}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </button>
      <button
        type="button"
        disabled={!data.next}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </button>
    </div>
  );
}
