"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api } from "@/services/api";
import { ImageManager } from "./image-manager";
import { errorText, Feedback } from "./shared";
import { useEditorNavigation } from "./use-editor-navigation";
import type { Limits, Product, Taxonomy } from "./types";

export function ProductCreate({
  categories,
  brands,
  limits,
  onCreated,
  onFinish,
  onNew,
}: {
  categories: Taxonomy[];
  brands: Taxonomy[];
  limits: Limits;
  onCreated: () => void;
  onFinish: (product: Product) => void;
  onNew: () => void;
}) {
  const [product, setProduct] = useState<Product>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [initialStock, setInitialStock] = useState(0);
  const { editorRef, showEditor } = useEditorNavigation();
  const activeCategories = categories.filter((item) => item.is_active);
  const activeBrands = brands.filter((item) => item.is_active);
  const ready = activeCategories.length > 0 && activeBrands.length > 0;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const saved = await api<Product>("/admin/products/", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name")).trim(),
          category: Number(data.get("category")),
          brand: Number(data.get("brand")),
          description: String(data.get("description")).trim(),
          warranty: String(data.get("warranty") ?? "").trim(),
          initial_price: String(data.get("price")),
          initial_stock: Number(data.get("stock")),
          is_active: data.get("is_active") === "on",
        }),
      });
      setProduct(saved);
      setInitialStock(Number(data.get("stock")));
      onCreated();
      showEditor();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="product-create">
      <ol
        className="product-steps"
        aria-label="Pasos para registrar un producto"
      >
        <li aria-current={!product ? "step" : undefined}>1. Datos y precio</li>
        <li aria-current={product && !completed ? "step" : undefined}>
          2. Fotos (opcional)
        </li>
      </ol>
      {product && completed ? (
        <>
          <h3 ref={editorRef} tabIndex={-1} className="catalog-editor-heading">
            Registro terminado
          </h3>
          <p role="status">{product.name} quedó guardado con su precio.</p>
          <p className="catalog-help">
            {product.is_active
              ? "Está activo en el catálogo."
              : "Quedó como borrador, sin mostrarse en el catálogo."}{" "}
            {initialStock > 0
              ? `Se registraron ${initialStock} unidades disponibles.`
              : "Quedó sin existencias y aparecerá agotado hasta que registres una entrada en Inventario."}
          </p>
          <p>
            <Link href="/admin/inventario">
              Gestionar existencias en Inventario →
            </Link>
          </p>
          <div className="catalog-actions">
            <button className="primary" type="button" onClick={onNew}>
              Registrar otro producto
            </button>
            <button type="button" onClick={() => onFinish(product)}>
              Ver o editar este producto
            </button>
          </div>
        </>
      ) : product ? (
        <>
          <h3 ref={editorRef} tabIndex={-1} className="catalog-editor-heading">
            {product.name} ya está guardado
          </h3>
          <p className="catalog-help">
            Su precio también está guardado. Añade una foto para que sea más
            fácil reconocerlo o termina por ahora.
          </p>
          <ImageManager
            productId={product.id}
            initialImages={product.images}
            limits={limits}
            defaultAlt={product.name}
            onBusyChange={setImageBusy}
          />
          <div className="catalog-actions">
            <button
              type="button"
              className="primary"
              disabled={imageBusy}
              onClick={() => {
                setCompleted(true);
                showEditor();
              }}
            >
              Terminar registro
            </button>
          </div>
          <p className="catalog-help">
            Puedes añadir o cambiar fotos después.{" "}
            {initialStock > 0
              ? `Guardamos ${initialStock} unidades disponibles.`
              : "Registraste 0 unidades: el producto aparecerá agotado."}
          </p>
        </>
      ) : (
        <>
          <p className="catalog-help">
            Completa los datos y el precio. Nosotros generamos los códigos; las
            fotos van después.
          </p>
          <Feedback error={error} message="" />
          {!ready && (
            <p role="status" className="catalog-help">
              Primero necesitas una categoría y una marca activas. Puedes
              crearlas en las pestañas Categorías y Marcas de arriba.
            </p>
          )}
          <form onSubmit={save} aria-label="Registrar producto">
            <fieldset disabled={busy || !ready}>
              <div className="field">
                <label htmlFor="create-product-name">Nombre del producto</label>
                <input
                  id="create-product-name"
                  name="name"
                  required
                  maxLength={180}
                  placeholder="Ejemplo: Teclado inalámbrico Logitech K380"
                />
              </div>
              <div className="catalog-form-row">
                <div className="field">
                  <label htmlFor="create-product-category">Categoría</label>
                  <select
                    id="create-product-category"
                    name="category"
                    required
                    defaultValue={
                      activeCategories.length === 1
                        ? activeCategories[0].id
                        : ""
                    }
                  >
                    <option value="">Selecciona una categoría</option>
                    {activeCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="create-product-brand">Marca</label>
                  <select
                    id="create-product-brand"
                    name="brand"
                    required
                    defaultValue={
                      activeBrands.length === 1 ? activeBrands[0].id : ""
                    }
                  >
                    <option value="">Selecciona una marca</option>
                    {activeBrands.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="create-product-price">
                  Precio de venta (COP)
                </label>
                <input
                  id="create-product-price"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  required
                  placeholder="Ejemplo: 150000"
                />
                <small>
                  Escribe el valor en pesos, sin puntos de miles. Este será el
                  precio por unidad.
                </small>
              </div>
              <div className="field">
                <label htmlFor="create-product-stock">
                  Unidades disponibles
                </label>
                <input
                  id="create-product-stock"
                  name="stock"
                  type="number"
                  inputMode="numeric"
                  required
                  min="0"
                  max="2147483647"
                  step="1"
                  placeholder="Ejemplo: 10"
                  aria-describedby="create-stock-help"
                />
                <small id="create-stock-help">
                  ¿Cuántas unidades tienes para vender? Si escribes 0, aparecerá
                  como agotado.
                </small>
              </div>
              <div className="field">
                <label htmlFor="create-product-description">Descripción</label>
                <textarea
                  id="create-product-description"
                  name="description"
                  required
                  maxLength={10000}
                  rows={3}
                  placeholder="Cuenta qué es y cuáles son sus características principales."
                />
              </div>
              <details className="product-extra">
                <summary>Añadir garantía (opcional)</summary>
                <div className="field">
                  <label htmlFor="create-product-warranty">Garantía</label>
                  <textarea
                    id="create-product-warranty"
                    name="warranty"
                    maxLength={1000}
                    rows={2}
                    placeholder="Ejemplo: 12 meses por defectos de fábrica"
                  />
                </div>
              </details>
              <label className="catalog-check">
                <input type="checkbox" name="is_active" defaultChecked />{" "}
                Mostrar en el catálogo
              </label>
              <p className="catalog-help">
                Desmarca esta opción si prefieres dejarlo como borrador. Para
                que se pueda comprar, indica al menos una unidad disponible.
              </p>
              <button className="primary" type="submit">
                {busy
                  ? "Guardando producto y precio…"
                  : "Guardar y continuar con fotos"}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </div>
  );
}
