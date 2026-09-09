"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/services/api";
import {
  allTaxonomy,
  errorText,
  Feedback,
  Pager,
  slugify,
  useResource,
} from "./shared";
import { ImageManager } from "./image-manager";
import type { Limits, Page, Product, Taxonomy } from "./types";

const blank = {
  name: "",
  slug: "",
  description: "",
  warranty: "",
  category: "",
  brand: "",
  is_active: false,
};

export function ProductManager() {
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [editing, setEditing] = useState<Product>();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [options, setOptions] = useState<{
    categories: Taxonomy[];
    brands: Taxonomy[];
    limits: Limits;
  }>();
  const resource = useResource<Page<Product>>(
    `/admin/products/?page=${page}&search=${encodeURIComponent(search)}${activeFilter ? `&active=${activeFilter}` : ""}`,
    revision,
  );
  useEffect(() => {
    let active = true;
    Promise.all([
      allTaxonomy("categories"),
      allTaxonomy("brands"),
      api<Limits>("/admin/catalog/limits/"),
    ])
      .then(([categories, brands, limits]) => {
        if (active) setOptions({ categories, brands, limits });
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      });
    return () => {
      active = false;
    };
  }, [revision]);

  function reset() {
    setEditing(undefined);
    setForm(blank);
    setError("");
  }
  async function edit(id: number) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const item = await api<Product>(`/admin/products/${id}/`);
      setEditing(item);
      setForm({
        name: item.name,
        slug: item.slug,
        description: item.description,
        warranty: item.warranty,
        category: String(item.category),
        brand: String(item.brand),
        is_active: item.is_active,
      });
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
      const product = await api<Product>(
        `/admin/products/${editing ? `${editing.id}/` : ""}`,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            ...form,
            category: Number(form.category),
            brand: Number(form.brand),
          }),
        },
      );
      setEditing(product);
      setRevision((v) => v + 1);
      setMessage("Producto guardado. Puedes gestionar sus imágenes abajo.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Product) {
    if (
      !window.confirm(
        `¿Eliminar «${item.name}»? Debe estar inactivo y sin imágenes ni otras relaciones.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/admin/products/${item.id}/`, { method: "DELETE" });
      reset();
      setPage(1);
      setRevision((v) => v + 1);
      setMessage("Producto eliminado.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="catalog-columns">
        <section className="catalog-panel">
          <h2>Productos</h2>
          <form
            className="catalog-search"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(query);
            }}
          >
            <label className="sr-only" htmlFor="product-search">
              Buscar productos
            </label>
            <input
              id="product-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos"
            />
            <button>Buscar</button>
          </form>
          <div className="field">
            <label htmlFor="product-filter">Filtrar por estado</label>
            <select
              id="product-filter"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          {resource.loading && <p role="status">Cargando productos…</p>}
          {resource.error && (
            <p role="alert" className="error-message">
              {resource.error}{" "}
              <button onClick={() => setRevision((v) => v + 1)}>
                Reintentar
              </button>
            </p>
          )}
          {resource.data && (
            <>
              <ul className="catalog-list">
                {resource.data.results.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span
                        className={`catalog-badge ${item.is_active ? "active" : ""}`}
                      >
                        {item.is_active ? "Activo" : "Inactivo"}
                      </span>
                      <small>
                        {item.category_name} · {item.brand_name}
                      </small>
                      {item.is_active && !item.catalog_visible && (
                        <small>Oculto: categoría o marca inactiva.</small>
                      )}
                    </div>
                    <div className="catalog-actions">
                      <button
                        disabled={busy}
                        aria-label={`Editar ${item.name}`}
                        onClick={() => edit(item.id)}
                      >
                        Editar
                      </button>
                      <button
                        disabled={busy}
                        className="danger"
                        aria-label={`Eliminar ${item.name}`}
                        onClick={() => remove(item)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {!resource.data.count && (
                <p className="catalog-empty">
                  No hay productos. Crea el primero con su categoría y marca.
                </p>
              )}
              <Pager page={page} data={resource.data} onChange={setPage} />
            </>
          )}
        </section>
        <section className="catalog-panel">
          <h2>{editing ? "Editar producto" : "Nuevo producto"}</h2>
          <Feedback error={error} message={message} />
          {!options && (
            <p role="status">
              Cargando categorías y marcas…{" "}
              <button onClick={() => setRevision((v) => v + 1)}>
                Reintentar
              </button>
            </p>
          )}
          {options &&
            (!options.categories.some((item) => item.is_active) ||
              !options.brands.some((item) => item.is_active)) && (
              <p className="catalog-help">
                Crea una categoría y una marca activas antes de guardar el
                producto.
              </p>
            )}
          <form onSubmit={save}>
            <fieldset disabled={busy || !options}>
              <div className="field">
                <label htmlFor="product-name">Nombre del producto</label>
                <input
                  id="product-name"
                  required
                  maxLength={180}
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm({
                      ...form,
                      name,
                      slug:
                        !editing && form.slug === slugify(form.name)
                          ? slugify(name)
                          : form.slug,
                    });
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="product-slug">Identificador del producto</label>
                <input
                  id="product-slug"
                  required
                  maxLength={200}
                  pattern="[a-z0-9_-]+"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div className="catalog-form-row">
                <div className="field">
                  <label htmlFor="product-category">Categoría</label>
                  <select
                    id="product-category"
                    required
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  >
                    <option value="">Selecciona una categoría</option>
                    {options?.categories.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={
                          !item.is_active && item.id !== editing?.category
                        }
                      >
                        {item.name}
                        {item.is_active ? "" : " (inactiva)"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="product-brand">Marca</label>
                  <select
                    id="product-brand"
                    required
                    value={form.brand}
                    onChange={(e) =>
                      setForm({ ...form, brand: e.target.value })
                    }
                  >
                    <option value="">Selecciona una marca</option>
                    {options?.brands.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={!item.is_active && item.id !== editing?.brand}
                      >
                        {item.name}
                        {item.is_active ? "" : " (inactiva)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="product-description">
                  Descripción del producto
                </label>
                <textarea
                  id="product-description"
                  required
                  maxLength={10000}
                  rows={4}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="product-warranty">Garantía</label>
                <textarea
                  id="product-warranty"
                  maxLength={1000}
                  value={form.warranty}
                  onChange={(e) =>
                    setForm({ ...form, warranty: e.target.value })
                  }
                />
              </div>
              <label className="catalog-check">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                Producto activo
              </label>
              <div className="catalog-actions">
                <button className="button primary">
                  {busy ? "Guardando…" : "Guardar producto"}
                </button>
                <button type="button" onClick={reset}>
                  {editing ? "Nuevo producto" : "Limpiar"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      </div>
      {editing && options && (
        <ImageManager
          key={editing.id}
          productId={editing.id}
          initialImages={editing.images}
          limits={options.limits}
        />
      )}
    </>
  );
}
