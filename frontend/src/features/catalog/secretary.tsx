"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api, type User } from "@/services/api";
import { allTaxonomy, errorText, slugify, useResource } from "./shared";
import type { Page, Product, PublicProductSummary, Taxonomy } from "./types";

type Extracted = {
  name: string;
  description: string;
  price: string | null;
  stock: number | null;
  category_name: string;
  brand_name: string;
};
type Draft = Extracted & {
  category: string;
  brand: string;
  salePrice: string;
  units: string;
  saved?: Product;
};
type Catalog = {
  title: string;
  introduction: string;
  products: PublicProductSummary[];
  prepared_at: string;
};
const money = (value: string) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value));

export function Secretary() {
  const [revision, setRevision] = useState(0);
  const user = useResource<User>("/users/me/", revision);
  if (user.loading)
    return (
      <section className="catalog-shell">
        <p role="status">Comprobando tu acceso…</p>
      </section>
    );
  if (user.data?.role !== "ADMIN")
    return (
      <section className="catalog-shell">
        <h1>Acceso administrativo</h1>
        <p>{user.error || "Tu cuenta no tiene acceso a la secretaria."}</p>
        <Link href="/login">Iniciar sesión</Link>
        <button onClick={() => setRevision(revision + 1)}>Reintentar</button>
      </section>
    );
  return <SecretaryWorkspace />;
}

function SecretaryWorkspace() {
  const [task, setTask] = useState<"intake" | "catalog">("intake");
  return (
    <section className="catalog-shell secretary-shell">
      <header className="secretary-heading">
        <p className="eyebrow">TU AYUDA EN LA TIENDA</p>
        <h1>Secretaria IA</h1>
        <p>
          Dime qué necesitas. Yo preparo el trabajo y tú revisas el resultado.
        </p>
      </header>
      <nav className="secretary-tasks" aria-label="Tareas de la secretaria">
        <button
          aria-pressed={task === "intake"}
          onClick={() => setTask("intake")}
        >
          <strong>Registrar productos</strong>
          <span>De una foto o un texto a borradores editables.</span>
        </button>
        <button
          aria-pressed={task === "catalog"}
          onClick={() => setTask("catalog")}
        >
          <strong>Preparar un catálogo</strong>
          <span>Productos reales, listos para presentar a tus clientes.</span>
        </button>
      </nav>
      <div hidden={task !== "intake"}>
        <ProductIntake />
      </div>
      <div hidden={task !== "catalog"}>
        <CatalogBuilder active={task === "catalog"} />
      </div>
    </section>
  );
}

