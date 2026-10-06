"use client";

import Link from "next/link";
import { useState } from "react";
import type { User } from "@/services/api";
import { useResource } from "./shared";
import { TaxonomyManager } from "./taxonomy-manager";
import { ProductManager } from "./product-manager";

export function AdminCatalog() {
  const [tab, setTab] = useState<"products" | "categories" | "brands">(
    "products",
  );
  const [revision, setRevision] = useState(0);
  const user = useResource<User>("/users/me/", revision);
  if (user.loading)
    return (
      <section className="catalog-shell">
        <p role="status">Comprobando tu acceso…</p>
      </section>
    );
  if (!user.data || user.data.role !== "ADMIN")
    return (
      <section className="catalog-shell">
        <h1>Acceso administrativo</h1>
        <p>
          {user.error ||
            "Tu cuenta no tiene permisos para administrar el catálogo."}
        </p>
        <Link href="/login">Iniciar sesión</Link> ·{" "}
        <Link href="/cuenta">Mi cuenta</Link>
        <button onClick={() => setRevision((v) => v + 1)}>Reintentar</button>
      </section>
    );
  return (
    <div className="catalog-shell">
      <div className="catalog-heading">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h1>Tu catálogo, organizado.</h1>
          <p>
            Gestiona productos, variantes, precios, categorías, marcas e
            imágenes desde un solo lugar.
          </p>
        </div>
        <Link href="/cuenta">← Mi cuenta</Link>
      </div>
      <nav className="catalog-tabs" aria-label="Secciones del catálogo">
        {(
          [
            ["products", "Productos"],
            ["categories", "Categorías"],
            ["brands", "Marcas"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "products" ? (
        <ProductManager />
      ) : (
        <TaxonomyManager key={tab} kind={tab} />
      )}
    </div>
  );
}
