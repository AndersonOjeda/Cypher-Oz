import { AdminPaymentList } from "@/features/orders/admin-payment-list";

export const metadata = {
  title: "Verificación de Pagos — Cypher-Oz Admin",
};

export default function AdminPagosPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <AdminPaymentList />
    </main>
  );
}

