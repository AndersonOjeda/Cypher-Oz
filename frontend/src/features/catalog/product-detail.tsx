"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { addToCart } from "@/features/orders/cart-storage";
import { cop } from "@/features/orders/types";
import { useResource } from "./shared";
import type { PublicProductDetail, PublicVariant } from "./types";

export function ProductDetail({ slug }: { slug: string }) {
  const [revision, setRevision] = useState(0);
  const {
    data: product,
    error,
    loading,
  } = useResource<PublicProductDetail>(
    `/products/${encodeURIComponent(slug)}/`,
    revision,
  );

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    null,
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);

  const [selectionKey, setSelectionKey] = useState(`${slug}:${revision}`);
  if (selectionKey !== `${slug}:${revision}`) {
    setSelectionKey(`${slug}:${revision}`);
    setSelectedVariantId(null);
    setActiveImageIndex(0);
    setQuantity(1);
    setAddedNotice(false);
  }

  const selectedVariant: PublicVariant | null = useMemo(() => {
    if (!product?.variants) return null;
    return (
      product.variants.find((v) => v.id === selectedVariantId) ??
      product.variants.find((v) => v.stock > 0) ??
      product.variants[0] ??
      null
    );
  }, [product, selectedVariantId]);

  function handleVariantChange(variantId: number) {
    setSelectedVariantId(variantId);
    setQuantity(1);
    setAddedNotice(false);
  }

  function handleAddToCart() {
    if (!product || !selectedVariant || selectedVariant.stock <= 0) return;

    const label = `${product.name} · ${selectedVariant.name}`;
    addToCart(
      selectedVariant.id,
      quantity,
      label,
      undefined,
      selectedVariant.promotional_price ?? selectedVariant.price,
    );
    setAddedNotice(true);
  }

  if (loading) {
    return (
      <div className="detail-shell">
        <p role="status" style={{ textAlign: "center", padding: "60px 0" }}>
          Cargando detalles del producto...
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="detail-shell">
        <nav className="detail-breadcrumb">
          <Link href="/catalogo">
            <ArrowLeft size={16} /> Volver al catálogo
          </Link>
        </nav>
        <div
          role="alert"
          className="error-message"
          style={{ margin: "24px 0" }}
        >
          <p>{error || "Producto no encontrado o no disponible."}</p>
          <button
            type="button"
            className="button secondary"
            onClick={() => setRevision((r) => r + 1)}
            style={{ marginTop: 12 }}
          >
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  const images = product.images || [];
  const currentImage = images[activeImageIndex] ?? images[0];
  const maxAvailableQuantity = selectedVariant
    ? Math.min(selectedVariant.stock, 10)
    : 1;

  return (
    <div className="detail-shell">
      {/* Breadcrumb Navigation */}
      <nav className="detail-breadcrumb" aria-label="Navegación secundaria">
        <Link href="/catalogo">
          <ArrowLeft
            size={14}
            style={{ display: "inline", verticalAlign: "middle" }}
          />{" "}
          Catálogo
        </Link>
        <span>/</span>
        <Link href={`/catalogo?category=${product.category.slug}`}>
          {product.category.name}
        </Link>
        <span>/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="detail-layout">
        {/* Left Column: Image Gallery */}
        <section className="gallery-container" aria-label="Galería de imágenes">
          <div className="main-image-box">
            {selectedVariant?.promotional_price && (
              <span className="promo-badge">
                {selectedVariant.promotion_name || "Oferta"}
              </span>
            )}
            {currentImage ? (
              <Image
                unoptimized
                src={currentImage.url}
                alt={currentImage.alt_text || product.name}
                width={450}
                height={380}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  color: "#94a3b8",
                  gap: 8,
                }}
              >
                <Package size={64} aria-hidden="true" />
                <span>Sin imagen disponible</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="gallery-thumbs" aria-label="Miniaturas de producto">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  className={`thumb-btn ${idx === activeImageIndex ? "active" : ""}`}
                  onClick={() => setActiveImageIndex(idx)}
                  title={`Ver imagen ${idx + 1}`}
                >
                  <Image
                    unoptimized
                    src={img.url}
                    alt={img.alt_text || `${product.name} ${idx + 1}`}
                    width={60}
                    height={60}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Product Info & Actions */}
        <section className="detail-info" aria-label="Información del producto">
          <div className="detail-category-brand">
            <span>{product.category.name}</span> ·{" "}
            <span>{product.brand.name}</span>
          </div>

          <h1 className="detail-title">{product.name}</h1>

          {/* Pricing Box */}
          <div className="detail-pricing-box">
            {selectedVariant?.promotional_price ? (
              <>
                <div className="detail-price-row">
                  <span
                    className="price-current has-discount"
                    style={{ fontSize: 26 }}
                  >
                    {cop(selectedVariant.promotional_price)}
                  </span>
                  <span className="price-original" style={{ fontSize: 18 }}>
                    {cop(selectedVariant.price)}
                  </span>
                  <span className="detail-promo-badge">
                    {selectedVariant.promotion_name || "Descuento"}
                  </span>
                </div>
                <small style={{ color: "#64748b" }}>
                  Precio promocional aplicado por tiempo limitado.
                </small>
              </>
            ) : (
              <div className="detail-price-row">
                <span className="price-current" style={{ fontSize: 26 }}>
                  {selectedVariant ? cop(selectedVariant.price) : "—"}
                </span>
              </div>
            )}
          </div>

          {/* Variants Selector */}
          {product.variants.length > 0 && (
            <div className="variant-selector-box">
              <label>Selecciona una variante / modelo:</label>
              <div className="variant-options" role="radiogroup">
                {product.variants.map((v) => {
                  const isSelected = v.id === selectedVariant?.id;
                  const isOutOfStock = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`variant-chip ${isSelected ? "selected" : ""} ${isOutOfStock ? "out-of-stock" : ""}`}
                      onClick={() => handleVariantChange(v.id)}
                    >
                      {v.name}
                      {v.promotional_price ? " ★" : ""}
                      {isOutOfStock ? " (Agotado)" : ""}
                    </button>
                  );
                })}
              </div>

              {selectedVariant && (
                <div className="variant-details-meta">
                  <span>
                    <strong>SKU:</strong> {selectedVariant.sku}
                  </span>
                  {selectedVariant.attributes.map((attr) => (
                    <span key={attr.code}>
                      <strong>{attr.name}:</strong> {attr.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stock Availability */}
          <div className="card-stock">
            {selectedVariant && selectedVariant.stock > 0 ? (
              <p className="stock-in" style={{ fontSize: 14, margin: 0 }}>
                ✓ {selectedVariant.stock} unidades disponibles para entrega
                inmediata
              </p>
            ) : (
              <p className="stock-out" style={{ fontSize: 14, margin: 0 }}>
                ✕ Variante actualmente agotada
              </p>
            )}
          </div>

          {/* Add to Cart Controls */}
          <div className="cart-action-box">
            {selectedVariant && selectedVariant.stock > 0 && (
              <div className="quantity-control">
                <label htmlFor="quantity-input">Cantidad:</label>
                <input
                  id="quantity-input"
                  type="number"
                  min={1}
                  max={maxAvailableQuantity}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (Number.isSafeInteger(val) && val >= 1) {
                      setQuantity(Math.min(val, maxAvailableQuantity));
                    }
                  }}
                />
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  (Máx. {maxAvailableQuantity})
                </span>
              </div>
            )}

            <button
              type="button"
              className="button primary add-cart-btn"
              disabled={!selectedVariant || selectedVariant.stock <= 0}
              onClick={handleAddToCart}
            >
              <ShoppingCart
                size={18}
                style={{
                  display: "inline",
                  verticalAlign: "middle",
                  marginRight: 8,
                }}
              />
              {selectedVariant && selectedVariant.stock > 0
                ? "Añadir al carrito"
                : "Producto agotado"}
            </button>

            <p className="cart-notice">
              * El carrito no reserva inventario hasta confirmar el pedido.
              Puedes comprar sin registrarte inicialmente.
            </p>

            {/* Added Notice Feedback */}
            {addedNotice && (
              <div className="cart-feedback-success" role="status">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={18} />
                  <strong>¡Añadido al carrito con éxito!</strong>
                </div>
                <div className="cart-feedback-actions">
                  <Link href="/comprar">Ver carrito y finalizar compra →</Link>
                  <Link href="/catalogo">Seguir explorando</Link>
                </div>
              </div>
            )}
          </div>

          {/* Warranty Info */}
          {product.warranty && (
            <div className="warranty-badge">
              <ShieldCheck size={20} />
              <span>
                <strong>Garantía TTI:</strong> {product.warranty}
              </span>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="product-description-box">
              <h3>Descripción del producto</h3>
              <p
                style={{
                  whiteSpace: "pre-line",
                  color: "#334155",
                  lineHeight: 1.6,
                }}
              >
                {product.description}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
