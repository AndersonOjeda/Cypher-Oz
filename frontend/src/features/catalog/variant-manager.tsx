"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useEditorNavigation } from "./use-editor-navigation";
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
  const { editorRef, showEditor } = useEditorNavigation();
  const [editing, setEditing] = useState<Variant>();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const variants = useResource<Page<Variant>>(
    `/admin/products/${product.id}/variants/?page=${page}`,
    revision,
  );
  const attributes = useResource<CategoryAttribute[]>(
    `/admin/categories/${product.category}/attributes/`,
    attributeRevision,
  );

  function reset() {
    setEditorOpen(true);
    setEditing(undefined);
    setForm(blank);
    setError("");
    setMessage("");
    setInitialStock("");
  }
  async function edit(id: number) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const variant = await api<Variant>(`/admin/variants/${id}/`);
      setEditing(variant);
      setEditorOpen(true);
      showEditor();
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
            ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
            ...(!editing ? { initial_stock: Number(initialStock) } : {}),
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
      setMessage(
        "Presentación guardada. Puedes cambiar sus datos o añadir otra diferente.",
      );
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
      <div className="variant-guide">
        <h3>¿Qué es una variante?</h3>
        <p>
          Es una presentación de <strong>{product.name}</strong> que el cliente
          puede elegir, como un color, tamaño o capacidad. Cada presentación
          tiene su propio precio y sus propias unidades.
        </p>
        <p>
          <strong>¿Solo vendes una versión?</strong> Usa «Estándar». Pulsa
          «Cambiar nombre o precio» para modificarla; no necesitas crear otra.
        </p>
        <p>
          <strong>¿Vendes varias versiones?</strong> Añade una por cada
          combinación. Por ejemplo: «Negro · 128 GB» y «Azul · 256 GB».
        </p>
      </div>
      {!product.catalog_visible && (
        <p className="catalog-availability" role="status">
          Estas presentaciones se mostrarán cuando el producto, su categoría y
          su marca estén activos.
        </p>
      )}
      <Feedback error={error} message={message} />
      <div
        className={
          editorOpen || variants.data?.count === 0
            ? "catalog-columns"
            : undefined
        }
      >
        <div>
          <h3 className="variant-subheading">Presentaciones guardadas</h3>
          <p className="catalog-help">
            Edita una existente o añade una diferente. Ocultarla conserva sus
            datos y existencias.
          </p>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => {
              reset();
              showEditor();
            }}
          >
            Añadir otra presentación
          </button>
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
                      <small>Código interno: {variant.sku}</small>
                      <span className="catalog-price">
                        {money.format(Number(variant.price))}
                      </span>
                      <span
                        className={`catalog-badge ${variant.is_active ? "active" : ""}`}
                      >
                        {variant.is_active ? "Visible" : "Oculta"}
                      </span>
                      <small>
                        {variant.stock === undefined
                          ? "Consulta las unidades en Inventario."
                          : variant.stock > 0
                            ? `${variant.stock} unidades disponibles`
                            : "Agotada: sin unidades disponibles"}
                      </small>
                      {variant.attributes.map((attribute) => (
                        <small key={attribute.attribute}>
                          {attribute.name}: {attribute.value}
                        </small>
                      ))}
                    </div>
                    <div className="catalog-actions">
                      <button
                        disabled={busy}
                        aria-label={`Cambiar nombre o precio de ${variant.name}`}
                        onClick={() => edit(variant.id)}
                      >
                        Cambiar nombre o precio
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`${variant.is_active ? "Ocultar" : "Mostrar"} presentación ${variant.name}`}
                        onClick={() => toggle(variant)}
                      >
                        {variant.is_active ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {!variants.data.count && (
                <p className="catalog-empty">
                  Aún no hay presentaciones. Completa el formulario con
                  «Estándar», su precio y las unidades que tienes para vender.
                </p>
              )}
              <Pager page={page} data={variants.data} onChange={setPage} />
            </>
          )}
        </div>
        {(editorOpen || variants.data?.count === 0) && (
          <form onSubmit={save}>
            <fieldset disabled={busy || attributes.loading || !attributes.data}>
              <legend>
                <h3
                  ref={editorRef}
                  tabIndex={-1}
                  className="catalog-editor-heading"
                >
                  {editing
                    ? `Editar presentación: ${editing.name}`
                    : "Añadir una presentación"}
                </h3>
              </legend>
              <div className="field">
                <label htmlFor="variant-name">Nombre de la presentación</label>
                <input
                  id="variant-name"
                  required
                  maxLength={120}
                  placeholder="Ejemplo: Negro · 128 GB"
                  aria-describedby="variant-name-help"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
                <small id="variant-name-help">
                  Este nombre lo verá el cliente al comprar. Deja «Estándar» si
                  solo hay una versión.
                </small>
              </div>
              <details className="product-extra">
                <summary>Código interno (opcional)</summary>
                <div className="field">
                  <label htmlFor="variant-sku">SKU</label>
                  <input
                    id="variant-sku"
                    maxLength={80}
                    value={form.sku}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        sku: event.target.value.toUpperCase(),
                      })
                    }
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <small>
                    Se genera automáticamente si lo dejas vacío. Cámbialo solo
                    si ya utilizas tus propios códigos de inventario.
                  </small>
                </div>
              </details>
              <div className="field">
                <label htmlFor="variant-price">Precio de venta (COP)</label>
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
                <small>
                  Precio por unidad de esta presentación. Escribe pesos sin
                  puntos de miles, por ejemplo: 150000.
                </small>
              </div>
              {!editing ? (
                <div className="field">
                  <label htmlFor="variant-stock">Unidades disponibles</label>
                  <input
                    id="variant-stock"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="2147483647"
                    step="1"
                    required
                    value={initialStock}
                    onChange={(event) => setInitialStock(event.target.value)}
                    aria-describedby="variant-stock-help"
                  />
                  <small id="variant-stock-help">
                    Unidades de esta presentación, no de todo el producto. Con 0
                    aparecerá agotada.
                  </small>
                </div>
              ) : (
                <p className="catalog-help">
                  {editing.stock !== undefined
                    ? `Existencias actuales: ${editing.stock} unidades. `
                    : ""}
                  <Link href="/admin/inventario">
                    Añadir o ajustar unidades en Inventario →
                  </Link>
                </p>
              )}
              {Boolean(attributes.data?.length) && (
                <details className="product-extra">
                  <summary>Características adicionales (opcional)</summary>
                  <p className="catalog-help">
                    Añade detalles para comparar presentaciones. Por ejemplo:
                    Color = Negro. El nombre de arriba es suficiente para
                    empezar.
                  </p>
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
                </details>
              )}
              <label className="catalog-check">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) =>
                    setForm({ ...form, is_active: event.target.checked })
                  }
                />
                Mostrar esta presentación al cliente
              </label>
              <p className="catalog-help">
                Para poder comprarla, el producto debe estar activo y esta
                presentación debe tener unidades disponibles.
              </p>
              <div className="catalog-actions">
                <button className="primary">
                  {busy
                    ? "Guardando presentación…"
                    : editing
                      ? "Guardar cambios"
                      : "Guardar presentación"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    if (editing && variants.data?.count) setEditorOpen(false);
                  }}
                >
                  {editing ? "Cancelar edición" : "Limpiar formulario"}
                </button>
              </div>
            </fieldset>
          </form>
        )}
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
      <p className="catalog-help">
        Opciones avanzadas: la configuración de abajo define características
        compartidas por toda la categoría. No necesitas modificarla para
        registrar una presentación.
      </p>
      <CategoryAttributes
        categoryId={product.category}
        attributes={attributes.data ?? []}
        loading={attributes.loading || Boolean(attributes.error)}
        onChange={() => setAttributeRevision((value) => value + 1)}
      />
    </section>
  );
}