function ProductIntake() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [categories, setCategories] = useState<Taxonomy[]>([]);
  const [brands, setBrands] = useState<Taxonomy[]>([]);
  const [taxonomyReady, setTaxonomyReady] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<number>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const review = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    Promise.all([allTaxonomy("categories"), allTaxonomy("brands")])
      .then(([cats, makers]) => {
        if (active) {
          setCategories(cats.filter((c) => c.is_active));
          setBrands(makers.filter((b) => b.is_active));
          setTaxonomyReady(true);
        }
      })
      .catch((err) => {
        if (active) setError(errorText(err));
      });
    return () => {
      active = false;
    };
  }, []);
  function update(index: number, change: Partial<Draft>) {
    setDrafts((previous) =>
      previous.map((draft, i) =>
        i === index ? { ...draft, ...change } : draft,
      ),
    );
  }
  async function addSuggested(
    kind: "categories" | "brands",
    name: string,
    index: number,
  ) {
    setSaving(index);
    setError("");
    try {
      const record = await api<Taxonomy>(`/admin/${kind}/`, {
        method: "POST",
        body: JSON.stringify({ name, slug: slugify(name), is_active: true }),
      });
      if (kind === "categories") {
        setCategories((previous) => [...previous, record]);
        update(index, { category: String(record.id) });
      } else {
        setBrands((previous) => [...previous, record]);
        update(index, { brand: String(record.id) });
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(undefined);
    }
  }
  async function prepare(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const body = new FormData();
    body.set("text", text);
    if (file) body.set("file", file);
    try {
      const result = await api<{ products: Extracted[] }>(
        "/admin/assistant/intake/",
        {
          method: "POST",
          body,
          signal: AbortSignal.timeout(25000),
        },
      );
      setDrafts(
        result.products.map((product) => ({
          ...product,
          salePrice: product.price ?? "",
          units: product.stock === null ? "" : String(product.stock),
          category: String(
            categories.find(
              (c) =>
                c.name.toLowerCase() === product.category_name.toLowerCase(),
            )?.id ?? "",
          ),
          brand: String(
            brands.find(
              (b) => b.name.toLowerCase() === product.brand_name.toLowerCase(),
            )?.id ?? "",
          ),
        })),
      );
      setNotice(
        result.products.length
          ? "Borradores preparados. Revisa cada dato antes de guardar."
          : "No identifiqué productos. Prueba con una foto más clara o un texto con nombres de productos.",
      );
      requestAnimationFrame(() => {
        review.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        review.current?.focus({ preventScroll: true });
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>, index: number) {
    event.preventDefault();
    if (saving !== undefined) return;
    setSaving(index);
    setError("");
    setNotice("");
    const draft = drafts[index];
    try {
      const product = await api<Product>("/admin/products/", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          category: Number(draft.category),
          brand: Number(draft.brand),
          initial_price: draft.salePrice,
          initial_stock: Number(draft.units),
          is_active: false,
        }),
      });
      update(index, { saved: product });
      setNotice(
        `${product.name} guardado sin publicar, con su precio y unidades. Puedes añadir sus fotos y publicarlo desde Administrar catálogo.`,
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(undefined);
    }
  }
  return (
    <div className="secretary-workspace">
      <h2>1. Pásame la información</h2>
      <p>
        Pega la lista de tu proveedor o adjunta una foto. Puedo preparar hasta
        ocho productos por vez.
      </p>
      <form className="secretary-form" onSubmit={prepare}>
        {!taxonomyReady && !error && (
          <p role="status">Cargando categorías y marcas para tus borradores…</p>
        )}
        <label>
          Información de los productos
          <textarea
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            placeholder="Ejemplo: Cargador Anker 65W. Precio de venta: $120.000 COP. Tengo 5 unidades. Categoría: Cargadores."
          />
        </label>
        <label>
          Foto de referencia (opcional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected && selected.size > 5 * 1024 * 1024) {
                setError("La foto debe pesar como máximo 5 MB.");
                e.target.value = "";
                setFile(undefined);
              } else {
                setFile(selected);
                setError("");
              }
            }}
          />
        </label>
        <p className="catalog-help">
          JPEG, PNG o WebP, hasta 5 MB. Se envía a Gemini para leerla; no se
          publica como foto del producto.
        </p>
        <button
          className="button primary"
          disabled={
            busy ||
            !taxonomyReady ||
            (!text.trim() && !file) ||
            saving !== undefined
          }
        >
          {busy ? "Leyendo y preparando borradores…" : "Preparar borradores"}
        </button>
      </form>
      {error && (
        <p role="alert" className="secretary-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="secretary-notice">
          {notice}
        </p>
      )}
      {drafts.length > 0 && (
        <section aria-labelledby="secretary-review">
          <h2 ref={review} tabIndex={-1} id="secretary-review">
            2. Revisa y guarda
          </h2>
          <p>
            Completa los datos que falten. Se guardarán sin publicar para que
            puedas añadir fotos antes de mostrarlos en la tienda.
          </p>
          <p className="catalog-help">
            Los borradores están en esta pestaña. Guarda los que necesites antes
            de cerrarla.
          </p>
          {(!categories.length || !brands.length) && (
            <p role="alert">
              Necesitas categorías y marcas activas.{" "}
              <Link href="/admin/catalogo">
                Créelas en Administrar catálogo
              </Link>{" "}
              y vuelve a cargar esta página.
            </p>
          )}
          {drafts.map((draft, index) => (
            <form
              key={index}
              className="secretary-draft"
              onSubmit={(event) => save(event, index)}
            >
              <fieldset disabled={saving !== undefined || Boolean(draft.saved)}>
                <legend>
                  Producto {index + 1}
                  {draft.saved ? " · Guardado" : ""}
                </legend>
                <label>
                  Nombre
                  <input
                    required
                    maxLength={180}
                    value={draft.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                  />
                </label>
                <label>
                  Descripción
                  <textarea
                    maxLength={2000}
                    value={draft.description}
                    onChange={(e) =>
                      update(index, { description: e.target.value })
                    }
                  />
                </label>
                <div className="secretary-fields">
                  <label>
                    Precio de venta (COP)
                    <input
                      required
                      type="number"
                      min="0"
                      max="9999999999.99"
                      step="0.01"
                      value={draft.salePrice}
                      placeholder="Confirma tu precio de venta"
                      onChange={(e) =>
                        update(index, { salePrice: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Unidades disponibles
                    <input
                      required
                      type="number"
                      min="0"
                      max="1000000"
                      step="1"
                      value={draft.units}
                      placeholder="Cuenta tus unidades"
                      onChange={(e) => update(index, { units: e.target.value })}
                    />
                  </label>
                  <label>
                    Categoría
                    <select
                      required
                      value={draft.category}
                      onChange={(e) =>
                        update(index, { category: e.target.value })
                      }
                    >
                      <option value="">Selecciona una categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Marca
                    <select
                      required
                      value={draft.brand}
                      onChange={(e) => update(index, { brand: e.target.value })}
                    >
                      <option value="">Selecciona una marca</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {draft.category_name &&
                  !categories.some(
                    (c) =>
                      c.name.toLowerCase() ===
                      draft.category_name.toLowerCase(),
                  ) && (
                    <p className="catalog-help">
                      Categoría leída: {draft.category_name}.{" "}
                      <button
                        type="button"
                        onClick={() =>
                          addSuggested("categories", draft.category_name, index)
                        }
                      >
                        Crear categoría «{draft.category_name}»
                      </button>
                    </p>
                  )}
                {draft.brand_name &&
                  !brands.some(
                    (b) =>
                      b.name.toLowerCase() === draft.brand_name.toLowerCase(),
                  ) && (
                    <p className="catalog-help">
                      Marca leída: {draft.brand_name}.{" "}
                      <button
                        type="button"
                        onClick={() =>
                          addSuggested("brands", draft.brand_name, index)
                        }
                      >
                        Crear marca «{draft.brand_name}»
                      </button>
                    </p>
                  )}
                {!draft.saved && (
                  <button
                    className="button primary"
                    disabled={!categories.length || !brands.length}
                  >
                    {saving === index
                      ? "Guardando…"
                      : "Confirmar y guardar sin publicar"}
                  </button>
                )}
              </fieldset>
              {draft.saved && (
                <p role="status">
                  Guardado.{" "}
                  <Link
                    href={`/admin/catalogo?editar=${draft.saved.id}`}
                    target="_blank"
                    rel="noopener"
                  >
                    Añadir fotos y publicar en otra pestaña →
                  </Link>
                </p>
              )}
            </form>
          ))}
        </section>
      )}
    </div>
  );
}

function CatalogBuilder({ active }: { active: boolean }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [brief, setBrief] = useState("");
  const [selected, setSelected] = useState<PublicProductSummary[]>([]);
  const [catalog, setCatalog] = useState<Catalog>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const preview = useRef<HTMLHeadingElement>(null);
  const products = useResource<Page<PublicProductSummary>>(
    `/products/?page_size=100&page=${page}&search=${encodeURIComponent(search)}`,
  );
  const visible =
    products.data?.results.filter((p) => p.variants_count > 0) ?? [];
  function toggle(product: PublicProductSummary) {
    if (selected.some((p) => p.id === product.id))
      setSelected(selected.filter((p) => p.id !== product.id));
    else if (selected.length < 12) setSelected([...selected, product]);
    else setError("Puedes incluir hasta doce productos por catálogo.");
  }
  async function prepare(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Catalog>("/admin/assistant/catalog/", {
        method: "POST",
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ brief, product_ids: selected.map((p) => p.id) }),
      });
      setCatalog(result);
      requestAnimationFrame(() => {
        preview.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        preview.current?.focus({ preventScroll: true });
      });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!catalog) return;
    const text = [
      catalog.title,
      catalog.introduction,
      ...catalog.products.map(
        (p) =>
          `${p.name}\n${money(p.promotional_min_price ?? p.min_price)} COP${p.min_price !== p.max_price ? " desde" : ""}\n${p.is_available ? `${p.total_stock} unidades disponibles` : "Agotado"}\n${window.location.origin}/catalogo/${encodeURIComponent(p.slug)}`,
      ),
      "Precios y existencias sujetos a cambios. Confirma en la tienda.",
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice(
        "Texto copiado. Puedes pegarlo en WhatsApp y enviarlo cuando lo revises.",
      );
    } catch {
      setError("No pudimos copiar. Usa la vista previa o imprime el catálogo.");
    }
  }
  return (
    <div className="secretary-workspace">
      <h2>1. Cuéntame qué catálogo necesitas</h2>
      <p>
        Elige hasta doce productos publicados. La IA redacta la presentación;
        los precios y existencias vienen de la tienda.
      </p>
      <label className="secretary-brief">
        Instrucciones para el catálogo
        <textarea
          maxLength={1500}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Ejemplo: Un catálogo de accesorios para estudiantes. Usa un tono cercano y una presentación breve."
        />
      </label>
      <form
        className="secretary-search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query);
          setPage(1);
        }}
      >
        <label>
          Buscar productos
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={180}
            placeholder="Nombre, marca o categoría"
          />
        </label>
        <button>Buscar</button>
      </form>
      <div className="secretary-actions">
        <button
          type="button"
          onClick={() => {
            setSelected(visible.filter((p) => p.is_available).slice(0, 12));
            setError("");
          }}
        >
          Elegir disponibles de esta página
        </button>
        <button type="button" onClick={() => setSelected([])}>
          Limpiar selección
        </button>
        <span>{selected.length} de 12 seleccionados</span>
      </div>
      {products.loading && <p role="status">Buscando productos…</p>}
      {products.error && <p role="alert">{products.error}</p>}
      {!products.loading && !visible.length && (
        <p>
          No hay productos publicados con presentaciones en esta búsqueda.{" "}
          <Link href="/admin/catalogo">Revisar productos</Link>
        </p>
      )}
      <div className="secretary-product-list">
        {visible.map((p) => (
          <label key={p.id} className="secretary-product-option">
            <input
              type="checkbox"
              checked={selected.some((s) => s.id === p.id)}
              onChange={() => toggle(p)}
            />
            <span>
              <strong>{p.name}</strong>
              <small>
                {money(p.promotional_min_price ?? p.min_price)} COP ·{" "}
                {p.is_available ? `${p.total_stock} disponibles` : "Agotado"}
              </small>
            </span>
          </label>
        ))}
      </div>
      {(products.data?.previous || products.data?.next) && (
        <div className="secretary-actions">
          <button
            disabled={!products.data.previous}
            onClick={() => setPage(page - 1)}
          >
            Página anterior
          </button>
          <span>Página {page}</span>
          <button
            disabled={!products.data.next}
            onClick={() => setPage(page + 1)}
          >
            Página siguiente
          </button>
        </div>
      )}
      {!!selected.length && (
        <p className="catalog-help">
          Incluidos: {selected.map((p) => p.name).join(", ")}
        </p>
      )}
      <form onSubmit={prepare}>
        <button
          className="button primary"
          disabled={busy || !brief.trim() || !selected.length}
        >
          {busy ? "Preparando tu catálogo…" : "Preparar catálogo con IA"}
        </button>
      </form>
      {error && (
        <p role="alert" className="secretary-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="secretary-notice">
          {notice}
        </p>
      )}
      {catalog && (
        <section className="secretary-result">
          <h2 ref={preview} tabIndex={-1}>
            2. Revisa y comparte
          </h2>
          <div className="secretary-fields">
            <label>
              Título del catálogo
              <input
                maxLength={100}
                value={catalog.title}
                onChange={(e) =>
                  setCatalog({ ...catalog, title: e.target.value })
                }
              />
            </label>
            <label>
              Presentación
              <textarea
                maxLength={600}
                value={catalog.introduction}
                onChange={(e) =>
                  setCatalog({ ...catalog, introduction: e.target.value })
                }
              />
            </label>
          </div>
          <p className="catalog-help">
            Comprueba la selección antes de compartir. Si cambiaste precios o
            unidades, vuelve a preparar el catálogo para actualizarlo.
          </p>
          <div className="secretary-actions">
            <button onClick={copy}>Copiar para WhatsApp</button>
            <button onClick={() => window.print()}>
              Imprimir / guardar PDF
            </button>
          </div>
          <article
            className="secretary-print-sheet"
            data-print-active={active}
            aria-label="Vista previa del catálogo"
          >
            <p className="eyebrow">TTI · TIENDA TECNOLÓGICA INTELIGENTE</p>
            <h2>{catalog.title}</h2>
            <p>{catalog.introduction}</p>
            <div className="secretary-catalog-grid">
              {catalog.products.map((p) => (
                <section key={p.id} className="secretary-catalog-card">
                  {/* Signed URLs use the same image source as the public catalogue. */}
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      width={400}
                      height={240}
                      unoptimized
                    />
                  ) : (
                    <div className="secretary-no-photo">Sin foto</div>
                  )}
                  <p className="eyebrow">{p.category.name}</p>
                  <h3>{p.name}</h3>
                  <strong>
                    {p.min_price !== p.max_price ? "Desde " : ""}
                    {money(p.promotional_min_price ?? p.min_price)} COP
                  </strong>
                  {p.has_promotion && (
                    <small>
                      Precio promocional vigente al preparar este catálogo.
                    </small>
                  )}
                  <p>
                    {p.is_available
                      ? `${p.total_stock} unidades disponibles`
                      : "Agotado"}
                  </p>
                  <Link href={`/catalogo/${encodeURIComponent(p.slug)}`}>
                    Ver producto y comprar
                  </Link>
                </section>
              ))}
            </div>
            <footer>
              Preparado el{" "}
              {new Date(catalog.prepared_at).toLocaleString("es-CO", {
                timeZone: "America/Bogota",
              })}
              . Precios y existencias sujetos a cambios. Confirma en la tienda.
            </footer>
          </article>
        </section>
      )}
    </div>
  );
}
