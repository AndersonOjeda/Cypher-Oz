"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { api } from "@/services/api";
import { errorText, Feedback } from "./shared";
import type { Limits, ProductImage } from "./types";

export function ImageManager({
  productId,
  initialImages,
  limits,
}: {
  productId: number;
  initialImages: ProductImage[];
  limits: Limits;
}) {
  const [images, setImages] = useState(initialImages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function refresh() {
    setImages(
      await api<ProductImage[]>(`/admin/products/${productId}/images/`),
    );
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    setError("");
    setMessage("");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > limits.max_image_bytes
    ) {
      setError("Selecciona una imagen dentro del tamaño permitido.");
      return;
    }
    setBusy(true);
    try {
      const image = await api<ProductImage>(
        `/admin/products/${productId}/images/`,
        { method: "POST", body: data },
      );
      setImages((current) => [...current, image]);
      form.reset();
      setMessage("Imagen añadida.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function change(
    id: number,
    body?: { alt_text: string; sort_order: number },
  ) {
    if (!body && !window.confirm("¿Eliminar esta imagen del producto?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/admin/products/${productId}/images/${id}/`, {
        method: body ? "PATCH" : "DELETE",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!body)
        setImages((current) => current.filter((image) => image.id !== id));
      await refresh();
      setMessage(body ? "Imagen actualizada." : "Imagen eliminada.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="catalog-panel catalog-images">
      <h2>Imágenes del producto</h2>
      <p className="catalog-help">
        JPEG, PNG o WebP. Máximo {limits.max_image_bytes / 1048576} MB,{" "}
        {limits.max_image_dimension} píxeles por lado y {limits.max_images}{" "}
        imágenes. La primera según el orden es la principal.
      </p>
      <Feedback error={error} message={message} />
      {!images.length && (
        <p className="catalog-empty">Este producto aún no tiene imágenes.</p>
      )}
      <div className="catalog-gallery">
        {images.map((item) => (
          <article key={item.id} className="catalog-image">
            <Image
              src={item.url}
              alt={item.alt_text}
              width={item.width}
              height={item.height}
              unoptimized
              className="catalog-preview"
            />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                change(item.id, {
                  alt_text: String(data.get("alt_text")),
                  sort_order: Number(data.get("sort_order")),
                });
              }}
            >
              <fieldset disabled={busy}>
                <div className="field">
                  <label htmlFor={`alt-${item.id}`}>
                    Descripción de imagen
                  </label>
                  <input
                    id={`alt-${item.id}`}
                    name="alt_text"
                    required
                    maxLength={200}
                    defaultValue={item.alt_text}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`order-${item.id}`}>Orden</label>
                  <input
                    id={`order-${item.id}`}
                    name="sort_order"
                    type="number"
                    min="0"
                    max="32767"
                    required
                    defaultValue={item.sort_order}
                  />
                </div>
                <div className="catalog-actions">
                  <button>Guardar imagen</button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => change(item.id)}
                  >
                    Eliminar imagen
                  </button>
                </div>
              </fieldset>
            </form>
          </article>
        ))}
      </div>
      <form onSubmit={upload}>
        <fieldset disabled={busy || images.length >= limits.max_images}>
          <div className="field">
            <label htmlFor="new-image">Archivo de imagen</label>
            <input
              id="new-image"
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-alt">Descripción de la nueva imagen</label>
            <input
              id="new-alt"
              name="alt_text"
              required
              maxLength={200}
              placeholder="Ejemplo: vista frontal del teclado"
            />
          </div>
          <button className="button primary">
            {busy ? "Procesando…" : "Añadir imagen"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
