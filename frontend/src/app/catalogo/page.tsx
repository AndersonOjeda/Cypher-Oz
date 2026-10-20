import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicCatalog } from "@/features/catalog/public-catalog";
import { CatalogLoading } from "@/features/catalog/catalog-loading";

export const metadata: Metadata = {
  title: "Catálogo de Productos · TTI Tienda Tecnológica Inteligente",
  description:
    "Descubre nuestro catálogo de tecnología en Pasto, Nariño. Computadores, accesorios y promociones vigentes con entrega y garantía local.",
};

export default function CatalogoPage() {
  return (
    <Suspense fallback={<CatalogLoading />}>
      <PublicCatalog />
    </Suspense>
  );
}
