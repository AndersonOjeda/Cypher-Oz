import { Suspense } from "react";
import { ProductComparisonView } from "@/features/catalog/product-comparator";

export const metadata = {
  title: "Comparador de Productos — Cypher-Oz TTI",
  description: "Compara especificaciones técnicas, precios y disponibilidad entre productos compatibles de la tienda.",
};

export default function CompararPage() {
  return (
    <main className="min-h-screen bg-gray-50/50 py-8">
      <Suspense fallback={<div className="p-12 text-center text-gray-500">Cargando comparador...</div>}>
        <ProductComparisonView />
      </Suspense>
    </main>
  );
}

