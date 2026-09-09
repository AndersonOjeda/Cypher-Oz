"use client";

import { FormEvent, useState } from "react";
import { api } from "@/services/api";
import { errorText, Feedback, Pager, slugify, useResource } from "./shared";
import type { Page, Taxonomy } from "./types";

const blank = { name: "", slug: "", description: "", is_active: true };

export function TaxonomyManager({ kind }: { kind: "categories" | "brands" }) {
  const label = kind === "categories" ? "categoría" : "marca";
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<number>();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const resource = useResource<Page<Taxonomy>>(
    `/admin/${kind}/?page=${page}&search=${encodeURIComponent(search)}`,
    revision,
  );

  function reset() {
    setEditing(undefined);
    setForm(blank);
    setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/admin/${kind}/${editing ? `${editing}/` : ""}`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      reset();
      setRevision((v) => v + 1);
      setMessage("Cambios guardados.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Taxonomy) {
    if (
      !window.confirm(
        `¿Eliminar «${item.name}»? Solo se permite si no tiene productos asociados.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/admin/${kind}/${item.id}/`, { method: "DELETE" });
      reset();
      setPage(1);
      setRevision((v) => v + 1);
      setMessage("Registro eliminado.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="catalog-columns">
      <section className="catalog-panel">
        <h2>{kind === "categories" ? "Categorías" : "Marcas"}</h2>
        <form
          className="catalog-search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(query);
          }}
        >
          <label className="sr-only" htmlFor="taxonomy-search">
            Buscar por nombre
          </label>
          <input
            id="taxonomy-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre"
          />
          <button>Buscar</button>
        </form>
        {resource.loading && <p role="status">Cargando registros…</p>}
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
                    <small>{item.slug}</small>
                  </div>
                  <div className="catalog-actions">
                    <button
                      disabled={busy}
                      aria-label={`Editar ${item.name}`}
                      onClick={() => {
                        setEditing(item.id);
                        setForm({
                          name: item.name,
                          slug: item.slug,
                          description: item.description,
                          is_active: item.is_active,
                        });
                        setError("");
                        setMessage("");
                      }}
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
                No hay registros. Crea la primera {label} con el formulario.
              </p>
            )}
            <Pager page={page} data={resource.data} onChange={setPage} />
          </>
        )}
      </section>
      <section className="catalog-panel">
        <h2>
          {editing ? "Editar" : "Nueva"} {label}
        </h2>
        <p className="catalog-help">
          Al desactivarla, sus productos se ocultan del catálogo. Sus relaciones
          se conservan.
        </p>
        <Feedback error={error} message={message} />
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <div className="field">
              <label htmlFor="tax-name">Nombre</label>
              <input
                id="tax-name"
                required
                maxLength={120}
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
              <label htmlFor="tax-slug">Identificador</label>
              <input
                id="tax-slug"
                required
                maxLength={140}
                pattern="[a-z0-9_-]+"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
              <small>Único, sin espacios; por ejemplo: accesorios.</small>
            </div>
            <div className="field">
              <label htmlFor="tax-description">Descripción</label>
              <textarea
                id="tax-description"
                maxLength={3000}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
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
              Activo
            </label>
            <div className="catalog-actions">
              <button className="button primary">
                {busy ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" onClick={reset}>
                {editing ? "Cancelar edición" : "Limpiar"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
