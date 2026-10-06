"use client";

import { FormEvent, useState } from "react";
import { api } from "@/services/api";
import { CategoryAttributes } from "./category-attributes";
import { errorText, Feedback, Pager, useResource } from "./shared";
import type { CategoryAttribute, Page, Product, Variant } from "./types";

const blank = {
  name: "Estándar",
  sku: "",
  price: "",
  is_active: true,
  values: {} as Record<number, string>,
};
const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function variantForm(variant: Variant) {
  return {
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    is_active: variant.is_active,
    values: Object.fromEntries(
      variant.attributes.map((item) => [item.attribute, item.value]),
    ),
  };
}

export function VariantManager({
  product,
  onChange,
}: {
  product: Product;
  onChange: (productId: number) => void;
}) {
  const [revision, setRevision] = useState(0);
  const [attributeRevision, setAttributeRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Variant>();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const variants = useResource<Page<Variant>>(
    `/admin/products/${product.id}/variants/?page=${page}`,
    revision,
  );
  const attributes = useResource<CategoryAttribute[]>(
    `/admin/categories/${product.category}/attributes/`,
    attributeRevision,
  );

  function reset() {
    setEditing(undefined);
    setForm(blank);
    setError("");
    setMessage("");
  }
  async function edit(id: number) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const variant = await api<Variant>(`/admin/variants/${id}/`);
      setEditing(variant);
      setForm(variantForm(variant));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const variant = await api<Variant>(
        editing
          ? `/admin/variants/${editing.id}/`
          : `/admin/products/${product.id}/variants/`,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            name: form.name,
            sku: form.sku,
            price: form.price,
            is_active: form.is_active,
            attributes: (attributes.data ?? [])
              .filter((item) => form.values[item.id]?.trim())
              .map((item) => ({
                attribute: item.id,
                value: form.values[item.id].trim(),
              })),
          }),
        },
      );
      setEditing(variant);
      setForm(variantForm(variant));
      setRevision((value) => value + 1);
      onChange(product.id);
      setMessage("Variante guardada.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(variant: Variant) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await api<Variant>(`/admin/variants/${variant.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !variant.is_active }),
      });
      if (editing?.id === saved.id) {
        setEditing(saved);
        setForm((current) => ({ ...current, is_active: saved.is_active }));
      }
      setRevision((value) => value + 1);
      onChange(product.id);
      setMessage(
        saved.is_active ? "Variante activada." : "Variante desactivada.",
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="catalog-panel catalog-variants"
      aria-labelledby="variants-heading"
    >
      <h2 id="variants-heading">Variantes del producto</h2>
      <p className="catalog-help">
        {product.name} · {product.category_name}. Cada variante tiene su propio
        SKU y precio. Usa «Estándar» si el producto no tiene opciones.
      </p>
      <p
        className={`catalog-availability ${product.catalog_available ? "available" : ""}`}
        role="status"
      >
        {product.catalog_available
          ? "Disponible en catálogo: tiene al menos una variante activa."
          : "No disponible en catálogo: activa el producto, su categoría, su marca y al menos una variante."}
      </p>
      <Feedback error={error} message={message} />
      <div className="catalog-columns">
        <div>
          {variants.loading && <p role="status">Cargando variantes…</p>}
          {variants.error && (
            <p role="alert" className="error-message">
              {variants.error}{" "}
              <button onClick={() => setRevision((value) => value + 1)}>
                Reintentar variantes
              </button>
            </p>
          )}
          {variants.data && (
            <>
              <ul className="catalog-list">
                {variants.data.results.map((variant) => (
                  <li key={variant.id}>
                    <div>
                      <strong>{variant.name}</strong>
                      <small>SKU: {variant.sku}</small>
                      <span className="catalog-price">
                        {money.format(Number(variant.price))}
                      </span>
                      <span
                        className={`catalog-badge ${variant.is_active ? "active" : ""}`}
                      >
                        {variant.is_active ? "Activa" : "Inactiva"}
                      </span>
                      {variant.attributes.map((attribute) => (
                        <small key={attribute.attribute}>
                          {attribute.name}: {attribute.value}
                        </small>
                      ))}
                    </div>
                    <div className="catalog-actions">
                      <button
                        disabled={busy}
                        aria-label={`Editar variante ${variant.sku}`}
                        onClick={() => edit(variant.id)}
                      >
                        Editar variante
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`${variant.is_active ? "Desactivar" : "Activar"} variante ${variant.sku}`}
                        onClick={() => toggle(variant)}
                      >
                        {variant.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {!variants.data.count && (
                <p className="catalog-empty">
                  Este producto aún no tiene variantes.
                </p>
              )}
              <Pager page={page} data={variants.data} onChange={setPage} />
            </>
          )}
        </div>
        <form onSubmit={save}>
          <fieldset disabled={busy || attributes.loading || !attributes.data}>
            <legend>{editing ? "Editar variante" : "Nueva variante"}</legend>
            <div className="field">
              <label htmlFor="variant-name">Nombre de la variante</label>
              <input
                id="variant-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="variant-sku">SKU</label>
              <input
                id="variant-sku"
                required
                maxLength={80}
                value={form.sku}
                onChange={(event) =>
                  setForm({ ...form, sku: event.target.value.toUpperCase() })
                }
                autoCapitalize="characters"
                spellCheck={false}
              />
              <small>
                Identificador único de la variante en todo el catálogo.
              </small>
            </div>
            <div className="field">
              <label htmlFor="variant-price">Precio (COP)</label>
              <input
                id="variant-price"
                type="number"
                inputMode="decimal"
                min="0"
                max="9999999999.99"
                step="0.01"
                required
                value={form.price}
                onChange={(event) =>
                  setForm({ ...form, price: event.target.value })
                }
              />
              <small>Pesos colombianos, hasta dos decimales.</small>
            </div>
            {attributes.data?.map((attribute) => (
              <div className="field" key={attribute.id}>
                <label htmlFor={`variant-attribute-${attribute.id}`}>
                  {attribute.name} (opcional)
                </label>
                <input
                  id={`variant-attribute-${attribute.id}`}
                  maxLength={500}
                  value={form.values[attribute.id] ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      values: {
                        ...form.values,
                        [attribute.id]: event.target.value,
                      },
                    })
                  }
                />
              </div>
            ))}
            <label className="catalog-check">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  setForm({ ...form, is_active: event.target.checked })
                }
              />
              Variante activa
            </label>
            <div className="catalog-actions">
              <button className="primary">
                {busy ? "Guardando variante…" : "Guardar variante"}
              </button>
              <button type="button" onClick={reset}>
                {editing ? "Nueva variante" : "Limpiar variante"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
      {attributes.loading && <p role="status">Cargando atributos…</p>}
      {attributes.error && (
        <p role="alert" className="error-message">
          {attributes.error}{" "}
          <button onClick={() => setAttributeRevision((value) => value + 1)}>
            Reintentar atributos
          </button>
        </p>
      )}
      <CategoryAttributes
        categoryId={product.category}
        attributes={attributes.data ?? []}
        loading={attributes.loading || Boolean(attributes.error)}
        onChange={() => setAttributeRevision((value) => value + 1)}
      />
    </section>
  );
}
