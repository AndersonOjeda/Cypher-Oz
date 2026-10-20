import type { Metadata } from "next";
import { CustomerList } from "@/features/users/customer-list";

export const metadata: Metadata = {
  title: "Gestión de Clientes · Administración TTI",
  robots: { index: false, follow: false },
};

export default function AdminClientesPage() {
  return <CustomerList />;
}

