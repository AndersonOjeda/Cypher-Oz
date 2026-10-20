import { AdminOrderList } from "@/features/orders/admin-order-list";

export const metadata = {
  title: "Gestión de Pedidos — Cypher-Oz Admin",
};

export default function AdminPedidosPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <AdminOrderList />
    </main>
  );
}

