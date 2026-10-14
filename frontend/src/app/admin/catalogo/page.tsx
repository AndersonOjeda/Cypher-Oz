import type { Metadata } from "next";
import { AdminCatalog } from "@/features/catalog/admin-catalog";

export const metadata: Metadata = {
  title: "Administrar catálogo · TTI",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminCatalog />;
}
