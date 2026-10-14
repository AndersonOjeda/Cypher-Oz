"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Filter, Package, RefreshCw, Search, X } from "lucide-react";
import { cop } from "@/features/orders/types";
import { errorText, Pager, publicTaxonomy, useResource } from "./shared";
import type { Page, PublicProductSummary, Taxonomy } from "./types";

export function PublicCatalog() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read current filter state from URL query parameters
  const currentSearch = searchParams.get("search") ?? "";
  const currentCategory = searchParams.get("category") ?? "";
  const currentBrand = searchParams.get("brand") ?? "";
  const currentMinPrice = searchParams.get("min_price") ?? "";
  const currentMaxPrice = searchParams.get("max_price") ?? "";
  const currentAvailable = searchParams.get("available") ?? "";
  const currentOrdering = searchParams.get("ordering") ?? "-updated_at";
  const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // Local filter form state
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [minPriceInput, setMinPriceInput] = useState(currentMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(currentMaxPrice);

  // Taxonomy options
  const [categories, setCategories] = useState<Taxonomy[]>([]);
  const [brands, setBrands] = useState<Taxonomy[]>([]);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    setMinPriceInput(currentMinPrice);
  }, [currentMinPrice]);

  useEffect(() => {
    setMaxPriceInput(currentMaxPrice);
  }, [currentMaxPrice]);

  useEffect(() => {
    let active = true;
    Promise.all([publicTaxonomy("categories"), publicTaxonomy("brands")]).then(
      ([cats, brs]) => {
        if (!active) return;
        setCategories(cats);
        setBrands(brs);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // Build API query string
  const queryParams = new URLSearchParams();
  if (currentSearch) queryParams.set("search", currentSearch);
  if (currentCategory) queryParams.set("category", currentCategory);
  if (currentBrand) queryParams.set("brand", currentBrand);
  if (currentMinPrice) queryParams.set("min_price", currentMinPrice);
  if (currentMaxPrice) queryParams.set("max_price", currentMaxPrice);
  if (currentAvailable) queryParams.set("available", currentAvailable);
  if (currentOrdering) queryParams.set("ordering", currentOrdering);
  queryParams.set("page", String(currentPage));

  const resourcePath = `/products/?${queryParams.toString()}`;
  const { data, error, loading } = useResource<Page<PublicProductSummary>>(
    resourcePath,
    revision,
  );

  const updateFilters = useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          nextParams.delete(key);
        } else {
          nextParams.set(key, value);
        }
      }
      // Reset to page 1 unless page itself was updated
      if (!("page" in updates)) {
        nextParams.delete("page");
      }
      const qs = nextParams.toString();
      router.push(qs ? `/catalogo?${qs}` : "/catalogo");
    },
    [router, searchParams],
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateFilters({ search: searchInput.trim() || null });
  }

  function handleClearFilters() {
    setSearchInput("");
    setMinPriceInput("");
    setMaxPriceInput("");
    router.push("/catalogo");
  }

  function handlePriceApply() {
    updateFilters({
      min_price: minPriceInput.trim() || null,
      max_price: maxPriceInput.trim() || null,
    });
  }

  const hasActiveFilters = Boolean(
    currentSearch ||
      currentCategory ||
      currentBrand ||
      currentMinPrice ||
      currentMaxPrice ||
      currentAvailable,
  );

  return (
    <div className="public-catalog-shell">
      <header className="public-catalog-header">
        <h1>Catálogo de Productos</h1>
        <p>
          Tecnología y equipos con garantía directa y atención personalizada en
          Pasto, Nariño.
        </p>
      </header>

      <div className="catalog-layout">
        {/* Filters Sidebar */}
        <aside className="catalog-filters" aria-label="Filtros del catálogo">
          <div className="filters-header">
            <h2>Filtros</h2>
            {hasActiveFilters && (
              <button
                type="button"
                className="clear-btn"
                onClick={handleClearFilters}
              >
                Limpiar todo
              </button>
            )}
          </div>

          {/* Search */}
          <form className="filter-group" onSubmit={handleSearchSubmit}>
            <label htmlFor="catalog-search">Buscar</label>
            <div style={{ position: "relative" }}>
              <input
                id="catalog-search"
                type="search"
                placeholder="Ej. Laptop, Monitor, Mouse..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  title="Borrar búsqueda"
                  aria-label="Borrar búsqueda"
                  onClick={() => {
                    setSearchInput("");
                    updateFilters({ search: null });
                  }}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </form>

          {/* Category */}
          <div className="filter-group">
            <label htmlFor="filter-category">Categoría</label>
            <select
              id="filter-category"
              value={currentCategory}
              onChange={(e) => updateFilters({ category: e.target.value || null })}
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div className="filter-group">
            <label htmlFor="filter-brand">Marca</label>
            <select
              id="filter-brand"
              value={currentBrand}
              onChange={(e) => updateFilters({ brand: e.target.value || null })}
            >
              <option value="">Todas las marcas</option>
              {brands.map((br) => (
                <option key={br.id} value={br.slug}>
                  {br.name}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range */}
          <div className="filter-group">
            <label>Rango de precio (COP)</label>
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Mínimo"
                min={0}
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                onBlur={handlePriceApply}
                onKeyDown={(e) => e.key === "Enter" && handlePriceApply()}
              />
              <span>—</span>
              <input
                type="number"
                placeholder="Máximo"
                min={0}
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                onBlur={handlePriceApply}
                onKeyDown={(e) => e.key === "Enter" && handlePriceApply()}
              />
            </div>
          </div>

          {/* Availability */}
          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={currentAvailable === "true"}
                onChange={(e) =>
                  updateFilters({ available: e.target.checked ? "true" : null })
                }
              />
              Solo disponibles en stock
            </label>
          </div>
        </aside>

        {/* Catalog Content */}
        <main className="catalog-content">
          <div className="catalog-top-bar">
            <p className="results-count">
              {loading ? (
                "Buscando productos..."
              ) : (
                <>
                  Mostrando <strong>{data?.count ?? 0}</strong>{" "}
                  {data?.count === 1 ? "producto" : "productos"}
                </>
              )}
            </p>

            <div className="sort-control">
              <label htmlFor="catalog-sort">Ordenar por:</label>
              <select
                id="catalog-sort"
                value={currentOrdering}
                onChange={(e) => updateFilters({ ordering: e.target.value })}
              >
                <option value="-updated_at">Más recientes</option>
                <option value="name">Nombre: A — Z</option>
                <option value="-name">Nombre: Z — A</option>
                <option value="price">Precio: Menor a mayor</option>
                <option value="-price">Precio: Mayor a menor</option>
              </select>
            </div>
          </div>

          {loading && (
            <div role="status" style={{ padding: "40px 0", textAlign: "center" }}>
              <p>Cargando catálogo de productos...</p>
            </div>
          )}

          {error && (
            <div role="alert" className="error-message" style={{ margin: "24px 0" }}>
              <p>{error}</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => setRevision((r) => r + 1)}
                style={{ marginTop: 8 }}
              >
                <RefreshCw size={16} /> Reintentar
              </button>
            </div>
          )}

          {!loading && !error && data && data.results.length === 0 && (
            <div className="catalog-empty">
              <h3>No se encontraron productos</h3>
              <p>
                No encontramos productos que coincidan con los filtros aplicados.
                Intenta ajustando los criterios de búsqueda.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="button primary"
                  onClick={handleClearFilters}
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          )}

          {!loading && !error && data && data.results.length > 0 && (
            <>
              <div className="products-grid">
                {data.results.map((product) => (
                  <article key={product.id} className="product-card">
                    <div className="card-image-wrap">
                      {product.has_promotion && (
                        <span className="promo-badge">¡Oferta!</span>
                      )}
                      {product.image_url ? (
                        <Image
                          unoptimized
                          src={product.image_url}
                          alt={product.name}
                          width={260}
                          height={200}
                        />
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            color: "#94a3b8",
                            gap: 6,
                          }}
                        >
                          <Package size={42} aria-hidden="true" />
                          <span style={{ fontSize: 12 }}>Sin imagen</span>
                        </div>
                      )}
                    </div>

                    <div className="card-body">
                      <div className="card-tags">
                        <span>{product.category.name}</span>
                        <span>·</span>
                        <span>{product.brand.name}</span>
                      </div>

                      <h2 className="card-title">
                        <Link href={`/catalogo/${product.slug}`}>
                          {product.name}
                        </Link>
                      </h2>

                      <div className="card-pricing">
                        {product.has_promotion && product.promotional_min_price ? (
                          <>
                            <span className="price-current has-discount">
                              {cop(product.promotional_min_price)}
                            </span>
                            <span className="price-original">
                              {cop(product.min_price)}
                            </span>
                          </>
                        ) : (
                          <span className="price-current">
                            {cop(product.min_price)}
                          </span>
                        )}
                      </div>

                      <div className="card-stock">
                        {product.is_available ? (
                          <span className="stock-in">
                            ✓ {product.total_stock} disponibles
                          </span>
                        ) : (
                          <span className="stock-out">✕ Agotado</span>
                        )}
                      </div>

                      <div className="card-actions">
                        <Link
                          className="button primary"
                          href={`/catalogo/${product.slug}`}
                        >
                          Ver detalle
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <Pager
                page={currentPage}
                data={data}
                onChange={(nextPage) => updateFilters({ page: String(nextPage) })}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

