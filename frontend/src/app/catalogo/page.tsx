import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicCatalog } from "@/features/catalog/public-catalog";

export const metadata: Metadata = {
  title: "Catálogo de Productos · TTI Tienda Tecnológica Inteligente",
  description:
    "Descubre nuestro catálogo de tecnología en Pasto, Nariño. Computadores, accesorios y promociones vigentes con entrega y garantía local.",
};

export default function CatalogoPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 1280, margin: "40px auto", padding: "0 24px" }}>
          <p role="status">Cargando catálogo...</p>
        </div>
      }
    >
      <PublicCatalog />
    </Suspense>
  );
}

