"use client";

import { FormEvent, useEffect, useState } from "react";
import { useEditorNavigation } from "./use-editor-navigation";
import { api } from "@/services/api";
import { errorText, Feedback, Pager, useResource } from "./shared";
import type { Page, Promotion } from "./types";

type VariantOption = {
  id: number;
  product_name: string;
  name: string;
  sku: string;
  price: string;
};

const blank = {
  name: "",
  starts_at: "",
  ends_at: "",
  is_active: false,
  prices: [] as { variant: number; price: string }[],
};

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

function toLocalDatetimeInput(isoString: string): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PromotionManager() {
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const { editorRef, showEditor } = useEditorNavigation();
  const [editing, setEditing] = useState<Promotion>();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [availableVariants, setAvailableVariants] = useState<VariantOption[]>(
    [],
  );
  const [selectedVariantId, setSelectedVariantId] = useState<number | "">("");
  const [promoPriceInput, setPromoPriceInput] = useState("");

  const resource = useResource<Page<Promotion>>(
    `/admin/promotions/?page=${page}&search=${encodeURIComponent(search)}`,
    revision,
  );

  useEffect(() => {
    let active = true;
    api<Page<VariantOption>>("/purchase/variants/?page_size=100")
      .then((data) => {
        if (active && data?.results) {
          setAvailableVariants(data.results);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function reset() {
    setEditing(undefined);
    setForm(blank);
    setError("");
    setMessage("");
    setSelectedVariantId("");
    setPromoPriceInput("");
  }

  function edit(item: Promotion) {
    setEditing(item);
    showEditor();
    setError("");
    setMessage("");
    setForm({
      name: item.name,
      starts_at: toLocalDatetimeInput(item.starts_at),
      ends_at: toLocalDatetimeInput(item.ends_at),
      is_active: item.is_active,
      prices: item.prices.map((p) => ({
        variant: p.variant,
        price: p.price,
      })),
    });
  }

  function addVariantToPromo() {
    if (!selectedVariantId || !promoPriceInput) return;
    const v = availableVariants.find((x) => x.id === Number(selectedVariantId));
    if (!v) return;

    const numPrice = Number(promoPriceInput);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError("Ingresa un precio promocional válido mayor a cero.");
      return;
    }
    if (numPrice >= Number(v.price)) {
      setError(
        `El precio promocional (${money.format(numPrice)}) debe ser menor al precio base (${money.format(Number(v.price))}).`,
      );
      return;
    }

    if (form.prices.some((p) => p.variant === v.id)) {
      setError(`La variante ${v.sku} ya está en la lista.`);
      return;
    }

    setError("");
    setForm((prev) => ({
      ...prev,
      prices: [...prev.prices, { variant: v.id, price: String(numPrice) }],
    }));
    setSelectedVariantId("");
    setPromoPriceInput("");
  }

  function removeVariantFromPromo(variantId: number) {
    setForm((prev) => ({
      ...prev,
      prices: prev.prices.filter((p) => p.variant !== variantId),
    }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    if (new Date(form.starts_at) >= new Date(form.ends_at)) {
      setError("La fecha de fin debe ser posterior a la fecha de inicio.");
      setBusy(false);
      return;
    }

    try {
      const payload = {
        name: form.name.trim(),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        is_active: form.is_active,
        prices: form.prices,
      };

      const result = await api<Promotion>(
        `/admin/promotions/${editing ? `${editing.id}/` : ""}`,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setRevision((v) => v + 1);
      setEditing(result);
      setMessage(editing ? "Promoción actualizada." : "Promoción creada.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Promotion) {
    if (!window.confirm(`¿Eliminar la promoción «${item.name}»?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/admin/promotions/${item.id}/`, { method: "DELETE" });
      reset();
      setPage(1);
      setRevision((v) => v + 1);
      setMessage("Promoción eliminada.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="catalog-columns">
      <section className="catalog-panel">
        <h2>Promociones</h2>
        <form
          className="catalog-search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(query);
          }}
        >
          <label className="sr-only" htmlFor="promo-search">
            Buscar promociones
          </label>
          <input
            id="promo-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre"
          />
          <button type="submit">Buscar</button>
        </form>

        {resource.loading && <p role="status">Cargando promociones…</p>}
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
              {resource.data.results.map((item) => {
                const now = new Date();
                const start = new Date(item.starts_at);
                const end = new Date(item.ends_at);
                const isCurrent = item.is_active && start <= now && now < end;

                return (
                  <li key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span
                        className={`catalog-badge ${item.is_active ? "active" : ""}`}
                      >
                        {item.is_active ? "Activa" : "Inactiva"}
                      </span>
                      {isCurrent && (
                        <span className="catalog-badge active">Vigente</span>
                      )}
                      <small>
                        Inicio: {start.toLocaleString("es-CO")} · Fin:{" "}
                        {end.toLocaleString("es-CO")}
                      </small>
                      <small>
                        {item.prices.length} variante(s) con descuento
                      </small>
                    </div>
                    <div className="catalog-actions">
                      <button
                        disabled={busy}
                        aria-label={`Editar ${item.name}`}
                        onClick={() => edit(item)}
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
                );
              })}
            </ul>
            {!resource.data.count && (
              <p className="catalog-empty">No hay promociones registradas.</p>
            )}
            <Pager page={page} data={resource.data} onChange={setPage} />
          </>
        )}
      </section>

      <section className="catalog-panel">
        <h2 ref={editorRef} tabIndex={-1} className="catalog-editor-heading">
          {editing ? `Editar promoción: ${editing.name}` : "Nueva promoción"}
        </h2>
        <Feedback error={error} message={message} />
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <div className="field">
              <label htmlFor="promo-name">Nombre de la promoción</label>
              <input
                id="promo-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Black Friday, Oferta de Verano"
              />
            </div>

            <div className="catalog-form-row">
              <div className="field">
                <label htmlFor="promo-start">Fecha de inicio</label>
                <input
                  id="promo-start"
                  type="datetime-local"
                  required
                  value={form.starts_at}
                  onChange={(e) =>
                    setForm({ ...form, starts_at: e.target.value })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="promo-end">Fecha de finalización</label>
                <input
                  id="promo-end"
                  type="datetime-local"
                  required
                  value={form.ends_at}
                  onChange={(e) =>
                    setForm({ ...form, ends_at: e.target.value })
                  }
                />
              </div>
            </div>

            <label className="catalog-check">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              Promoción activa
            </label>

            <hr style={{ margin: "16px 0", borderColor: "#e2e8f0" }} />

            <h3>Variantes en oferta</h3>
            <p className="catalog-help">
              Selecciona variantes y define su precio de oferta (debe ser menor
              al precio base).
            </p>

            <div
              className="catalog-form-row"
              style={{ alignItems: "flex-end" }}
            >
              <div className="field" style={{ flex: 2 }}>
                <label htmlFor="promo-variant-select">Variante</label>
                <select
                  id="promo-variant-select"
                  value={selectedVariantId}
                  onChange={(e) =>
                    setSelectedVariantId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                >
                  <option value="">Selecciona una variante</option>
                  {availableVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.product_name} — {v.name} ({v.sku}) · Base:{" "}
                      {money.format(Number(v.price))}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="promo-variant-price">Precio Oferta (COP)</label>
                <input
                  id="promo-variant-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej. 85000"
                  value={promoPriceInput}
                  onChange={(e) => setPromoPriceInput(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="button"
                style={{ marginBottom: 4 }}
                onClick={addVariantToPromo}
              >
                + Añadir a oferta
              </button>
            </div>

            {form.prices.length > 0 ? (
              <ul className="catalog-list" style={{ marginTop: 12 }}>
                {form.prices.map((p) => {
                  const v = availableVariants.find((x) => x.id === p.variant);
                  return (
                    <li key={p.variant}>
                      <div>
                        <strong>
                          {v?.product_name ?? `Variante #${p.variant}`}
                        </strong>
                        <small>
                          {v?.name} · SKU: {v?.sku}
                        </small>
                        <span className="catalog-price">
                          Oferta: {money.format(Number(p.price))}
                        </span>
                        {v && (
                          <small style={{ textDecoration: "line-through" }}>
                            Base: {money.format(Number(v.price))}
                          </small>
                        )}
                      </div>
                      <div className="catalog-actions">
                        <button
                          type="button"
                          className="danger"
                          onClick={() => removeVariantFromPromo(p.variant)}
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="catalog-help" style={{ marginTop: 8 }}>
                Esta promoción aún no tiene variantes asignadas.
              </p>
            )}

            <div className="catalog-actions" style={{ marginTop: 20 }}>
              <button className="button primary" type="submit">
                {busy ? "Guardando…" : "Guardar promoción"}
              </button>
              <button type="button" onClick={reset}>
                {editing ? "Nueva promoción" : "Limpiar"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </div>
  );
}
