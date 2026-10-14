"use client";

import { FormEvent, useState } from "react";
import { api } from "@/services/api";
import { errorText, Feedback, slugify } from "./shared";
import type { CategoryAttribute } from "./types";

export function CategoryAttributes({
  categoryId,
  attributes,
  loading,
  onChange,
}: {
  categoryId: number;
  attributes: CategoryAttribute[];
  loading: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<number>();
  const [form, setForm] = useState({ code: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function reset() {
    setEditing(undefined);
    setForm({ code: "", name: "" });
    setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api<CategoryAttribute>(
        editing
          ? `/admin/attributes/${editing}/`
          : `/admin/categories/${categoryId}/attributes/`,
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) },
      );
      reset();
      onChange();
      setMessage("Atributo guardado.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="catalog-attributes">
      <summary>Atributos de la categoría</summary>
      <p className="catalog-help">
        Define características compartidas por los productos de esta categoría,
        como color o capacidad. Sus valores son opcionales en cada variante.
      </p>
      <Feedback error={error} message={message} />
      <div className="catalog-columns">
        <div>
          {!loading && !attributes.length && <p>No hay atributos definidos.</p>}
          <ul className="catalog-list">
            {attributes.map((attribute) => (
              <li key={attribute.id}>
                <div>
                  <strong>{attribute.name}</strong>
                  <small>{attribute.code}</small>
                </div>
                <button
                  type="button"
                  disabled={busy || loading}
                  aria-label={`Editar atributo ${attribute.name}`}
                  onClick={() => {
                    setEditing(attribute.id);
                    setForm({ name: attribute.name, code: attribute.code });
                    setError("");
                    setMessage("");
                  }}
                >
                  Editar atributo
                </button>
              </li>
            ))}
          </ul>
        </div>
        <form onSubmit={save}>
          <fieldset disabled={busy || loading}>
            <legend>{editing ? "Editar atributo" : "Nuevo atributo"}</legend>
            <div className="field">
              <label htmlFor="attribute-name">Nombre del atributo</label>
              <input
                id="attribute-name"
                required
                maxLength={120}
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm({
                    name,
                    code:
                      !editing && form.code === slugify(form.name)
                        ? slugify(name).slice(0, 80)
                        : form.code,
                  });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="attribute-code">Código del atributo</label>
              <input
                id="attribute-code"
                required
                maxLength={80}
                pattern={"[a-z0-9_\\-]+"}
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
                }
              />
              <small>Único en esta categoría, sin espacios.</small>
            </div>
            <div className="catalog-actions">
              <button className="primary">
                {busy ? "Guardando atributo…" : "Guardar atributo"}
              </button>
              {editing && (
                <button type="button" onClick={reset}>
                  Cancelar edición del atributo
                </button>
              )}
            </div>
          </fieldset>
        </form>
      </div>
    </details>
  );
}
