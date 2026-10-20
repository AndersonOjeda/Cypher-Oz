/** Keep the catalog's heading and layout present while URL filters hydrate. */
export function CatalogLoading() {
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
        <div
          className="catalog-filters catalog-filters-placeholder"
          aria-hidden="true"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div className="catalog-placeholder-control" key={index} />
          ))}
        </div>
        <div className="catalog-content">
          <p role="status">Cargando catálogo de productos...</p>
        </div>
      </div>
    </div>
  );
}
